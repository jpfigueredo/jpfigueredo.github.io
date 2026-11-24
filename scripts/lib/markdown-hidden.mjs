// Pure helpers for the parts of Markdown that decide what a reader of the
// rendered page sees: fenced code blocks, inline code spans, GFM table cells
// and hidden HTML (comments, processing instructions, declarations, CDATA).
// Used by scripts/extract-references.mjs; every caller goes through the one
// fence helper and the one code span helper here, so the cleaner and the
// parser cannot disagree about what is code.
//
// No I/O, no dependencies. Every scan is linear in the input.

// ------------------------------------------------------------ fences

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const FENCE_CLOSE = /^(?:`{3,}|~{3,})$/;

// One step of fenced-code tracking. `fence` is the opening run of the block
// the previous line left open (or null). Returns the run left open after this
// line and whether this line is part of a fenced block (opening, content or
// closing line). A closing line has the same character, at least as many of
// them, at most three spaces of indent and nothing else: "```js" inside a
// block does not close it. A backtick opener whose info string contains a
// backtick is not a fence (CommonMark).
export function fenceStep(fence, line) {
  if (fence) {
    const t = line.trim();
    const indent = line.length - line.trimStart().length;
    if (indent <= 3 && t[0] === fence[0] && t.length >= fence.length && FENCE_CLOSE.test(t)) return { fence: null, code: true };
    return { fence, code: true };
  }
  const m = FENCE_OPEN.exec(line);
  if (!m) return { fence: null, code: false };
  if (m[1][0] === '`' && line.slice(m[0].length).includes('`')) return { fence: null, code: false };
  return { fence: m[1], code: true };
}

// ------------------------------------------------------------ code spans

// Inline code spans of one line as { start, end, open } (end exclusive,
// `open` the length of the backtick run). A span is a run of N backticks
// closed by the next run of exactly N backticks; an unmatched run is literal
// text (CommonMark). Linear: runs are matched by length with a queue each.
export function codeSpans(line) {
  if (!line.includes('`')) return [];
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
  const spans = [];
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
    spans.push({ start, end: runs[closeIdx][0] + len, open: len });
    consumedUntil = closeIdx;
  }
  return spans;
}

// The line with every code span (backticks included) replaced by spaces of
// the same length, so positions are kept.
export function maskCodeSpans(line) {
  const spans = codeSpans(line);
  if (spans.length === 0) return line;
  const chars = line.split('');
  for (const { start, end } of spans) for (let k = start; k < end; k += 1) chars[k] = ' ';
  return chars.join('');
}

// ------------------------------------------------------------ GFM tables

// Cell ranges of a table row, as GitHub splits it: on every `|` not preceded
// by a backslash, before any inline parsing (a `|` inside a code span splits
// too; `\|` does not). A leading and a trailing pipe are dropped. Returns
// [{ start, end }] over the original line.
export function cellRanges(line) {
  let start = 0;
  let end = line.length;
  while (start < end && (line[start] === ' ' || line[start] === '\t')) start += 1;
  while (end > start && (line[end - 1] === ' ' || line[end - 1] === '\t')) end -= 1;
  if (line[start] === '|') start += 1;
  if (end > start && line[end - 1] === '|' && line[end - 2] !== '\\') end -= 1;
  const cells = [];
  let from = start;
  for (let i = start; i < end; i += 1) {
    if (line[i] === '|' && line[i - 1] !== '\\') {
      cells.push({ start: from, end: i });
      from = i + 1;
    }
  }
  cells.push({ start: from, end });
  return cells;
}

// Cell texts of a table row: trimmed, `\|` turned into `|`.
export function splitCells(line) {
  return cellRanges(line).map(({ start, end }) => line.slice(start, end).trim().replace(/\\\|/g, '|'));
}

export function isDelimiterRow(line) {
  if (line === undefined || !line.includes('-')) return false;
  const cells = splitCells(line);
  return cells.length > 0 && cells.every((c) => /^:?-{1,200}:?$/.test(c));
}

// A table starts at a line with a pipe followed by a delimiter row with the
// same number of cells, and runs until a blank line.
export function startsTable(line, nextLine) {
  return line.includes('|') && isDelimiterRow(nextLine) && splitCells(line).length === splitCells(nextLine).length;
}

// ------------------------------------------------------------ hidden HTML

// Hidden constructs: raw HTML that a browser does not show. `close: null`
// means the opener is a whole construct by itself (`<!-->` and `<!--->` are
// empty comments).
function hiddenOpenerAt(s, i) {
  if (s.startsWith('<!--', i)) {
    if (s.startsWith('<!-->', i)) return { len: 5, close: null };
    if (s.startsWith('<!--->', i)) return { len: 6, close: null };
    return { len: 4, close: '-->' };
  }
  if (s.startsWith('<![CDATA[', i)) return { len: 9, close: ']]>' };
  if (s.startsWith('<?', i)) return { len: 2, close: '?>' };
  if (s[i + 1] === '!' && /^[A-Za-z]$/.test(s[i + 2] ?? '')) return { len: 2, close: '>' };
  return null;
}

// Prefix after which an opener starts an HTML block: blockquote markers and
// up to three spaces.
const BLOCK_PREFIX = /^(?: {0,3}>)* {0,3}/;
const PARAGRAPH_END = /\n[ \t]*\n/g;

// Removes hidden HTML where a Markdown renderer would hide it:
//   - nothing inside a fenced block or an inline code span is touched;
//   - in a table row, each cell is handled alone (cells are split before code
//     spans, as GitHub does) and a construct must close inside its cell;
//   - an opener at the start of a line, after any `>` markers (an HTML block),
//     hides everything up to its terminator, or to the end of the page;
//   - an opener in the middle of a line hides text only when its terminator
//     comes before the end of the paragraph; otherwise it is literal text.
// Newlines inside a removed range are kept, so line numbers still match the
// source. Returns { text, removed }.
export function stripHidden(text) {
  const lines = text.split('\n');
  const starts = [];
  let offset = 0;
  for (const l of lines) {
    starts.push(offset);
    offset += l.length + 1;
  }
  const cuts = [];
  const closeCache = new Map();
  const findClose = (close, from) => {
    const c = closeCache.get(close);
    if (c && from >= c.from && (c.at === -1 || from <= c.at)) return c.at;
    const at = text.indexOf(close, from);
    closeCache.set(close, { from, at });
    return at;
  };
  let paraCache = null;
  const paragraphEnd = (from) => {
    if (paraCache && from >= paraCache.from && from <= paraCache.at) return paraCache.at;
    PARAGRAPH_END.lastIndex = from;
    const m = PARAGRAPH_END.exec(text);
    const at = m ? m.index : text.length;
    paraCache = { from, at };
    return at;
  };

  // Constructs inside [from, to) of one line that close before `limit`
  // (absolute). Returns the absolute end of a construct that runs past the
  // line, or -1.
  // Code spans are found within [from, to) only: a table cell is parsed on
  // its own, and text already removed does not open a span.
  const scanInline = (line, lineStart, from, to, limitOf) => {
    const seg = line.slice(from, to);
    const masked = maskCodeSpans(seg);
    let j = 0;
    while (j < seg.length) {
      const k0 = masked.indexOf('<', j);
      if (k0 === -1) break;
      const op = hiddenOpenerAt(seg, k0);
      const k = k0 + from;
      if (!op) {
        j = k0 + 1;
        continue;
      }
      const abs = lineStart + k;
      if (op.close === null) {
        cuts.push([abs, abs + op.len]);
        j = k0 + op.len;
        continue;
      }
      const at = findClose(op.close, abs + op.len);
      if (at !== -1 && at + op.close.length <= limitOf(abs)) {
        const end = at + op.close.length;
        cuts.push([abs, end]);
        if (end > lineStart + to) return end;
        j = end - lineStart - from;
        continue;
      }
      j = k0 + 1;
    }
    return -1;
  };

  let fence = null;
  let table = false;
  let block = null; // { start, close }
  let consumedTo = 0;
  for (let li = 0; li < lines.length; li += 1) {
    const line = lines[li];
    const lineStart = starts[li];
    const lineEnd = lineStart + line.length;
    if (consumedTo > lineEnd) continue;
    let col = Math.max(0, consumedTo - lineStart);

    if (block) {
      const at = findClose(block.close, Math.max(block.start, lineStart));
      if (at === -1 || at >= lineEnd) continue;
      cuts.push([block.start, at + block.close.length]);
      col = at + block.close.length - lineStart;
      block = null;
    } else if (col === 0) {
      const step = fenceStep(fence, line);
      fence = step.fence;
      if (step.code) continue;
      if (line.trim() === '') table = false;
      else if (!table && startsTable(line, lines[li + 1])) table = true;
    }

    if (table && col === 0) {
      for (const cell of cellRanges(line)) {
        scanInline(line, lineStart, cell.start, cell.end, () => lineStart + cell.end);
      }
      continue;
    }

    const blockCol = col === 0 ? BLOCK_PREFIX.exec(line)[0].length : -1;
    if (blockCol >= 0 && blockCol < line.length) {
      const op = hiddenOpenerAt(line, blockCol);
      if (op && op.close !== null && maskCodeSpans(line)[blockCol] === '<') {
        const abs = lineStart + blockCol;
        const at = findClose(op.close, abs + op.len);
        if (at === -1 || at >= lineEnd) {
          block = { start: abs, close: op.close };
          continue;
        }
        cuts.push([abs, at + op.close.length]);
        col = at + op.close.length - lineStart;
      }
    }
    const runsTo = scanInline(line, lineStart, col, line.length, (abs) => paragraphEnd(abs));
    if (runsTo !== -1) consumedTo = runsTo;
  }
  if (block) cuts.push([block.start, text.length]);

  if (cuts.length === 0) return { text, removed: 0 };
  const out = [];
  let at = 0;
  for (const [s, e] of cuts) {
    out.push(text.slice(at, s));
    const hidden = text.slice(s, e);
    for (let n = hidden.indexOf('\n'); n !== -1; n = hidden.indexOf('\n', n + 1)) out.push('\n');
    at = e;
  }
  out.push(text.slice(at));
  return { text: out.join(''), removed: cuts.length };
}
