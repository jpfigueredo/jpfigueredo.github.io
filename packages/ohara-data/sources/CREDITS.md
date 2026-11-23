# Third-party sources

Open sources this package reads references from. Each one is pinned by commit SHA in a `*.pin.json` file
in this directory. This file is not part of the repository's MIT license grant: each source keeps its own
license, listed below.

What is in this repository today: the pin (repository, commit, date, license, page paths and blob SHAs)
and this file. No text, image or diagram from a source is stored here.

What a manifest holds: `scripts/extract-references.mjs` writes a manifest that copies, from each page,
its title, headings, status banner and the text of its "Claims register" rows (claim, source, status),
plus the URLs the page cites. That is text from the source, so a manifest is a derivative of it. No
manifest is versioned in this repository. If one ever is, it must ship with, as required by the
Apache License 2.0:

- a copy of the source's license (section 4(a));
- a prominent notice that the content was extracted and changed from the source at the pinned commit
  (section 4(b));
- the text of the source's `NOTICE` file (section 4(d)), reproduced below for each source.

## Clouds Against Humanity

- Repository: <https://github.com/ChiefGyk3D/Clouds-Against-Humanity>
- Pinned commit: `3e4ad5070e998f049ec588f091d9d7b0646bcfdd` (2026-11-09), see `cah.pin.json`
- License: Apache License 2.0,
  <https://github.com/ChiefGyk3D/Clouds-Against-Humanity/blob/3e4ad5070e998f049ec588f091d9d7b0646bcfdd/LICENSE>
- Used here: page paths and blob SHAs under `docs/wiki/` (in the pin). Manifests made from it are kept
  outside this repository.

`NOTICE` file of the source, at the pinned commit:

```text
Clouds Against Humanity
Copyright 2026 ChiefGyk3D

This product is licensed under the Apache License, Version 2.0 (see LICENSE).
```
