#!/usr/bin/env node
// Reference extractor: reads the Markdown pages of an open-source repository
// pinned by commit SHA and writes a deterministic JSON manifest of what each
// page cites (links classified by kind, with a canonical id where one exists),
// its headings, its status banner, its "Claims register" table and its "Next:"
// pointers. A second mode compares two manifests.
//
// The pages are third-party content and are treated as untrusted input:
//   - nothing from the source repository is executed: the only process started
//     is git, with fixed arguments, network transports disabled and lazy
//     fetching off;
//   - blobs are read from the pinned commit with `git ls-tree` and
//     `git cat-file`, never from the working tree, after checking that
//     `git rev-parse HEAD` equals the pinned SHA;
//   - a page larger than MAX_PAGE_BYTES, or not valid UTF-8, is skipped and
//     listed under `skipped`;
//   - invisible and control characters (bidi overrides, zero-width, tag
//     characters, ...) are removed first, then HTML comments, so text hidden
//     from a reader of the rendered page never reaches the manifest;
//   - only http(s) URLs are kept; javascript:, data:, file: and every other
//     scheme, URLs with credentials and over-long URLs are counted under
//     `rejectedLinks` by reason only, the URL itself is dropped;
//   - no eval, no dynamic import; every regular expression is anchored or
//     bounded and has no nested or overlapping quantifiers (see the ReDoS
//     tests). Link parsing is a linear scanner.
//
// Output is deterministic: objects are built with a fixed key order, arrays
// are sorted by code unit, and the manifest holds no run time or user. Who
// ran it and when can go to a separate file (--run-info).
//
// Usage:
//   node scripts/extract-references.mjs --pin <pin.json> --repo <clone> [--out <file>]
//        [--only-pinned] [--strict] [--run-info <file> [--executor <label>]]
//   node scripts/extract-references.mjs --diff <a.json> <b.json> [--out <file>]
//   node scripts/extract-references.mjs --version
// Exit codes: 0 ok; 1 the clone does not match the pin (or, with --strict, a
// malformed "Claims register"); 2 usage, I/O or git error.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';

export const VERSION = '1.0.0';
export const TOOL = 'extract-references';
export const MANIFEST_SCHEMA = 'reference-manifest/1';
export const DIFF_SCHEMA = 'reference-manifest-diff/1';

export const MAX_PAGE_BYTES = 512 * 1024;
export const MAX_URL_CHARS = 2048;
export const MAX_LINK_TEXT_CHARS = 500;
export const MAX_FIELD_CHARS = 2000;
export const MAX_BANNER_CHARS = 300;
export const MAX_MANIFEST_BYTES = 64 * 1024 * 1024;
const REGISTER_HEADING = 'claims register';

export class ExtractError extends Error {
  constructor(message, exitCode = 2) {
    super(message);
    this.exitCode = exitCode;
  }
}

// ------------------------------------------------------------ sanitizing

// Characters removed before anything is parsed. Explicit ranges instead of
// Unicode property escapes, so the result does not depend on the Unicode
// tables of the Node version: C0/C1 controls except tab and newline, the
// format characters (soft hyphen, Arabic/Syriac marks, zero-width, bidi
// embeddings/overrides/isolates, word joiner and invisible operators, BOM,
// interlinear annotation, tag characters), line/paragraph separators,
// variation selectors, combining grapheme joiner, Hangul and Khmer fillers,
// Mongolian selectors and the private use areas.
const INVISIBLE_RANGES = [
  [0x0000, 0x0008], [0x000b, 0x001f], [0x007f, 0x009f], [0x00ad, 0x00ad], [0x034f, 0x034f],
  [0x0600, 0x0605], [0x061c, 0x061c], [0x06dd, 0x06dd], [0x070f, 0x070f], [0x0890, 0x0891],
  [0x08e2, 0x08e2], [0x115f, 0x1160], [0x17b4, 0x17b5], [0x180b, 0x180f], [0x200b, 0x200f],
  [0x2028, 0x202e], [0x2060, 0x206f], [0x3164, 0x3164], [0xe000, 0xf8ff], [0xfe00, 0xfe0f],
  [0xfeff, 0xfeff], [0xffa0, 0xffa0], [0xfff9, 0xfffb], [0x110bd, 0x110bd], [0x110cd, 0x110cd],
  [0x13430, 0x1343f], [0x1bca0, 0x1bca3], [0x1d173, 0x1d17a], [0xe0000, 0xe0fff], [0xf0000, 0x10ffff],
];

export function isInvisible(cp) {
  for (const [lo, hi] of INVISIBLE_RANGES) {
    if (cp < lo) return false;
    if (cp <= hi) return true;
  }
  return false;
}

// Removes HTML comments in one linear pass. Comment syntax that only appears
// after an inner comment is removed (`<!<!-- a -->-- b -->`) is removed too,
// because the check runs on the output: the result never contains `<!--`.
// An unterminated comment runs to the end of the text, as in HTML.
export function stripHtmlComments(text) {
  const out = [];
  let removed = 0;
  let inComment = false;
  let tail = '';
  for (const ch of text) {
    if (inComment) {
      tail = (tail + ch).slice(-3);
      if (tail === '-->') {
        inComment = false;
        tail = '';
      }
      continue;
    }
    out.push(ch);
    const n = out.length;
    if (n >= 4 && out[n - 1] === '-' && out[n - 2] === '-' && out[n - 3] === '!' && out[n - 4] === '<') {
      out.length = n - 4;
      inComment = true;
      removed += 1;
      tail = '';
    }
  }
  return { text: out.join(''), removed };
}

// Newlines first, then invisible characters (so they cannot split a `<!--`),
// then HTML comments, then NFC.
export function sanitize(raw) {
  const text = raw.replace(/\r\n?/g, '\n');
  let invisibleChars = 0;
  const kept = [];
  for (const ch of text) {
    if (isInvisible(ch.codePointAt(0))) invisibleChars += 1;
    else kept.push(ch);
  }
  const visible = kept.join('');
  const { text: noComments, removed } = stripHtmlComments(visible);
  return { text: noComments.normalize('NFC'), htmlComments: removed, invisibleChars };
}

// ------------------------------------------------------------ inline Markdown

// Replaces inline code spans with spaces of the same length, so links and
// URLs inside code are not read. A span is a run of N backticks closed by the
// next run of exactly N backticks (CommonMark). Linear: runs are collected in
// one pass and matched by length with a queue per length.
export function maskCodeSpans(line) {
  if (!line.includes('`')) return line;
  const runs = [];
  for (let i = 0; i < line.length; ) {
    if (line[i] !== '`') {
      i += 1;
      continue;
    }
    let j = i;
    while (j < line.length && line[j] === '`') j += 1;
    runs.push([i, j - i]);
    i = j;
  }
  const byLength = new Map();
  runs.forEach(([, len], idx) => {
    if (!byLength.has(len)) byLength.set(len, []);
    byLength.get(len).push(idx);
  });
  const cursor = new Map();
  const chars = line.split('');
  let consumedUntil = -1;
  for (let r = 0; r < runs.length; r += 1) {
    if (r <= consumedUntil) continue;
    const [start, len] = runs[r];
    const list = byLength.get(len);
    let c = cursor.get(len) ?? 0;
    while (c < list.length && list[c] <= r) c += 1;
    cursor.set(len, c);
    if (c >= list.length) continue;
    const closeIdx = list[c];
    const [closeStart] = runs[closeIdx];
    for (let k = start; k < closeStart + len; k += 1) chars[k] = ' ';
    consumedUntil = closeIdx;
  }
  return chars.join('');
}

// Finds inline links and images `[text](dest "title")` in one line. Linear:
// the backward search for `[` never goes behind the previous `](` examined,
// and a failed destination scan resumes after the characters it read.
export function scanInlineLinks(line) {
  const found = [];
  let floor = 0;
  let from = 0;
  for (;;) {
    const j = line.indexOf('](', from);
    if (j === -1) break;
    let open = -1;
    let depth = 0;
    const lowest = Math.max(floor, j - MAX_LINK_TEXT_CHARS);
    for (let k = j - 1; k >= lowest; k -= 1) {
      const ch = line[k];
      if (ch === ']') depth += 1;
      else if (ch === '[') {
        if (depth === 0) {
          open = k;
          break;
        }
        depth -= 1;
      }
    }
    const dest = parseDestination(line, j + 2);
    floor = j + 2;
    if (open === -1 || !dest.ok) {
      from = Math.max(j + 2, dest.next);
      floor = from;
      continue;
    }
    const image = open > 0 && line[open - 1] === '!';
    found.push({ start: image ? open - 1 : open, end: dest.next, text: line.slice(open + 1, j), dest: dest.value, image });
    from = dest.next;
    floor = from;
  }
  return found;
}

// Parses `dest` or `<dest>`, an optional title and the closing `)`.
function parseDestination(line, p) {
  let i = p;
  while (line[i] === ' ' || line[i] === '\t') i += 1;
  let value;
  if (line[i] === '<') {
    const close = line.indexOf('>', i + 1);
    if (close === -1 || close - i > MAX_URL_CHARS + 1) return { ok: false, next: Math.min(line.length, i + MAX_URL_CHARS + 2) };
    value = line.slice(i + 1, close);
    i = close + 1;
  } else {
    const startDest = i;
    let parens = 0;
    for (; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === ' ' || ch === '\t') break;
      if (ch === '(') parens += 1;
      else if (ch === ')') {
        if (parens === 0) break;
        parens -= 1;
      }
      if (i - startDest > MAX_URL_CHARS) return { ok: false, next: i };
    }
    value = line.slice(startDest, i);
  }
  while (line[i] === ' ' || line[i] === '\t') i += 1;
  const q = line[i];
  if (q === '"' || q === "'" || q === '(') {
    const closer = q === '(' ? ')' : q;
    const close = line.indexOf(closer, i + 1);
    if (close === -1 || close - i > MAX_LINK_TEXT_CHARS) return { ok: false, next: Math.min(line.length, i + 1) };
    i = close + 1;
    while (line[i] === ' ' || line[i] === '\t') i += 1;
  }
  if (line[i] !== ')') return { ok: false, next: Math.max(p, i) };
  return { ok: true, value, next: i + 1 };
}

const AUTOLINK = /<([A-Za-z][A-Za-z0-9+.-]{1,31}:[^<>\s]{1,2048})>/g;
const BARE_URL = /\bhttps?:\/\/[^\s<>"'`()[\]{}|\\^]{1,2048}/gi;
const REF_DEFINITION = /^ {0,3}\[[^\]\n]{1,500}\]:[ \t]*<?([^\s<>]{1,2048})>?/;

// Every link target in a line (code spans masked): inline links, reference
// definitions, autolinks and bare http(s) URLs. Images are left out.
export function linkTargets(line) {
  const masked = maskCodeSpans(line);
  const targets = [];
  const chars = masked.split('');
  const blank = (s, e) => {
    for (let k = s; k < e; k += 1) chars[k] = ' ';
  };
  const def = REF_DEFINITION.exec(masked);
  if (def) {
    targets.push(def[1]);
    blank(0, def[0].length);
  }
  for (const link of scanInlineLinks(chars.join(''))) {
    if (!link.image) targets.push(link.dest);
    blank(link.start, link.end);
  }
  const rest1 = chars.join('');
  for (const m of rest1.matchAll(AUTOLINK)) {
    targets.push(m[1]);
    blank(m.index, m.index + m[0].length);
  }
  for (const m of chars.join('').matchAll(BARE_URL)) {
    targets.push(trimTrailingPunctuation(m[0]));
  }
  return targets;
}

function trimTrailingPunctuation(url) {
  let end = url.length;
  while (end > 0 && '.,;:!?*_~'.includes(url[end - 1])) end -= 1;
  return url.slice(0, end);
}

const HTML_TAG = /<\/?[A-Za-z][A-Za-z0-9-]{0,30}(?:\s[^<>]{0,500})?\/?>/g;

// Plain text of a Markdown fragment: links become their text, HTML tags and
// emphasis markers go, whitespace collapses; capped at `max` characters.
export function plainText(fragment, max = MAX_FIELD_CHARS) {
  const pieces = [];
  let at = 0;
  for (const { start, end, text, image } of scanInlineLinks(fragment)) {
    pieces.push(fragment.slice(at, start), image ? '' : text);
    at = end;
  }
  pieces.push(fragment.slice(at));
  let s = pieces.join('');
  s = s.replace(HTML_TAG, ' ').replace(/\*+|__|`/g, '').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max)} [truncated]` : s;
}

// ------------------------------------------------------------ URLs

const VENDOR_DOMAINS = [
  '1password.com', 'amazon.com', 'apple.com', 'atlassian.com', 'bitwarden.com', 'cisco.com',
  'cloudflare.com', 'crowdstrike.com', 'digitalocean.com', 'docker.com', 'doppler.com', 'elastic.co',
  'fortinet.com', 'google.com', 'grafana.com', 'hashicorp.com', 'ibm.com', 'microsoft.com',
  'netgate.com', 'nitrokey.com', 'okta.com', 'oracle.com', 'paloaltonetworks.com', 'proton.me',
  'redhat.com', 'spacelift.io', 'splunk.com', 'suse.com', 'trezor.io', 'twingate.com',
  'ubuntu.com', 'vmware.com', 'wazuh.com', 'yubico.com', 'zscaler.com',
];
const VENDOR_HOSTS = ['docs.github.com'];

const hostIs = (host, domain) => host === domain || host.endsWith(`.${domain}`);

// Trims C0 controls and spaces (code points 0x00 to 0x20) at both ends.
function trimC0(s) {
  let a = 0;
  let b = s.length;
  while (a < b && s.charCodeAt(a) <= 0x20) a += 1;
  while (b > a && s.charCodeAt(b - 1) <= 0x20) b -= 1;
  return s.slice(a, b);
}

// Classifies one link target. Returns
//   { type: 'url', url, kind, id?, edition? }   an http(s) URL;
//   { type: 'page', path }                      a relative link (resolved by the caller);
//   { type: 'rejected', reason }                anything else.
export function classifyTarget(rawTarget) {
  // What a browser would do first: drop ASCII tab/newline anywhere, trim
  // C0 controls and spaces. So "java\tscript:" is seen as "javascript:".
  const target = trimC0(rawTarget.replace(/[\t\n\r]/g, ''));
  if (target === '') return { type: 'rejected', reason: 'empty' };
  if (target.length > MAX_URL_CHARS) return { type: 'rejected', reason: 'too-long' };
  const scheme = /^([A-Za-z][A-Za-z0-9+.-]{0,31}):/.exec(target);
  if (!scheme) {
    if (target.startsWith('//') || target.startsWith('\\')) return { type: 'rejected', reason: 'protocol-relative' };
    return { type: 'page', path: target };
  }
  const name = scheme[1].toLowerCase();
  if (name !== 'http' && name !== 'https') return { type: 'rejected', reason: `scheme:${name}` };
  let u;
  try {
    u = new URL(target);
  } catch {
    return { type: 'rejected', reason: 'unparseable' };
  }
  if (u.username || u.password) return { type: 'rejected', reason: 'credentials' };
  if (!u.hostname) return { type: 'rejected', reason: 'no-host' };
  return { type: 'url', url: u.href, ...kindOf(u) };
}

function kindOf(u) {
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  const segs = u.pathname.split('/').filter(Boolean).map((s) => safeDecode(s));
  if (['rfc-editor.org', 'ietf.org', 'datatracker.ietf.org', 'tools.ietf.org'].includes(host)) {
    for (const s of segs) {
      const m = /^rfc0*(\d{1,5})(?:\.(?:txt|html|pdf|xml|json))?$/i.exec(s);
      if (m) return { kind: 'rfc', id: `RFC ${m[1]}` };
    }
    return { kind: 'rfc' };
  }
  if (hostIs(host, 'nist.gov') || ((host === 'doi.org' || host === 'dx.doi.org') && segs[0] === '10.6028')) {
    const doc = nistDocument(host, segs);
    if (doc) return doc;
    return { kind: 'nist' };
  }
  if (host === 'attack.mitre.org') return { kind: 'attack', ...attackId(segs) };
  if (hostIs(host, 'cisa.gov') || hostIs(host, 'us-cert.gov')) return { kind: 'cisa', ...cisaId(segs) };
  if (VENDOR_HOSTS.includes(host) || VENDOR_DOMAINS.some((d) => hostIs(host, d))) return { kind: 'vendor' };
  return { kind: 'other' };
}

function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

// NIST publication ids. Work-level id (`SP 800-57 Part 1`, `FIPS 197`,
// `IR 8547`); revision and stage go to `edition` (`Rev. 5`, `Rev. 3 ipd`).
function nistDocument(host, segs) {
  // doi.org/10.6028/NIST.SP.800-57pt1r5 and nvlpubs .../NIST.SP.800-38D.pdf
  const last = segs[segs.length - 1] ?? '';
  const named = segs[0] === '10.6028' ? segs[1] ?? '' : last;
  if (/^NIST\./i.test(named)) return fromNistName(named.replace(/\.pdf$/i, ''));
  // nvlpubs .../Legacy/SP/nistspecialpublication800-34r1.pdf
  const legacy = /^nistspecialpublication800-(\d{1,4})([a-z])?(?:r(\d{1,2}))?\.pdf$/i.exec(last);
  if (legacy) return { kind: 'nist', id: spId(legacy[1], legacy[2]), ...edition(legacy[3]) };
  // csrc.nist.gov/pubs/<series>/<...>/<stage>
  if (segs[0] === 'pubs' && segs.length >= 3) return fromPubsPath(segs.slice(1));
  // csrc.nist.gov/publications/detail/<series>/<name>/[rev-N]/<stage>
  if (segs[0] === 'publications' && segs[1] === 'detail' && segs.length >= 4) return fromDetailPath(segs.slice(2));
  return null;
}

const STAGES = new Set(['final', 'ipd', '2pd', '3pd', 'fpd', 'draft', 'upd1', 'upd2']);

function stageLabel(stage) {
  return stage && stage !== 'final' && !stage.startsWith('upd') ? stage : '';
}

function edition(rev, stage) {
  const parts = [];
  if (rev) parts.push(`Rev. ${rev}`);
  const st = stageLabel(stage);
  if (st) parts.push(st);
  return parts.length ? { edition: parts.join(' ') } : {};
}

function spId(num, letter, part) {
  return `SP 800-${num}${letter ? letter.toUpperCase() : ''}${part ? ` Part ${part}` : ''}`;
}

function fromNistName(name) {
  // NIST.SP.800-57pt1r5, NIST.SP.800-131Ar2, NIST.SP.800-38D, NIST.SP.800-63-4,
  // NIST.IR.8547.ipd, NIST.FIPS.197-upd1, NIST.FIPS.140-3
  let m = /^NIST\.SP\.800-(\d{1,4}(?:-\d{1,2})?)([A-Za-z])?(?:pt(\d))?(?:r(\d{1,2}))?(?:\.([a-z0-9]{1,8}))?$/i.exec(name);
  if (m) return { kind: 'nist', id: spId(m[1], m[2], m[3]), ...edition(m[4], m[5]?.toLowerCase()) };
  m = /^NIST\.(?:IR|NISTIR)\.(\d{1,5})(?:r(\d{1,2}))?(?:\.([a-z0-9]{1,8}))?$/i.exec(name);
  if (m) return { kind: 'nist', id: `IR ${m[1]}`, ...edition(m[2], m[3]?.toLowerCase()) };
  m = /^NIST\.FIPS\.(\d{1,3}(?:-\d{1,2})?)(?:-upd\d)?(?:\.([a-z0-9]{1,8}))?$/i.exec(name);
  if (m) return { kind: 'fips', id: `FIPS ${m[1]}`, ...edition(undefined, m[2]?.toLowerCase()) };
  if (/^NIST\.FIPS\./i.test(name)) return { kind: 'fips' };
  m = /^NIST\.CSWP\.(\d{1,3})(?:\.([a-z0-9]{1,8}))?$/i.exec(name);
  if (m) return { kind: 'nist', id: `CSWP ${m[1]}`, ...edition(undefined, m[2]?.toLowerCase()) };
  return { kind: 'nist' };
}

function fromPubsPath(rest) {
  // [series, ...parts, stage]: sp/800/38/d/final, sp/800/57/pt1/r5/final,
  // sp/800/131/a/r3/ipd, sp/800/52/r2/final, fips/197/final, ir/8547/ipd
  const series = rest[0].toLowerCase();
  const parts = rest.slice(1).map((s) => s.toLowerCase());
  const stage = STAGES.has(parts[parts.length - 1]) ? parts.pop() : undefined;
  if (series === 'fips' && /^\d{1,3}(?:-\d{1,2})?$/.test(parts[0] ?? '')) {
    return { kind: 'fips', id: `FIPS ${parts[0]}`, ...edition(undefined, stage) };
  }
  if (series === 'fips') return { kind: 'fips' };
  if (series === 'ir' && /^\d{1,5}$/.test(parts[0] ?? '')) {
    const rev = /^r(\d{1,2})$/.exec(parts[1] ?? '');
    return { kind: 'nist', id: `IR ${parts[0]}`, ...edition(rev?.[1], stage) };
  }
  if (series === 'sp' && parts[0] === '800' && /^\d{1,4}$/.test(parts[1] ?? '')) {
    let i = 2;
    let num = parts[1];
    if (/^\d{1,2}$/.test(parts[i] ?? '')) num += `-${parts[i++]}`;
    const letter = /^[a-z]$/.test(parts[i] ?? '') ? parts[i++] : undefined;
    const pt = /^pt(\d)$/.exec(parts[i] ?? '');
    if (pt) i += 1;
    const rev = /^r(\d{1,2})$/.exec(parts[i] ?? '');
    return { kind: 'nist', id: spId(num, letter, pt?.[1]), ...edition(rev?.[1], stage) };
  }
  return null;
}

function fromDetailPath(rest) {
  // sp/800-38d/final, sp/800-57-part-1/rev-5/final, fips/197/final, nistir/8547/draft
  const series = rest[0].toLowerCase();
  const name = rest[1].toLowerCase();
  const tail = rest.slice(2).map((s) => s.toLowerCase());
  const stage = STAGES.has(tail[tail.length - 1]) ? tail.pop() : undefined;
  const rev = /^rev-?(\d{1,2})$/.exec(tail[0] ?? '');
  if (series === 'fips') {
    const m = /^(\d{1,3}(?:-\d{1,2})?)$/.exec(name);
    return m ? { kind: 'fips', id: `FIPS ${m[1]}`, ...edition(undefined, stage) } : { kind: 'fips' };
  }
  if (series === 'nistir' || series === 'ir') {
    const m = /^(\d{1,5})$/.exec(name);
    return m ? { kind: 'nist', id: `IR ${m[1]}`, ...edition(rev?.[1], stage) } : null;
  }
  if (series === 'sp') {
    const m = /^800-(\d{1,4}(?:-\d{1,2})?)([a-z])?(?:-part-(\d))?$/.exec(name);
    return m ? { kind: 'nist', id: spId(m[1], m[2], m[3]), ...edition(rev?.[1], stage) } : null;
  }
  return null;
}

const ATTACK_SECTIONS = {
  techniques: /^T\d{4}$/,
  tactics: /^TA\d{4}$/,
  software: /^S\d{4}$/,
  groups: /^G\d{4}$/,
  mitigations: /^M\d{4}$/,
  datasources: /^DS\d{4}$/,
  campaigns: /^C\d{4}$/,
};

function attackId(segs) {
  let s = segs;
  let ver;
  if (s[0] === 'versions' && /^v\d{1,3}$/i.test(s[1] ?? '')) {
    ver = s[1].toLowerCase();
    s = s.slice(2);
  }
  const versioned = ver ? { edition: ver } : {};
  const re = ATTACK_SECTIONS[(s[0] ?? '').toLowerCase()];
  const code = (s[1] ?? '').toUpperCase();
  if (!re || !re.test(code)) return versioned;
  if (s[0].toLowerCase() === 'techniques' && /^\d{3}$/.test(s[2] ?? '')) return { id: `${code}.${s[2]}`, ...versioned };
  return { id: code, ...versioned };
}

function cisaId(segs) {
  for (const raw of segs) {
    const s = raw.toLowerCase();
    let m = /^(aa|icsa|icsma)(\d{2}-\d{3}-\d{2}[a-z]?|\d{2}-\d{3}[a-z]?)$/.exec(s);
    if (m) return { id: `${m[1]}${m[2]}`.toUpperCase() };
    m = /^(bod|ed)-(\d{2}-\d{2})$/.exec(s);
    if (m) return { id: `${m[1].toUpperCase()} ${m[2]}` };
  }
  return {};
}

// Resolves a relative link from a page to a repository path; null when it
// leaves the repository or points at the page itself (an anchor).
export function resolvePageLink(fromPath, target) {
  const noFragment = target.split('#')[0].split('?')[0];
  if (noFragment === '') return null;
  const decoded = safeDecode(noFragment);
  const joined = decoded.startsWith('/') ? decoded.slice(1) : posix.join(posix.dirname(fromPath), decoded);
  const norm = posix.normalize(joined);
  if (norm === '.' || norm.startsWith('../') || norm === '..' || posix.isAbsolute(norm)) return null;
  return norm;
}

// ------------------------------------------------------------ status words

// Tags for a "Status" cell of the register, from the vocabulary the source
// uses (Read, Listing read, Run, est., UNVERIFIED, Not run, Not read, General
// knowledge, Observed, Verified). Negated phrases are taken out before the plain verbs.
export function statusTags(status) {
  let s = ` ${status.toLowerCase().replace(/[*_`]/g, '')} `;
  const tags = new Set();
  const take = (pattern, tag) => {
    const re = new RegExp(pattern, 'g');
    if (re.test(s)) {
      tags.add(tag);
      s = s.replace(new RegExp(pattern, 'g'), ' ');
    }
  };
  take('listing read', 'listing-read');
  take('\\b(?:not|never) read\\b', 'not-read');
  take('\\b(?:not|never) run\\b|\\bnothing (?:was )?run\\b', 'not-run');
  take('\\bunverified\\b|\\bnot verified\\b', 'unverified');
  take('\\best\\.', 'est');
  take('\\bgeneral knowledge\\b', 'general-knowledge');
  take('\\bobserved\\b', 'observed');
  take('\\bverified\\b', 'verified');
  take('\\bread\\b', 'read');
  take('\\brun\\b|\\bran\\b', 'run');
  return [...tags].sort();
}

// ------------------------------------------------------------ page parser

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const ATX = /^ {0,3}(#{1,6})(?:[ \t]|$)/;
const NEXT = /^(?:>[ \t]?)?(?:\*\*|__)?next(?::(?:\*\*|__)?|(?:\*\*|__):)/i;

function headingText(line, hashes) {
  let rest = line.trimStart().slice(hashes.length).trim();
  // closing sequence: spaces then #s at the end
  let end = rest.length;
  while (end > 0 && rest[end - 1] === '#') end -= 1;
  if (end < rest.length && (end === 0 || rest[end - 1] === ' ' || rest[end - 1] === '\t')) rest = rest.slice(0, end).trim();
  return rest;
}

function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells = [];
  let cur = '';
  for (let i = 0; i < s.length; i += 1) {
    if (s[i] === '\\' && s[i + 1] === '|') {
      cur += '|';
      i += 1;
    } else if (s[i] === '|') {
      cells.push(cur.trim());
      cur = '';
    } else cur += s[i];
  }
  cells.push(cur.trim());
  return cells;
}

const isSeparatorRow = (cells) => cells.length > 0 && cells.every((c) => /^:?-{1,200}:?$/.test(c));

const byString = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Parses one sanitized page. `path` is its repository path (for resolving
// relative links).
export function parsePage(path, text) {
  const lines = text.split('\n');
  const headings = [];
  const linkCounts = new Map();
  const rejected = new Map();
  const pageLinks = new Set();
  const next = [];
  const nextSeen = new Set();
  let banner = null;
  let fence = null;
  let register = null;
  let regState = null; // { level, phase: 'seek' | 'header' | 'sep' | 'rows' | 'done', cols }

  const addTarget = (raw, sink) => {
    const c = classifyTarget(raw);
    if (c.type === 'url') {
      const key = c.url;
      const prev = linkCounts.get(key);
      if (prev) prev.count += 1;
      else linkCounts.set(key, { url: c.url, kind: c.kind, id: c.id, edition: c.edition, count: 1 });
      sink?.urls.push(c);
    } else if (c.type === 'page') {
      const p = resolvePageLink(path, c.path);
      if (p) {
        pageLinks.add(p);
        sink?.pages.push(p);
      }
    } else {
      rejected.set(c.reason, (rejected.get(c.reason) ?? 0) + 1);
    }
  };

  const finishRegister = () => {
    if (regState?.phase === 'seek') register.errors.push({ line: regState.headingLine, reason: 'no-table' });
    if (regState?.phase === 'sep') register.errors.push({ line: regState.headingLine, reason: 'no-separator' });
    regState = null;
  };

  for (let idx = 0; idx < lines.length; idx += 1) {
    const lineNo = idx + 1;
    const line = lines[idx];

    const f = FENCE.exec(line);
    if (fence) {
      const t = line.trim();
      const indent = line.length - line.trimStart().length;
      if (indent <= 3 && t[0] === fence[0] && t.length >= fence.length && /^(?:`{3,}|~{3,})$/.test(t)) fence = null;
      continue;
    }
    if (f) {
      fence = f[1];
      continue;
    }

    const h = ATX.exec(line);
    if (h) {
      const level = h[1].length;
      const textH = plainText(headingText(line, h[1]), MAX_FIELD_CHARS);
      headings.push({ level, text: textH });
      if (regState && level <= regState.level) finishRegister();
      if (!register && textH.toLowerCase() === REGISTER_HEADING) {
        register = { line: lineNo, rows: [], errors: [] };
        regState = { level, phase: 'seek', headingLine: lineNo };
      }
      continue;
    }

    // Status banner: the first `> **Status: ...**` before the second heading.
    if (!banner && headings.length <= 1 && line.startsWith('>')) {
      const at = line.indexOf('**Status:');
      if (at !== -1) {
        const close = line.indexOf('**', at + 9);
        const raw = line.slice(at + 9, close === -1 ? undefined : close);
        const textB = plainText(raw, MAX_BANNER_CHARS);
        banner = { text: textB, draft: /\bunverified draft\b/i.test(textB) };
      }
    }

    // Claims register table.
    if (regState && regState.phase !== 'done') {
      const isRow = line.trim().startsWith('|');
      if (regState.phase === 'seek' && isRow) regState.phase = 'header';
      if (regState.phase === 'header') {
        const cells = splitRow(line).map((c) => plainText(c).toLowerCase());
        const cols = { claim: cells.indexOf('claim'), source: cells.indexOf('source'), status: cells.indexOf('status'), count: cells.length };
        for (const name of ['claim', 'source', 'status']) {
          if (cols[name] === -1) register.errors.push({ line: lineNo, reason: 'missing-column', column: name });
        }
        regState.cols = cols;
        regState.phase = cols.claim === -1 || cols.status === -1 ? 'done' : 'sep';
        continue;
      }
      if (regState.phase === 'sep') {
        if (!isRow || !isSeparatorRow(splitRow(line))) {
          register.errors.push({ line: lineNo, reason: 'no-separator' });
          regState.phase = 'done';
        } else regState.phase = 'rows';
        continue;
      }
      if (regState.phase === 'rows') {
        if (!isRow) {
          regState.phase = 'done';
        } else {
          const cells = splitRow(line);
          const { cols } = regState;
          if (cells.length !== cols.count) {
            register.errors.push({ line: lineNo, reason: 'cell-count', expected: cols.count, got: cells.length });
          } else {
            const sink = { urls: [], pages: [] };
            const sourceCell = cols.source === -1 ? '' : cells[cols.source];
            for (const t of linkTargets(sourceCell)) addTarget(t, sink);
            for (const t of linkTargets(cells[cols.claim])) addTarget(t);
            const claim = plainText(cells[cols.claim]);
            const status = plainText(cells[cols.status]);
            if (claim === '') register.errors.push({ line: lineNo, reason: 'empty-claim' });
            else {
              register.rows.push({
                line: lineNo,
                claim,
                source: plainText(sourceCell),
                sourceLinks: dedupeUrls(sink.urls),
                status,
                statusTags: statusTags(status),
              });
            }
          }
          continue;
        }
      }
    }

    const targets = linkTargets(line);
    if (NEXT.test(line.trim())) {
      const sink = { urls: [], pages: [] };
      for (const t of targets) addTarget(t, sink);
      for (const p of sink.pages) {
        if (!nextSeen.has(p)) next.push(p);
        nextSeen.add(p);
      }
    } else {
      for (const t of targets) addTarget(t);
    }
  }
  finishRegister();

  const links = [...linkCounts.values()].sort((a, b) => byString(a.url, b.url)).map(linkRecord);
  return {
    title: headings.find((x) => x.level === 1)?.text ?? null,
    banner,
    headings,
    links,
    pageLinks: [...pageLinks].sort(byString),
    next,
    register,
    rejectedLinks: [...rejected.entries()].sort((a, b) => byString(a[0], b[0])).map(([reason, count]) => ({ reason, count })),
  };
}

function linkRecord({ url, kind, id, edition: ed, count }) {
  return { url, kind, id, edition: ed, count };
}

function dedupeUrls(urls) {
  const seen = new Map();
  for (const u of urls) if (!seen.has(u.url)) seen.set(u.url, { url: u.url, kind: u.kind, id: u.id, edition: u.edition });
  return [...seen.values()].sort((a, b) => byString(a.url, b.url));
}

// ------------------------------------------------------------ pin and git

const SHA_RE = /^[0-9a-f]{40}$/;
const PIN_KEYS = ['repo', 'sha', 'date', 'license', 'pagesDir', 'pages'];

export function parsePin(text) {
  let pin;
  try {
    pin = JSON.parse(text);
  } catch (err) {
    throw new ExtractError(`pin is not valid JSON: ${err.message}`);
  }
  const problems = [];
  if (!pin || typeof pin !== 'object' || Array.isArray(pin)) throw new ExtractError('pin must be a JSON object');
  for (const k of Object.keys(pin)) if (!PIN_KEYS.includes(k)) problems.push(`unknown key "${k}"`);
  if (typeof pin.repo !== 'string' || !/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/.test(pin.repo)) problems.push('repo must be "owner/name"');
  if (typeof pin.sha !== 'string' || !SHA_RE.test(pin.sha)) problems.push('sha must be 40 lowercase hex characters');
  if (typeof pin.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(pin.date)) problems.push('date must be YYYY-MM-DD');
  if (typeof pin.license !== 'string' || pin.license === '') problems.push('license must be a non-empty string');
  const dirOk = typeof pin.pagesDir === 'string' && pin.pagesDir !== '' && posix.normalize(pin.pagesDir) === pin.pagesDir && !pin.pagesDir.startsWith('..') && !pin.pagesDir.startsWith('/') && !pin.pagesDir.endsWith('/');
  if (!dirOk) problems.push('pagesDir must be a normalized relative directory, without a trailing slash');
  if (!Array.isArray(pin.pages)) problems.push('pages must be an array');
  else {
    const seen = new Set();
    pin.pages.forEach((p, i) => {
      if (!p || typeof p !== 'object' || Object.keys(p).sort().join(',') !== 'blobSha,path') return problems.push(`pages[${i}] must be {path, blobSha}`);
      if (typeof p.path !== 'string' || !dirOk || posix.dirname(p.path) !== pin.pagesDir || !p.path.endsWith('.md')) problems.push(`pages[${i}].path must be a .md file directly in pagesDir`);
      if (typeof p.blobSha !== 'string' || !SHA_RE.test(p.blobSha)) problems.push(`pages[${i}].blobSha must be 40 lowercase hex characters`);
      if (seen.has(p.path)) problems.push(`pages[${i}].path is repeated`);
      seen.add(p.path);
    });
  }
  if (problems.length) throw new ExtractError(`invalid pin: ${problems.join('; ')}`);
  return pin;
}

// git with fixed arguments only. Network transports are refused and lazy
// fetching of missing objects is off, so reading a blob never fetches.
function git(dir, args, { maxBuffer = 16 * 1024 * 1024, encoding = 'utf8' } = {}) {
  try {
    return execFileSync(
      'git',
      ['-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', '-c', 'protocol.allow=never', '-C', dir, ...args],
      {
        encoding: encoding === 'buffer' ? 'buffer' : 'utf8',
        maxBuffer,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0', GIT_PAGER: 'cat', GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'C' },
      },
    );
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString().trim().split('\n').slice(-1)[0] : err.message;
    throw new ExtractError(`git ${args[0]} failed: ${stderr}`);
  }
}

const UTF8 = new TextDecoder('utf-8', { fatal: true });

// Builds the manifest for the pinned commit of the clone in `repoDir`.
export function extract({ pinText, repoDir, onlyPinned = false }) {
  const pin = parsePin(pinText);
  let root;
  try {
    root = realpathSync(repoDir);
    if (!statSync(root).isDirectory()) throw new Error('not a directory');
  } catch (err) {
    throw new ExtractError(`cannot use ${repoDir}: ${err.message}`);
  }
  const top = git(root, ['rev-parse', '--show-toplevel']).trim();
  if (realpathSync(top) !== root) throw new ExtractError(`${repoDir} is not the top of a git clone (top: ${top})`);
  const head = git(root, ['rev-parse', '--verify', 'HEAD^{commit}']).trim();
  if (head !== pin.sha) throw new ExtractError(`HEAD is ${head}, the pin says ${pin.sha}`, 1);
  const commitDate = git(root, ['show', '-s', '--format=%cs', pin.sha]).trim();
  if (commitDate !== pin.date) throw new ExtractError(`commit date is ${commitDate}, the pin says ${pin.date}`, 1);

  const tree = git(root, ['ls-tree', '-z', '--full-tree', '-l', pin.sha, '--', `${pin.pagesDir}/`]);
  const entries = [];
  const skipped = [];
  for (const rec of tree.split('\0')) {
    if (!rec) continue;
    const tab = rec.indexOf('\t');
    const [mode, type, sha, size] = rec.slice(0, tab).split(/ +/);
    const path = rec.slice(tab + 1);
    if (posix.dirname(path) !== pin.pagesDir || !path.endsWith('.md')) continue;
    if (type !== 'blob' || (mode !== '100644' && mode !== '100755')) {
      skipped.push({ path, blobSha: sha, reason: `mode-${mode}` });
      continue;
    }
    entries.push({ path, sha, size: Number(size) });
  }
  entries.sort((a, b) => byString(a.path, b.path));

  const byPath = new Map(entries.map((e) => [e.path, e]));
  const mismatches = [];
  for (const p of pin.pages) {
    const e = byPath.get(p.path);
    if (!e) mismatches.push(`${p.path} is not in ${pin.sha}`);
    else if (e.sha !== p.blobSha) mismatches.push(`${p.path} is blob ${e.sha}, the pin says ${p.blobSha}`);
  }
  if (mismatches.length) throw new ExtractError(`pinned pages do not match: ${mismatches.join('; ')}`, 1);
  const wanted = onlyPinned ? new Set(pin.pages.map((p) => p.path)) : null;

  const pages = [];
  for (const e of entries) {
    if (wanted && !wanted.has(e.path)) continue;
    if (!(e.size <= MAX_PAGE_BYTES)) {
      skipped.push({ path: e.path, blobSha: e.sha, reason: 'too-large', bytes: e.size });
      continue;
    }
    const buf = git(root, ['cat-file', 'blob', e.sha], { encoding: 'buffer', maxBuffer: MAX_PAGE_BYTES + 1 });
    let raw;
    try {
      raw = UTF8.decode(buf);
    } catch {
      skipped.push({ path: e.path, blobSha: e.sha, reason: 'invalid-utf8', bytes: buf.length });
      continue;
    }
    const clean = sanitize(raw);
    const parsed = parsePage(e.path, clean.text);
    pages.push({
      path: e.path,
      blobSha: e.sha,
      bytes: buf.length,
      ...parsed,
      sanitized: { htmlComments: clean.htmlComments, invisibleChars: clean.invisibleChars },
    });
  }
  skipped.sort((a, b) => byString(a.path, b.path));

  const content = { pages, skipped };
  const contentSha256 = createHash('sha256').update(JSON.stringify(content)).digest('hex');
  return {
    schema: MANIFEST_SCHEMA,
    source: { repo: pin.repo, sha: pin.sha, date: pin.date, license: pin.license, pagesDir: pin.pagesDir },
    provenance: {
      inputs: { repo: `https://github.com/${pin.repo}`, sha: pin.sha, pagesDir: pin.pagesDir, onlyPinned },
      transformation: { tool: TOOL, version: VERSION, limits: { maxPageBytes: MAX_PAGE_BYTES, maxUrlChars: MAX_URL_CHARS, maxFieldChars: MAX_FIELD_CHARS } },
      contentSha256,
    },
    ...content,
  };
}

export const serialize = (obj) => `${JSON.stringify(obj, null, 2)}\n`;

export function registerErrorCount(manifest) {
  return manifest.pages.reduce((n, p) => n + (p.register?.errors.length ?? 0), 0);
}

// ------------------------------------------------------------ diff

function readManifest(file) {
  let text;
  try {
    if (statSync(file).size > MAX_MANIFEST_BYTES) throw new Error(`larger than ${MAX_MANIFEST_BYTES} bytes`);
    text = readFileSync(file, 'utf8');
  } catch (err) {
    throw new ExtractError(`cannot read ${file}: ${err.message}`);
  }
  return parseManifest(text, file);
}

export function parseManifest(text, label = 'manifest') {
  let m;
  try {
    m = JSON.parse(text);
  } catch (err) {
    throw new ExtractError(`${label} is not valid JSON: ${err.message}`);
  }
  if (!m || m.schema !== MANIFEST_SCHEMA || !Array.isArray(m.pages) || !m.source || typeof m.source.sha !== 'string') {
    throw new ExtractError(`${label} is not a ${MANIFEST_SCHEMA} manifest`);
  }
  for (const p of m.pages) {
    if (!p || typeof p.path !== 'string' || typeof p.blobSha !== 'string' || !Array.isArray(p.links)) throw new ExtractError(`${label} has a malformed page entry`);
  }
  return m;
}

const rowKey = (r) => JSON.stringify([r.claim, r.source, r.status]);
const stripRow = (r) => ({ claim: r.claim, source: r.source, status: r.status });

export function diffManifests(a, b) {
  const pa = new Map(a.pages.map((p) => [p.path, p]));
  const pb = new Map(b.pages.map((p) => [p.path, p]));
  const pagesAdded = [...pb.keys()].filter((k) => !pa.has(k)).sort(byString);
  const pagesRemoved = [...pa.keys()].filter((k) => !pb.has(k)).sort(byString);
  const changed = [];
  for (const path of [...pa.keys()].filter((k) => pb.has(k)).sort(byString)) {
    const x = pa.get(path);
    const y = pb.get(path);
    const xl = new Set(x.links.map((l) => l.url));
    const yl = new Set(y.links.map((l) => l.url));
    const xr = new Map((x.register?.rows ?? []).map((r) => [rowKey(r), r]));
    const yr = new Map((y.register?.rows ?? []).map((r) => [rowKey(r), r]));
    const entry = {
      path,
      blobSha: x.blobSha !== y.blobSha ? { from: x.blobSha, to: y.blobSha } : undefined,
      banner: (x.banner?.text ?? null) !== (y.banner?.text ?? null) ? { from: x.banner?.text ?? null, to: y.banner?.text ?? null } : undefined,
      linksAdded: y.links.filter((l) => !xl.has(l.url)).map((l) => ({ url: l.url, kind: l.kind, id: l.id })),
      linksRemoved: x.links.filter((l) => !yl.has(l.url)).map((l) => ({ url: l.url, kind: l.kind, id: l.id })),
      registerAdded: [...yr.keys()].filter((k) => !xr.has(k)).sort(byString).map((k) => stripRow(yr.get(k))),
      registerRemoved: [...xr.keys()].filter((k) => !yr.has(k)).sort(byString).map((k) => stripRow(xr.get(k))),
    };
    const any = entry.blobSha || entry.banner || entry.linksAdded.length || entry.linksRemoved.length || entry.registerAdded.length || entry.registerRemoved.length;
    if (any) changed.push(entry);
  }
  const ver = (m) => m.provenance?.transformation?.version ?? null;
  return {
    schema: DIFF_SCHEMA,
    from: { repo: a.source.repo, sha: a.source.sha, extractorVersion: ver(a) },
    to: { repo: b.source.repo, sha: b.source.sha, extractorVersion: ver(b) },
    pagesAdded,
    pagesRemoved,
    changed,
  };
}

// ------------------------------------------------------------ CLI

const USAGE = `usage:
  node scripts/extract-references.mjs --pin <pin.json> --repo <clone> [--out <file>] [--only-pinned] [--strict] [--run-info <file> [--executor <label>]]
  node scripts/extract-references.mjs --diff <a.json> <b.json> [--out <file>]
  node scripts/extract-references.mjs --version`;

export function parseArgs(argv) {
  const opts = { onlyPinned: false, strict: false };
  const valueFlags = { '--pin': 'pin', '--repo': 'repo', '--out': 'out', '--run-info': 'runInfo', '--executor': 'executor' };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--version') opts.version = true;
    else if (a === '--only-pinned') opts.onlyPinned = true;
    else if (a === '--strict') opts.strict = true;
    else if (a === '--diff') {
      if (i + 2 >= argv.length) throw new ExtractError(`--diff needs two files\n${USAGE}`);
      opts.diff = [argv[i + 1], argv[i + 2]];
      i += 2;
    } else if (valueFlags[a]) {
      if (i + 1 >= argv.length) throw new ExtractError(`${a} needs a value\n${USAGE}`);
      opts[valueFlags[a]] = argv[i + 1];
      i += 1;
    } else throw new ExtractError(`unknown argument ${JSON.stringify(a)}\n${USAGE}`);
  }
  if (!opts.version && !opts.diff && !(opts.pin && opts.repo)) throw new ExtractError(USAGE);
  return opts;
}

function emit(text, out) {
  if (out) writeFileSync(out, text);
  else process.stdout.write(text);
}

export function main(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  if (opts.version) {
    process.stdout.write(`${TOOL} ${VERSION}\n`);
    return 0;
  }
  if (opts.diff) {
    const d = diffManifests(readManifest(opts.diff[0]), readManifest(opts.diff[1]));
    emit(serialize(d), opts.out);
    process.stderr.write(`diff ${d.from.sha.slice(0, 12)}..${d.to.sha.slice(0, 12)}: +${d.pagesAdded.length} -${d.pagesRemoved.length} pages, ${d.changed.length} changed\n`);
    return 0;
  }
  let pinText;
  try {
    pinText = readFileSync(opts.pin, 'utf8');
  } catch (err) {
    throw new ExtractError(`cannot read pin ${opts.pin}: ${err.message}`);
  }
  const manifest = extract({ pinText, repoDir: opts.repo, onlyPinned: opts.onlyPinned });
  const text = serialize(manifest);
  emit(text, opts.out);
  if (opts.runInfo) {
    const info = {
      manifestSha256: createHash('sha256').update(text).digest('hex'),
      tool: TOOL,
      version: VERSION,
      executor: opts.executor ?? 'unspecified',
      ranAt: new Date().toISOString(),
      node: process.version,
    };
    writeFileSync(opts.runInfo, serialize(info));
  }
  const errors = registerErrorCount(manifest);
  process.stderr.write(`${TOOL} ${VERSION}: ${manifest.pages.length} pages, ${manifest.skipped.length} skipped, ${errors} register errors, content sha256 ${manifest.provenance.contentSha256}\n`);
  if (opts.strict && errors > 0) {
    process.stderr.write('--strict: the "Claims register" format did not match on some pages (see register.errors)\n');
    return 1;
  }
  return 0;
}

export function invokedAsCli(moduleUrl, argv1 = process.argv[1]) {
  if (!argv1) return false;
  try {
    return realpathSync(argv1) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}

if (invokedAsCli(import.meta.url)) {
  try {
    process.exitCode = main();
  } catch (err) {
    process.stderr.write(`${err instanceof ExtractError ? err.message : err.stack}\n`);
    process.exitCode = err instanceof ExtractError ? err.exitCode : 2;
  }
}
