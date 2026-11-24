#!/usr/bin/env node
// Reference extractor: reads the Markdown pages of an open-source repository
// pinned by commit SHA and writes a deterministic JSON manifest of what each
// page cites (links classified by kind, with a canonical id where one exists),
// its headings, its status banner, its "Claims register" table and its "Next:"
// pointers. A second mode compares two manifests.
//
// The pages and the clone are third-party content and are treated as
// untrusted input:
//   - nothing from the source repository is executed, and git never runs in
//     the clone or reads its config: objects are read through a temp bare
//     repository whose alternates point at the clone's objects, with a
//     minimal environment (see "reading the clone" below);
//   - HEAD must equal the pinned SHA; every object read (the commit, the
//     trees down to pagesDir, each page blob) is re-hashed and must match its
//     name, and each pinned page must have its pinned blob SHA;
//   - a page larger than MAX_PAGE_BYTES, or not valid UTF-8, is skipped and
//     listed under `skipped`;
//   - hidden content (HTML comments, processing instructions, declarations,
//     CDATA) is removed where a renderer would hide it, before and after
//     invisible and control characters (bidi overrides, zero-width, tag
//     characters, ...), so text hidden from a reader of the rendered page does
//     not reach the manifest;
//   - only http(s) URLs are kept, after Markdown entity and backslash
//     decoding; javascript:, data:, file: and every other scheme, URLs with
//     credentials and over-long URLs are counted under `rejectedLinks` by
//     reason only, the URL itself is dropped;
//   - no eval, no dynamic import; every regular expression is anchored or
//     bounded and has no nested or overlapping quantifiers (see the ReDoS
//     tests). Link and hidden-content parsing are linear scanners.
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
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { codeSpans, fenceStep, maskCodeSpans, splitCells, startsTable, stripHidden } from './lib/markdown-hidden.mjs';

export { stripHidden };

export const VERSION = '1.2.0';
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

function removeInvisible(text) {
  let count = 0;
  const kept = [];
  for (const ch of text) {
    if (isInvisible(ch.codePointAt(0))) count += 1;
    else kept.push(ch);
  }
  return { text: kept.join(''), count };
}

const MAX_HIDDEN_PASSES = 16;

// Order: hidden constructs are removed from the raw text, then invisible
// characters, then hidden constructs again, until nothing changes. The first
// pass runs on the raw text so an invisible character inside a terminator
// (`-<ZWSP>->`) cannot close a comment early; the later passes catch openers
// that only form once invisible characters or inner constructs are gone
// (`<!-<ZWSP>-`, `<!<!-- a -->-- b -->`). Removing too much is the safe side.
// If the text still changes after MAX_HIDDEN_PASSES (only for adversarial
// nesting), every `<!` and `<?` is broken up, which ends the loop. Then NFC.
// The result is a fixed point: sanitize(sanitize(x).text).text equals
// sanitize(x).text.
export function sanitize(raw) {
  let text = raw.replace(/\r\n?/g, '\n');
  let r = stripHidden(text);
  text = r.text;
  let htmlComments = r.removed;
  const inv = removeInvisible(text);
  text = inv.text;
  for (let pass = 0; pass < MAX_HIDDEN_PASSES; pass += 1) {
    r = stripHidden(text);
    if (r.removed === 0) break;
    text = r.text;
    htmlComments += r.removed;
  }
  if (stripHidden(text).removed > 0) text = text.replace(/<(?=[!?])/g, '');
  return { text: text.normalize('NFC'), htmlComments, invisibleChars: inv.count };
}

// ------------------------------------------------------------ inline Markdown

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
const REF_DEFINITION = /^ {0,3}\[([^\]\n]{1,500})\]:[ \t]*(?:<([^<>\n]{0,2048})>|([^\s<>]{1,2048}))/;
const REF_USE = /(!?)\[([^[\]\n]{1,999})\]/g;

export const normalizeLabel = (label) => label.trim().replace(/\s+/g, ' ').toLowerCase();

// A reference definition `[label]: target` on this line, or null.
export function refDefinition(line) {
  const m = REF_DEFINITION.exec(maskCodeSpans(line));
  if (!m) return null;
  return { label: normalizeLabel(m[1]), target: m[2] ?? m[3] };
}

// Every link target in a line (code spans masked), as { raw, decode }:
// inline links and used reference links (decode: Markdown entity and
// backslash decoding applies), autolinks and bare http(s) URLs (taken
// literally). Images are left out. `refs` maps normalized labels to targets;
// a definition only counts where a `[label]` uses it.
export function linkTargets(line, refs = new Map()) {
  const masked = maskCodeSpans(line);
  const targets = [];
  const chars = masked.split('');
  const blank = (s, e) => {
    for (let k = s; k < e; k += 1) chars[k] = ' ';
  };
  for (const link of scanInlineLinks(masked)) {
    if (!link.image) targets.push({ raw: link.dest, decode: true });
    blank(link.start, link.end);
  }
  if (refs.size > 0) {
    for (const m of chars.join('').matchAll(REF_USE)) {
      const target = refs.get(normalizeLabel(m[2]));
      if (target === undefined) continue;
      if (!m[1]) targets.push({ raw: target, decode: true });
      blank(m.index, m.index + m[0].length);
    }
  }
  for (const m of chars.join('').matchAll(AUTOLINK)) {
    targets.push({ raw: m[1], decode: false });
    blank(m.index, m.index + m[0].length);
  }
  for (const m of chars.join('').matchAll(BARE_URL)) {
    targets.push({ raw: trimTrailingPunctuation(m[0]), decode: false });
  }
  return targets;
}

const NAMED_ENTITIES = new Map([
  ['amp', '&'], ['lt', '<'], ['gt', '>'], ['quot', '"'], ['apos', "'"], ['colon', ':'], ['sol', '/'],
  ['lpar', '('], ['rpar', ')'], ['period', '.'], ['comma', ','], ['semi', ';'], ['excl', '!'],
  ['quest', '?'], ['num', '#'], ['percnt', '%'], ['equals', '='], ['plus', '+'], ['lowbar', '_'],
  ['hyphen', '-'], ['dash', '-'], ['Tab', String.fromCharCode(9)], ['NewLine', String.fromCharCode(10)],
]);
// Backslash escapes and character references in one pass, so the output of
// one is never read again by the other (`\\&#58;` stays `&#58;`, `&amp;#58;`
// stays `&#58;`).
const ESCAPE_OR_ENTITY = /\\([!-/:-@[-`{-~])|&(?:#([0-9]{1,7})|#[xX]([0-9a-fA-F]{1,6})|([A-Za-z][A-Za-z0-9]{1,31}));/g;

// What a Markdown renderer makes of a link destination: backslash escapes
// and character references decoded (so `javascript&#58;` is seen as
// `javascript:`). Returns null when it holds a named reference outside the
// small table above: such a target is rejected rather than guessed.
export function decodeTarget(raw) {
  if (!raw.includes('&') && !raw.includes('\\')) return raw;
  let unknown = false;
  const decoded = raw.replace(ESCAPE_OR_ENTITY, (_, escaped, dec, hex, name) => {
    if (escaped !== undefined) return escaped;
    if (name !== undefined) {
      const v = NAMED_ENTITIES.get(name);
      if (v === undefined) unknown = true;
      return v ?? '';
    }
    const cp = dec !== undefined ? Number(dec) : Number.parseInt(hex, 16);
    return cp === 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff) ? String.fromCharCode(0xfffd) : String.fromCodePoint(cp);
  });
  return unknown ? null : decoded;
}

function trimTrailingPunctuation(url) {
  let end = url.length;
  while (end > 0 && '.,;:!?*_~'.includes(url[end - 1])) end -= 1;
  return url.slice(0, end);
}

const HTML_TAG = /<\/?[A-Za-z][A-Za-z0-9-]{0,30}(?:\s[^<>]{0,500})?\/?>/g;

// Plain text of a Markdown fragment: links become their text, HTML tags and
// emphasis markers go outside code spans, code spans keep their content as
// written (`<forward>`, `*.tfvars`), whitespace collapses; capped at `max`.
export function plainText(fragment, max = MAX_FIELD_CHARS) {
  const pieces = [];
  let at = 0;
  for (const { start, end, text, image } of scanInlineLinks(maskCodeSpans(fragment))) {
    const textStart = start + (image ? 2 : 1);
    pieces.push(fragment.slice(at, start), image ? '' : fragment.slice(textStart, textStart + text.length));
    at = end;
  }
  pieces.push(fragment.slice(at));
  const joined = pieces.join('');
  const clean = (t) => t.replace(HTML_TAG, ' ').replace(/\*+|__|`/g, '');
  const out = [];
  at = 0;
  for (const { start, end, open } of codeSpans(joined)) {
    out.push(clean(joined.slice(at, start)));
    let code = joined.slice(start + open, end - open);
    if (code.length > 1 && code.startsWith(' ') && code.endsWith(' ') && code.trim() !== '') code = code.slice(1, -1);
    out.push(code);
    at = end;
  }
  out.push(clean(joined.slice(at)));
  const s = out.join('').replace(/\s+/g, ' ').trim();
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
//   { type: 'url', url, kind, id?, revision?, stage? }   an http(s) URL;
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
    if (host === 'nvd.nist.gov') return cveId(host, segs, u.searchParams) ?? { kind: 'nist' };
    const doc = nistDocument(host, segs);
    if (doc) return doc;
    return { kind: 'nist' };
  }
  if (host === 'attack.mitre.org') return { kind: 'attack', ...attackId(segs) };
  const cve = cveId(host, segs, u.searchParams);
  if (cve) return cve;
  if (hostIs(host, 'cisa.gov') || hostIs(host, 'us-cert.gov')) return { kind: 'cisa', ...cisaId(segs) };
  if (VENDOR_HOSTS.includes(host) || VENDOR_DOMAINS.some((d) => hostIs(host, d))) return { kind: 'vendor' };
  return { kind: 'other' };
}

// CVE records: nvd.nist.gov/vuln/detail/CVE-..., cve.org/CVERecord?id=CVE-...,
// cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-...
const CVE_RE = /^CVE-\d{4}-\d{4,7}$/i;
function cveId(host, segs, params) {
  let cand;
  if (host === 'nvd.nist.gov' && segs[0] === 'vuln' && segs[1] === 'detail') cand = segs[2];
  else if (host === 'cve.org') cand = params.get('id') ?? undefined;
  else if (host === 'cve.mitre.org') cand = params.get('name') ?? undefined;
  else return null;
  return cand && CVE_RE.test(cand) ? { kind: 'cve', id: cand.toUpperCase() } : { kind: 'cve' };
}

function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

// NIST publication ids. Work-level id (`SP 800-57 Part 1`, `FIPS 197`,
// `IR 8547`); revision and stage go to their own fields (`5`, `ipd`).
function nistDocument(host, segs) {
  // doi.org/10.6028/NIST.SP.800-57pt1r5 and nvlpubs .../NIST.SP.800-38D.pdf
  const last = segs[segs.length - 1] ?? '';
  const named = segs[0] === '10.6028' ? segs[1] ?? '' : last;
  if (/^NIST\./i.test(named)) return fromNistName(named.replace(/\.pdf$/i, ''));
  // nvlpubs .../Legacy/SP/nistspecialpublication800-34r1.pdf
  const legacy = /^nistspecialpublication800-(\d{1,4})([a-z])?(?:r(\d{1,2}))?\.pdf$/i.exec(last);
  if (legacy) return { kind: 'nist', id: spId(legacy[1], legacy[2]), ...edition(legacy[3]) };
  // pages.nist.gov/800-63-4/sp800-63b.html: the HTML edition of SP 800-63B-4
  if (host === 'pages.nist.gov') {
    const rev = /^800-63-(\d{1,2})$/.exec(segs[0] ?? '');
    if (!rev) return null;
    const vol = /^sp800-63([a-c])?(?:\.html)?$/i.exec(segs[1] ?? '');
    return { kind: 'nist', id: `SP 800-63${vol?.[1] ? vol[1].toUpperCase() : ''}-${rev[1]}` };
  }
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

// Revision and stage of a publication, as separate fields: `revision: '5'`,
// `stage: 'ipd'`. A final publication has no stage.
function edition(rev, stage) {
  const out = {};
  if (rev) out.revision = rev;
  const st = stageLabel(stage);
  if (st) out.stage = st;
  return out;
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
  // fips/140/3/final is FIPS 140-3
  if (series === 'fips' && /^\d{1,3}$/.test(parts[0] ?? '') && /^\d{1,2}$/.test(parts[1] ?? '')) parts.splice(0, 2, `${parts[0]}-${parts[1]}`);
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
    // fips/140/3/final and fips/140-3/final are both FIPS 140-3
    const full = /^\d{1,3}$/.test(name) && /^\d{1,2}$/.test(tail[0] ?? '') ? `${name}-${tail[0]}` : name;
    const m = /^(\d{1,3}(?:-\d{1,2})?)$/.exec(full);
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
  const versioned = ver ? { revision: ver } : {};
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
  // "not read", "never read", "not yet read", "not re-read", "not reread"
  take('\\b(?:not|never)(?: yet)? (?:re-?)?read\\b', 'not-read');
  take('\\b(?:not|never)(?: yet)? (?:re-?)?run\\b|\\bnothing (?:was )?run\\b', 'not-run');
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

const ATX = /^ {0,3}(#{1,6})(?:[ \t]|$)/;
const NEXT = /^(?:>[ \t]?)?(?:\*\*|__)?next(?::(?:\*\*|__)?|(?:\*\*|__):)/i;
const MAX_FRONT_MATTER_LINES = 200;

function headingText(line, hashes) {
  let rest = line.trimStart().slice(hashes.length).trim();
  // closing sequence: spaces then #s at the end
  let end = rest.length;
  while (end > 0 && rest[end - 1] === '#') end -= 1;
  if (end < rest.length && (end === 0 || rest[end - 1] === ' ' || rest[end - 1] === '\t')) rest = rest.slice(0, end).trim();
  return rest;
}

const byString = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Number of lines of a YAML front matter block (`---` ... `---` or `...`) at
// the top of the page, or 0. Front matter is metadata, not page text: its
// lines are not read.
function frontMatterLines(lines) {
  if (lines[0] !== '---') return 0;
  const last = Math.min(lines.length, MAX_FRONT_MATTER_LINES);
  for (let k = 1; k < last; k += 1) if (lines[k] === '---' || lines[k] === '...') return k + 1;
  return 0;
}

// Parses one sanitized page. `path` is its repository path (for resolving
// relative links).
//
// "Claims register" table: the first table after a heading "Claims register",
// up to the next heading of the same or a higher level. Columns are named by
// their header cell. `claim` is required (without it no row is kept), `source`
// and `status` are read when present (null otherwise), any other column goes
// to `row.extra`. A header other than Claim | Source | Status gives one
// `missing-column` error per missing name; a row whose cell count differs
// from the header (cells split as GitHub does) is a `cell-count` error and
// keeps no row. Either way the links in every cell are kept: in the page's
// `links[]` (with the register `columns` they came from) and, for kept rows,
// in `row.links` with their column. `--strict` fails on any register error.
export function parsePage(path, text) {
  const lines = text.split('\n');
  const skipTo = frontMatterLines(lines);
  const headings = [];
  const linkCounts = new Map();
  const rejected = new Map();
  const pageLinks = new Set();
  const fileLinks = new Set();
  const next = [];
  const nextSeen = new Set();
  let banner = null;
  let register = null;
  let reg = null; // { level, phase: 'seek' | 'sep' | 'rows' | 'done', headingLine, columns, idx }

  // Reference definitions first (they may come after their use); the first
  // definition of a label wins. Definition lines are not read as text.
  const refs = new Map();
  const defLines = new Set();
  let fence = null;
  for (let idx = skipTo; idx < lines.length; idx += 1) {
    const step = fenceStep(fence, lines[idx]);
    fence = step.fence;
    if (step.code) continue;
    const def = refDefinition(lines[idx]);
    if (def) {
      if (!refs.has(def.label)) refs.set(def.label, def.target);
      defLines.add(idx);
    }
  }

  const count = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);
  const addTarget = ({ raw, decode }, sink, column) => {
    let target = raw;
    if (decode) {
      target = decodeTarget(raw);
      if (target === null) return count(rejected, 'entity');
      for (const ch of target) if (isInvisible(ch.codePointAt(0))) return count(rejected, 'invisible');
    }
    const c = classifyTarget(target);
    if (c.type === 'url') {
      let rec = linkCounts.get(c.url);
      if (!rec) {
        rec = { url: c.url, kind: c.kind, id: c.id, revision: c.revision, stage: c.stage, count: 0, columns: new Set() };
        linkCounts.set(c.url, rec);
      }
      rec.count += 1;
      if (column !== undefined) rec.columns.add(column);
      sink?.urls.push({ column, url: c.url, kind: c.kind, id: c.id, revision: c.revision, stage: c.stage });
    } else if (c.type === 'page') {
      const p = resolvePageLink(path, c.path);
      if (!p) return undefined;
      if (p.toLowerCase().endsWith('.md')) {
        pageLinks.add(p);
        sink?.pages.push(p);
      } else fileLinks.add(p);
    } else count(rejected, c.reason);
    return undefined;
  };

  const finishRegister = () => {
    if (reg?.phase === 'seek') register.errors.push({ line: reg.headingLine, reason: 'no-table' });
    reg = null;
  };

  // One register row: every cell's links are kept; the row itself only when
  // its cell count matches the header and it has a claim.
  const registerRow = (line, lineNo) => {
    const cells = splitCells(line);
    const { columns, idx } = reg;
    const sink = { urls: [], pages: [] };
    cells.forEach((cell, i) => {
      for (const t of linkTargets(cell, refs)) addTarget(t, sink, columns[i] ?? `cell-${i + 1}`);
    });
    if (cells.length !== columns.length) {
      register.errors.push({ line: lineNo, reason: 'cell-count', expected: columns.length, got: cells.length });
      return;
    }
    if (idx.claim === -1) return;
    const claim = plainText(cells[idx.claim]);
    if (claim === '') {
      register.errors.push({ line: lineNo, reason: 'empty-claim' });
      return;
    }
    const status = idx.status === -1 ? null : plainText(cells[idx.status]);
    const extra = {};
    columns.forEach((name, i) => {
      if (i !== idx.claim && i !== idx.source && i !== idx.status) extra[name] = plainText(cells[i]);
    });
    register.rows.push({
      line: lineNo,
      claim,
      source: idx.source === -1 ? null : plainText(cells[idx.source]),
      status,
      statusTags: status === null ? [] : statusTags(status),
      extra: Object.keys(extra).length ? extra : undefined,
      links: dedupeRowLinks(sink.urls),
    });
  };

  fence = null;
  for (let idx = skipTo; idx < lines.length; idx += 1) {
    const lineNo = idx + 1;
    const line = lines[idx];

    const step = fenceStep(fence, line);
    fence = step.fence;
    if (step.code) continue;
    if (defLines.has(idx)) continue;

    const h = ATX.exec(line);
    if (h) {
      const level = h[1].length;
      const textH = plainText(headingText(line, h[1]), MAX_FIELD_CHARS);
      headings.push({ level, text: textH });
      if (reg && level <= reg.level) finishRegister();
      if (!register && textH.toLowerCase() === REGISTER_HEADING) {
        register = { line: lineNo, columns: null, rows: [], errors: [] };
        reg = { level, phase: 'seek', headingLine: lineNo };
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
    if (reg && reg.phase !== 'done') {
      const isRow = line.trim().startsWith('|');
      if (reg.phase === 'seek' && isRow) {
        if (!startsTable(line, lines[idx + 1])) {
          register.errors.push({ line: lineNo, reason: 'no-separator' });
          reg.phase = 'done';
        } else {
          const columns = splitCells(line).map((c) => plainText(c).toLowerCase());
          const idxOf = (name) => columns.indexOf(name);
          reg.columns = columns;
          reg.idx = { claim: idxOf('claim'), source: idxOf('source'), status: idxOf('status') };
          register.columns = columns;
          for (const name of ['claim', 'source', 'status']) {
            if (reg.idx[name] === -1) register.errors.push({ line: lineNo, reason: 'missing-column', column: name });
          }
          reg.phase = 'sep';
          continue;
        }
      } else if (reg.phase === 'sep') {
        reg.phase = 'rows';
        continue;
      } else if (reg.phase === 'rows') {
        if (isRow) {
          registerRow(line, lineNo);
          continue;
        }
        reg.phase = 'done';
      }
    }

    const targets = linkTargets(line, refs);
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
    fileLinks: [...fileLinks].sort(byString),
    next,
    register,
    rejectedLinks: [...rejected.entries()].sort((a, b) => byString(a[0], b[0])).map(([reason, n]) => ({ reason, count: n })),
  };
}

function linkRecord({ url, kind, id, revision, stage, count, columns }) {
  return { url, kind, id, revision, stage, count, columns: columns.size ? [...columns].sort(byString) : undefined };
}

function dedupeRowLinks(urls) {
  const seen = new Map();
  for (const u of urls) {
    const key = JSON.stringify([u.column, u.url]);
    if (!seen.has(key)) seen.set(key, u);
  }
  return [...seen.values()].sort((a, b) => byString(a.column, b.column) || byString(a.url, b.url));
}

// ------------------------------------------------------------ reading the clone
//
// The clone is untrusted too: its .git/config can name programs that git runs
// (gpg.program with log.showSignature, include.path, core.fsmonitor,
// core.sshCommand, hooks), and its object store can hold replace refs or a
// rewritten loose object under a valid name. So:
//   - git never runs inside the clone and never reads its config. Objects are
//     read through a new, empty bare repository in a temp dir whose
//     objects/info/alternates points at <clone>/.git/objects;
//   - git gets an explicit minimal environment (no inherited GIT_*), no system
//     or global config, replace objects off, lazy fetch off and
//     protocol.allow=never;
//   - every object read is re-hashed here (SHA-1 of "<type> <size>\0" plus the
//     content) and must equal the name it was asked for: the pinned commit,
//     each tree on the way to pagesDir, and every page blob. A mismatch is
//     exit 1;
//   - HEAD and refs/replace are read as files, not through git.

const SHA_RE = /^[0-9a-f]{40}$/;
const PIN_KEYS = ['repo', 'sha', 'date', 'license', 'pagesDir', 'pages'];
const MAX_OBJECT_BYTES = 16 * 1024 * 1024;

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

// SHA-1 object name of `content` as a git object of `type`.
export function gitObjectSha(type, content) {
  return createHash('sha1').update(`${type} ${content.length}\0`).update(content).digest('hex');
}

// The clone's .git directory: a real directory (not a `gitdir:` file or a
// symlink) directly in `root`.
function cloneGitDir(root) {
  const gitDir = join(root, '.git');
  let st;
  try {
    st = lstatSync(gitDir);
  } catch {
    throw new ExtractError(`${root} is not the top of a git clone (no .git directory)`);
  }
  if (!st.isDirectory()) throw new ExtractError(`${gitDir} must be a directory (worktrees and gitdir files are not supported)`);
  return gitDir;
}

const MAX_REF_FILE_BYTES = 4096;
const MAX_PACKED_REFS_BYTES = 64 * 1024 * 1024;

// A regular file of the clone's .git (not a symlink, not a directory), at
// most `max` bytes; null when it does not exist. Its content never goes into
// an error message.
function readGitFile(path, max, what) {
  let st;
  try {
    st = lstatSync(path);
  } catch {
    return null;
  }
  if (!st.isFile()) throw new ExtractError(`${what} of the clone is not a regular file`);
  if (st.size > max) throw new ExtractError(`${what} of the clone is larger than ${max} bytes`);
  return readFileSync(path, 'utf8');
}

// HEAD of the clone, read as files: a detached SHA, or a ref resolved from
// its loose file or packed-refs.
function readHead(gitDir) {
  const text = readGitFile(join(gitDir, 'HEAD'), MAX_REF_FILE_BYTES, 'HEAD');
  if (text === null) throw new ExtractError('the clone has no HEAD');
  const head = text.trim();
  if (SHA_RE.test(head)) return head;
  const m = /^ref: (refs\/[A-Za-z0-9._/-]{1,200})$/.exec(head);
  if (!m || m[1].split('/').includes('..')) throw new ExtractError('HEAD of the clone is neither a SHA nor a ref under refs/');
  const loose = readGitFile(join(gitDir, m[1]), MAX_REF_FILE_BYTES, 'the ref HEAD points to');
  if (loose !== null && SHA_RE.test(loose.trim())) return loose.trim();
  const packed = readGitFile(join(gitDir, 'packed-refs'), MAX_PACKED_REFS_BYTES, 'packed-refs');
  for (const line of (packed ?? '').split('\n')) {
    const [sha, name] = line.split(' ');
    if (name === m[1] && SHA_RE.test(sha)) return sha;
  }
  throw new ExtractError('cannot resolve the ref HEAD of the clone points to');
}

// Replace refs would make git hand out other content under a pinned name.
// The reader below ignores them anyway; their presence is refused loudly.
function refuseReplaceRefs(gitDir) {
  const found = [];
  const walk = (dir, rel) => {
    let names;
    try {
      names = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const d of names) {
      if (d.isDirectory()) walk(join(dir, d.name), `${rel}/${d.name}`);
      else found.push(`${rel}/${d.name}`);
    }
  };
  walk(join(gitDir, 'refs', 'replace'), 'refs/replace');
  const packed = readGitFile(join(gitDir, 'packed-refs'), MAX_PACKED_REFS_BYTES, 'packed-refs');
  for (const line of (packed ?? '').split('\n')) {
    const name = line.split(' ')[1];
    if (name?.startsWith('refs/replace/')) found.push(name);
  }
  if (found.length) throw new ExtractError(`the clone has replace refs (${found.slice(0, 3).join(', ')}); refusing to read it`, 1);
}

// A reader over the clone's objects through a temp bare repository.
function objectReader(gitDir) {
  const objects = realpathSync(join(gitDir, 'objects'));
  if (/[\n\r]/.test(objects)) throw new ExtractError('the object directory path contains a newline');
  const bare = mkdtempSync(join(tmpdir(), 'extract-references-'));
  for (const d of ['objects/info', 'objects/pack', 'refs/heads', 'refs/tags']) mkdirSync(join(bare, d), { recursive: true });
  writeFileSync(join(bare, 'HEAD'), 'ref: refs/heads/main\n');
  writeFileSync(join(bare, 'config'), '[core]\n\trepositoryformatversion = 0\n\tbare = true\n');
  writeFileSync(join(bare, 'objects', 'info', 'alternates'), `${objects}\n`);
  const env = {
    PATH: process.env.PATH ?? '/usr/bin:/bin',
    HOME: bare,
    LC_ALL: 'C',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_NO_REPLACE_OBJECTS: '1',
    GIT_NO_LAZY_FETCH: '1',
  };
  const read = (type, sha) => {
    let buf;
    try {
      buf = execFileSync('git', [`--git-dir=${bare}`, '-c', 'protocol.allow=never', 'cat-file', type, sha], {
        cwd: bare,
        env,
        maxBuffer: MAX_OBJECT_BYTES,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      if (err.code === 'ENOBUFS') {
        if (type === 'blob') return null;
        throw new ExtractError(`${type} ${sha} is larger than ${MAX_OBJECT_BYTES} bytes`);
      }
      const stderr = err.stderr ? err.stderr.toString().trim().split('\n').slice(-1)[0] : err.message;
      throw new ExtractError(`git cat-file ${type} ${sha} failed: ${stderr}`);
    }
    const actual = gitObjectSha(type, buf);
    if (actual !== sha) throw new ExtractError(`object ${sha} (${type}) does not hash to its name (content hashes to ${actual}); the clone's object store was altered`, 1);
    return buf;
  };
  return { read, close: () => rmSync(bare, { recursive: true, force: true }) };
}

// Commit date (YYYY-MM-DD, in the committer's own time zone) and tree.
export function parseCommit(buf) {
  const text = buf.toString('utf8');
  const headerEnd = text.indexOf('\n\n');
  const headers = (headerEnd === -1 ? text : text.slice(0, headerEnd)).split('\n');
  const tree = /^tree ([0-9a-f]{40})$/.exec(headers[0] ?? '')?.[1];
  const committer = headers.find((h) => h.startsWith('committer '));
  const when = committer && / (\d{1,15}) ([+-])(\d{2})(\d{2})$/.exec(committer);
  if (!tree || !when) throw new ExtractError('the pinned commit has no tree or committer line', 1);
  const offset = (when[2] === '-' ? -1 : 1) * (Number(when[3]) * 3600 + Number(when[4]) * 60);
  const date = new Date((Number(when[1]) + offset) * 1000).toISOString().slice(0, 10);
  return { tree, date };
}

// Entries of a raw tree object: { mode, name, sha }.
export function parseTree(buf) {
  const entries = [];
  let i = 0;
  while (i < buf.length) {
    const sp = buf.indexOf(0x20, i);
    const nul = buf.indexOf(0x00, sp + 1);
    if (sp === -1 || nul === -1 || nul + 21 > buf.length) throw new ExtractError('malformed tree object', 1);
    entries.push({ mode: buf.toString('latin1', i, sp), name: buf.toString('utf8', sp + 1, nul), sha: buf.toString('hex', nul + 1, nul + 21) });
    i = nul + 21;
  }
  return entries;
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
  const gitDir = cloneGitDir(root);
  const head = readHead(gitDir);
  if (head !== pin.sha) throw new ExtractError(`HEAD is ${head}, the pin says ${pin.sha}`, 1);
  refuseReplaceRefs(gitDir);

  const reader = objectReader(gitDir);
  try {
    const commit = reader.read('commit', pin.sha);
    const { tree: rootTree, date } = parseCommit(commit);
    if (date !== pin.date) throw new ExtractError(`commit date is ${date}, the pin says ${pin.date}`, 1);

    let treeSha = rootTree;
    for (const seg of pin.pagesDir.split('/')) {
      const entry = parseTree(reader.read('tree', treeSha)).find((e) => e.name === seg);
      if (!entry || entry.mode !== '40000') throw new ExtractError(`${pin.pagesDir} is not a directory in ${pin.sha}`, 1);
      treeSha = entry.sha;
    }
    const entries = [];
    const skipped = [];
    for (const e of parseTree(reader.read('tree', treeSha))) {
      if (!e.name.endsWith('.md')) continue;
      const path = `${pin.pagesDir}/${e.name}`;
      if (e.mode !== '100644' && e.mode !== '100755') skipped.push({ path, blobSha: e.sha, reason: `mode-${e.mode.padStart(6, '0')}` });
      else entries.push({ path, sha: e.sha });
    }
    entries.sort((a, b) => byString(a.path, b.path));

    const byPath = new Map(entries.map((e) => [e.path, e]));
    const mismatches = [];
    for (const p of pin.pages) {
      const e = byPath.get(p.path);
      if (!e) mismatches.push(`${p.path} is not a page in ${pin.sha}`);
      else if (e.sha !== p.blobSha) mismatches.push(`${p.path} is blob ${e.sha}, the pin says ${p.blobSha}`);
    }
    if (mismatches.length) throw new ExtractError(`pinned pages do not match: ${mismatches.join('; ')}`, 1);
    const pinned = new Set(pin.pages.map((p) => p.path));

    const pages = [];
    for (const e of entries) {
      if (onlyPinned && !pinned.has(e.path)) continue;
      const buf = reader.read('blob', e.sha);
      let reason;
      let raw;
      if (buf === null) reason = 'too-large';
      else if (buf.length > MAX_PAGE_BYTES) reason = 'too-large';
      else {
        try {
          raw = UTF8.decode(buf);
        } catch {
          reason = 'invalid-utf8';
        }
      }
      if (reason) {
        if (pinned.has(e.path)) throw new ExtractError(`pinned page ${e.path} cannot be read (${reason})`, 1);
        skipped.push({ path: e.path, blobSha: e.sha, reason, bytes: buf === null ? undefined : buf.length });
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
  } finally {
    reader.close();
  }
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
  if (!m || m.schema !== MANIFEST_SCHEMA || !Array.isArray(m.pages) || !Array.isArray(m.skipped) || !m.source || typeof m.source.sha !== 'string' || typeof m.source.repo !== 'string') {
    throw new ExtractError(`${label} is not a ${MANIFEST_SCHEMA} manifest`);
  }
  for (const p of m.pages) {
    if (!p || typeof p.path !== 'string' || typeof p.blobSha !== 'string' || !Array.isArray(p.links)) throw new ExtractError(`${label} has a malformed page entry`);
  }
  return m;
}


const same = (x, y) => JSON.stringify(x ?? null) === JSON.stringify(y ?? null);
const fromTo = (x, y) => (same(x, y) ? undefined : { from: x ?? null, to: y ?? null });
const linkClass = (l) => ({ kind: l.kind, id: l.id, revision: l.revision, stage: l.stage });
const skipKey = (s) => JSON.stringify([s.path, s.blobSha, s.reason]);
const addedRemoved = (xs, ys) => {
  const a = new Set(xs ?? []);
  const b = new Set(ys ?? []);
  return { added: [...b].filter((v) => !a.has(v)).sort(byString), removed: [...a].filter((v) => !b.has(v)).sort(byString) };
};
const rowLinkKey = (l) => JSON.stringify([l.column ?? null, l.url]);
const errorKey = (e) => JSON.stringify([e.reason, e.column ?? null, e.expected ?? null, e.got ?? null]);
const errorFromKey = (k) => {
  const [reason, column, expected, got] = JSON.parse(k);
  return { reason, column: column ?? undefined, expected: expected ?? undefined, got: got ?? undefined };
};

// Register rows keyed by claim text plus its occurrence number, so a row that
// only moved to another line is the same row.
function rowsByKey(rows) {
  const seen = new Map();
  const out = new Map();
  for (const r of rows ?? []) {
    const n = seen.get(r.claim) ?? 0;
    seen.set(r.claim, n + 1);
    out.set(JSON.stringify([r.claim, n]), r);
  }
  return out;
}

function rowChange(x, y) {
  const links = addedRemoved((x.links ?? []).map(rowLinkKey), (y.links ?? []).map(rowLinkKey));
  const parse = (k) => {
    const [column, url] = JSON.parse(k);
    return { column, url };
  };
  const c = {
    claim: y.claim,
    sourceChanged: fromTo(x.source, y.source),
    statusChanged: fromTo(x.status, y.status),
    extraChanged: fromTo(x.extra, y.extra),
    linksAdded: links.added.map(parse),
    linksRemoved: links.removed.map(parse),
  };
  return c.sourceChanged || c.statusChanged || c.extraChanged || c.linksAdded.length || c.linksRemoved.length ? c : null;
}

// Differences between two manifests: source repo, pages and skipped entries
// added/removed and, per page in both: blob SHA, title, banner, headings,
// next, page and file links, links added/removed or reclassified (kind, id,
// revision, stage), rejected links, sanitizer counts, register rows
// added/removed/changed (source text, status, other columns, links per
// column) and register errors. Line numbers alone are not a change.
export function diffManifests(a, b) {
  const pa = new Map(a.pages.map((p) => [p.path, p]));
  const pb = new Map(b.pages.map((p) => [p.path, p]));
  const pagesAdded = [...pb.keys()].filter((k) => !pa.has(k)).sort(byString);
  const pagesRemoved = [...pa.keys()].filter((k) => !pb.has(k)).sort(byString);
  const changed = [];
  for (const path of [...pa.keys()].filter((k) => pb.has(k)).sort(byString)) {
    const x = pa.get(path);
    const y = pb.get(path);
    const xl = new Map(x.links.map((l) => [l.url, l]));
    const yl = new Map(y.links.map((l) => [l.url, l]));
    const xr = rowsByKey(x.register?.rows);
    const yr = rowsByKey(y.register?.rows);
    const pageLinks = addedRemoved(x.pageLinks, y.pageLinks);
    const fileLinks = addedRemoved(x.fileLinks, y.fileLinks);
    const errors = addedRemoved((x.register?.errors ?? []).map(errorKey), (y.register?.errors ?? []).map(errorKey));
    const entry = {
      path,
      blobSha: fromTo(x.blobSha, y.blobSha),
      title: fromTo(x.title, y.title),
      banner: fromTo(x.banner?.text, y.banner?.text),
      headings: fromTo(x.headings, y.headings),
      next: fromTo(x.next, y.next),
      pageLinksAdded: pageLinks.added,
      pageLinksRemoved: pageLinks.removed,
      fileLinksAdded: fileLinks.added,
      fileLinksRemoved: fileLinks.removed,
      linksAdded: y.links.filter((l) => !xl.has(l.url)).map((l) => ({ url: l.url, ...linkClass(l) })),
      linksRemoved: x.links.filter((l) => !yl.has(l.url)).map((l) => ({ url: l.url, ...linkClass(l) })),
      linksReclassified: x.links
        .filter((l) => yl.has(l.url) && !same(linkClass(l), linkClass(yl.get(l.url))))
        .map((l) => ({ url: l.url, from: linkClass(l), to: linkClass(yl.get(l.url)) })),
      rejectedLinks: fromTo(x.rejectedLinks, y.rejectedLinks),
      sanitized: fromTo(x.sanitized, y.sanitized),
      registerAdded: [...yr.keys()].filter((k) => !xr.has(k)).sort(byString).map((k) => yr.get(k).claim),
      registerRemoved: [...xr.keys()].filter((k) => !yr.has(k)).sort(byString).map((k) => xr.get(k).claim),
      registerChanged: [...xr.keys()].filter((k) => yr.has(k)).sort(byString).map((k) => rowChange(xr.get(k), yr.get(k))).filter(Boolean),
      registerErrorsAdded: errors.added.map(errorFromKey),
      registerErrorsRemoved: errors.removed.map(errorFromKey),
    };
    const any = Object.entries(entry).some(([k, v]) => k !== 'path' && v !== undefined && (!Array.isArray(v) || v.length > 0));
    if (any) changed.push(entry);
  }
  const xs = new Map((a.skipped ?? []).map((s) => [skipKey(s), s]));
  const ys = new Map((b.skipped ?? []).map((s) => [skipKey(s), s]));
  const ver = (m) => m.provenance?.transformation?.version ?? null;
  return {
    schema: DIFF_SCHEMA,
    from: { repo: a.source.repo, sha: a.source.sha, extractorVersion: ver(a) },
    to: { repo: b.source.repo, sha: b.source.sha, extractorVersion: ver(b) },
    repoChanged: a.source.repo !== b.source.repo,
    pagesAdded,
    pagesRemoved,
    skippedAdded: [...ys.keys()].filter((k) => !xs.has(k)).sort(byString).map((k) => ys.get(k)),
    skippedRemoved: [...xs.keys()].filter((k) => !ys.has(k)).sort(byString).map((k) => xs.get(k)),
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
