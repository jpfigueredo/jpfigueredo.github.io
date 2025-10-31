#!/usr/bin/env node
/**
 * AI-assisted node generator for SW Timeline dataset
 * 
 * Usage:
 *   node scripts/generate-node.mjs --prompt "Smalltalk language 1972"
 *   node scripts/generate-node.mjs --url "https://example.com/paper" --type work
 * 
 * Environment:
 *   OPENAI_API_KEY or ANTHROPIC_API_KEY (optional, falls back to manual entry)
 */

import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const datasetPath = path.join(repoRoot, 'web/src/data/sw-timeline/seed.json');

const PROVIDERS = {
  openai: { url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
  anthropic: { url: 'https://api.anthropic.com/v1/messages', model: 'claude-3-5-sonnet-20241022' },
};

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      parsed[key] = args[i + 1] || true;
      if (args[i + 1] && !args[i + 1].startsWith('--')) i++;
    }
  }
  return parsed;
}

function createPrompt(prompt, url, type) {
  const systemPrompt = `You are a historian of computer science and software engineering. Generate a structured JSON object for a timeline node based on the user's request.

The node must follow this schema:
{
  "id": "kebab-case-unique-id",
  "type": "person" | "work" | "paradigm" | "event" | "technology",
  "label": "Short, clear label (e.g., 'A. M. Turing – 1936')",
  "date": "YYYY-MM-DD" or "YYYY-01-01" if only year is known,
  "authors": ["Author Name"],
  "sources": ["https://primary-source-url"],
  "tags": ["tag1", "tag2"],
  "summary": "1-2 sentence summary of significance"
}

Requirements:
- ID: lowercase, kebab-case, unique (e.g., "turing-1936", "smalltalk-1972")
- Date: Use specific date if known, otherwise YYYY-01-01
- Sources: Prioritize primary sources (papers, official sites, DOI links, archive.org)
- Tags: 2-5 relevant tags (e.g., "oop", "functional-programming", "architecture")
- Summary: Concise but informative, focus on historical significance

Return ONLY valid JSON, no markdown, no explanation.`;

  const userPrompt = url
    ? `Extract information from this URL and create a node: ${url}${type ? ` (type: ${type})` : ''}`
    : `Create a node for: ${prompt}${type ? ` (type: ${type})` : ''}`;

  return { systemPrompt, userPrompt };
}

async function callAI(provider, systemPrompt, userPrompt) {
  const apiKey = process.env[`${provider.toUpperCase()}_API_KEY`];
  if (!apiKey) {
    throw new Error(`Missing ${provider.toUpperCase()}_API_KEY environment variable`);
  }

  const config = PROVIDERS[provider];
  
  if (provider === 'openai') {
    const res = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI API error: ${res.status} - ${err}`);
    }
    const data = await res.json();
    return JSON.parse(data.choices[0].message.content);
  } else if (provider === 'anthropic') {
    const res = await fetch(config.url, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API error: ${res.status} - ${err}`);
    }
    const data = await res.json();
    const content = data.content[0].text;
    // Extract JSON from markdown code block if present
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || [null, content];
    return JSON.parse(jsonMatch[1]);
  }
}

function suggestEdges(newNode, existingNodes) {
  // Simple heuristic: suggest edges to nodes with similar tags or close dates
  const suggestions = [];
  const newTags = new Set((newNode.tags || []).map(t => t.toLowerCase()));
  const newYear = parseInt(newNode.date.slice(0, 4), 10);

  for (const existing of existingNodes) {
    const existingTags = new Set((existing.tags || []).map(t => t.toLowerCase()));
    const existingYear = parseInt(existing.date.slice(0, 4), 10);
    
    const tagOverlap = [...newTags].filter(t => existingTags.has(t)).length;
    const yearDiff = Math.abs(newYear - existingYear);

    if (tagOverlap > 0 || yearDiff <= 5) {
      const relation = newYear < existingYear ? 'influences' : newYear > existingYear ? 'derives-from' : 'synthesizes';
      suggestions.push({
        from: newNode.id,
        to: existing.id,
        relation,
        note: `Suggested: ${tagOverlap > 0 ? 'similar tags' : 'temporal proximity'}`,
      });
    }
  }

  return suggestions.slice(0, 3); // Max 3 suggestions
}

async function main() {
  const args = parseArgs();
  
  if (!args.prompt && !args.url) {
    console.error('Usage: node scripts/generate-node.mjs --prompt "description" [--type work] [--provider openai|anthropic]');
    console.error('   or: node scripts/generate-node.mjs --url "https://..." [--type work] [--provider openai|anthropic]');
    process.exit(1);
  }

  // Determine provider
  let provider = args.provider || 'openai';
  if (!PROVIDERS[provider]) {
    console.error(`Unknown provider: ${provider}. Use 'openai' or 'anthropic'`);
    process.exit(1);
  }

  // Check API key
  const apiKey = process.env[`${provider.toUpperCase()}_API_KEY`];
  if (!apiKey) {
    console.error(`\n❌ Missing ${provider.toUpperCase()}_API_KEY environment variable.`);
    console.error('Set it with: export OPENAI_API_KEY="sk-..." or export ANTHROPIC_API_KEY="sk-ant-..."\n');
    process.exit(1);
  }

  console.log(`🤖 Generating node using ${provider}...\n`);

  try {
    // Load existing dataset
    const dataset = JSON.parse(await readFile(datasetPath, 'utf8'));
    const existingIds = new Set(dataset.nodes.map(n => n.id));

    // Generate node
    const { systemPrompt, userPrompt } = createPrompt(args.prompt || '', args.url || '', args.type);
    const newNode = await callAI(provider, systemPrompt, userPrompt);

    // Validate required fields
    if (!newNode.id || !newNode.type || !newNode.label || !newNode.date) {
      throw new Error('Generated node missing required fields');
    }

    // Check for duplicate ID
    if (existingIds.has(newNode.id)) {
      console.warn(`⚠️  ID "${newNode.id}" already exists. Appending timestamp...`);
      newNode.id = `${newNode.id}-${Date.now().toString().slice(-6)}`;
    }

    console.log('✅ Generated node:');
    console.log(JSON.stringify(newNode, null, 2));
    console.log('');

    // Suggest edges
    const edgeSuggestions = suggestEdges(newNode, dataset.nodes);
    if (edgeSuggestions.length > 0) {
      console.log('💡 Suggested edges:');
      edgeSuggestions.forEach(e => {
        console.log(`   ${e.from} --[${e.relation}]--> ${e.to} (${e.note})`);
      });
      console.log('');
    }

    // Confirm before adding
    if (args.dryRun) {
      console.log('🔍 Dry run: node NOT added to dataset (use without --dry-run to add)');
      return;
    }

    // Add to dataset
    dataset.nodes.push(newNode);
    if (args.addEdges && edgeSuggestions.length > 0) {
      dataset.edges.push(...edgeSuggestions.map(({ note, ...edge }) => edge));
      console.log('✅ Added node and suggested edges to dataset');
    } else {
      console.log('✅ Added node to dataset (use --add-edges to include suggested edges)');
    }

    // Write back
    await writeFile(datasetPath, JSON.stringify(dataset, null, 2) + '\n', 'utf8');
    console.log(`\n📝 Dataset updated: ${datasetPath}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

