# angular-demo (offline)

This app is built on Angular 17, which is out of support. It is offline until
it is upgraded to a supported Angular version; it will come back upgraded.

While it lives in `archive/`:

- it is not a yarn workspace (`archive/*` is outside `workspaces` in the root
  `package.json`), so its dependencies are not in `yarn.lock`;
- it is not built, linted, tested or deployed, and the site does not link to it;
- its manifest is stored as `package.archived.json`, not `package.json`, so
  dependency tooling (yarn, GitHub's dependency graph, Dependabot alerts and
  security updates) does not read it. Angular 17 has advisories with no 17.x
  fix; they are resolved by the upgrade below, not by patching this copy.

To bring it back: rename `package.archived.json` to `package.json`, upgrade
it, move it to `apps/angular-demo/`, refresh `yarn.lock`, and restore its page
and link in `web/` and `packages/config`.
