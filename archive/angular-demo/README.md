# angular-demo (offline)

This app is built on Angular 17, which is out of support. It is offline until
it is upgraded to a supported Angular version; it will come back upgraded.

While it lives in `archive/`:

- it is not a yarn workspace (`archive/*` is outside `workspaces` in the root
  `package.json`), so its dependencies are not in `yarn.lock`;
- it is not built, linted, tested or deployed, and the site does not link to it.

To bring it back: upgrade it, move it to `apps/angular-demo/`, refresh
`yarn.lock`, and restore its page and link in `web/` and `packages/config`.
