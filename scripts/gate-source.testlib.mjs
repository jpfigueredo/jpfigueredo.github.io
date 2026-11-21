// Static checks of the dependency gates' sources, shared by
// advisory-gate.test.mjs and lock-entry-ages.test.mjs. Test helper only: CI
// does not copy it with the gates.
//
// CI copies each gate and scripts/lib/ from the base branch and nothing
// else, so a gate may import only node: built-ins and ./lib/ modules (a lib
// module: node: and its siblings). Its CLI must start only through
// invokedAsCli(import.meta.url), never through import.meta.main, which Node
// before 22.18/24.2 does not set: there, a guard on it ran the CLI of any
// gate that another script imported.

// Comment lines are dropped first. Import statements are matched only up to
// characters an import or export-from statement cannot contain (`(`, `=`,
// backtick, `;`), so a string such as "... from 'develop'" inside code is not
// read as an import. Returns a list of problems.
export function gateSourceProblems(source, allowedSpecifier, { cli = true } = {}) {
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');
  const problems = [];
  for (const m of code.matchAll(/\bimport\s*\.\s*meta\b(?!\s*\.\s*url\b)/g)) problems.push(`uses ${m[0]} other than import.meta.url`);
  for (const m of code.matchAll(/\bimport\s*\(|\brequire\s*\(|\bcreateRequire\b|\bprocess\.binding\b/g)) problems.push(`dynamic import or require: ${m[0]}`);
  const statements = /^\s*(?:import\b|export\s*(?:\*|\{))[^;()=`]*?\bfrom\s*(['"])([^'"]*)\1|^\s*import\s*(['"])([^'"]*)\3/gm;
  for (const m of code.matchAll(statements)) {
    const specifier = m[2] ?? m[4];
    if (!allowedSpecifier.test(specifier)) problems.push(`imports ${specifier}`);
  }
  const guards = code.match(/^if \(invokedAsCli\(import\.meta\.url\)\) \{$/gm) ?? [];
  const calls = code.match(/(?<!function )\bmain\(\)/g) ?? [];
  if (cli) {
    if (guards.length !== 1) problems.push(`expected one "if (invokedAsCli(import.meta.url)) {" line, found ${guards.length}`);
    if (calls.length !== 1) problems.push(`expected main() to be called once (inside the guard), found ${calls.length}`);
  } else if (guards.length || calls.length || /\bprocess\.exit\b/.test(code)) {
    problems.push('a lib module must not have a CLI entry point');
  }
  return problems;
}

export const GATE_IMPORTS = /^(?:node:[a-z_/]+|\.\/lib\/[a-z-]+\.mjs)$/;
export const LIB_IMPORTS = /^(?:node:[a-z_/]+|\.\/[a-z-]+\.mjs)$/;
