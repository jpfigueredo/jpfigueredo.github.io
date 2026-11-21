// Output helpers shared by the dependency gates. Pure module: no side effects
// on import, no main. CI copies it from the PR's base branch next to the gate
// scripts (see ci.yml).
//
// Everything a gate prints comes partly from the PR (lockfiles, allowlists)
// and from registries. Every value is escaped for where it goes: workflow
// command data (`::error::...`), plain log lines and the Markdown job
// summary. A newline in a value could otherwise start a new workflow command
// (for example `::stop-commands::`).

// Workflow command data: GitHub decodes %25, %0D, %0A back, so a value can
// never end the command line.
export const escapeData = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
export const annotation = (level, title, message) => `::${level} title=${title}::${escapeData(message)}`;
// Plain log line: no line breaks.
export const oneLine = (s) => String(s).replace(/[\r\n\u2028\u2029]+/g, ' ');
// Markdown table cell / list item: one line, no table or HTML breakout.
export const md = (s) => oneLine(s).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/`/g, "'");

// Allowlist entries of the head that are not, byte for byte (keys sorted),
// in the base allowlist: added or changed by this change. They take effect
// in the same run, so a human has to approve them; the gate points them out.
export function changedAllowlistEntries(headText, baseText) {
  const canonical = (e) => JSON.stringify(e, Object.keys(e ?? {}).sort());
  const entriesOf = (text) => {
    try {
      const doc = JSON.parse(text ?? 'null');
      return Array.isArray(doc?.entries) ? doc.entries.filter((e) => e && typeof e === 'object') : [];
    } catch {
      return [];
    }
  };
  const before = new Set(entriesOf(baseText).map(canonical));
  return entriesOf(headText).filter((e) => !before.has(canonical(e)));
}
