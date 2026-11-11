# Developer documentation

For contributors and maintainers working on Tool Inspector:

- [Local builds and checks](#build-a-local-package): local builds, the TUI-only package shape and compatibility checks.
- [Publishing](Publishing): trusted publisher setup and the release workflow.

The plugin's state machines are documented in [docs/state-machines.md](https://github.com/lunchbox-labs/kilo-tool-inspector/blob/main/docs/state-machines.md). These wiki pages are published from [docs/wiki](https://github.com/lunchbox-labs/kilo-tool-inspector/tree/main/docs/wiki) on every push to `main` that changes them; change them there.

The repository's [AGENTS.md](https://github.com/lunchbox-labs/kilo-tool-inspector/blob/main/AGENTS.md) and linked shared standards remain the authoritative machine instructions. [User documentation](Home#user-documentation) covers installation and everyday use.

## Build a local package

Use the committed npm lockfile. Use Node 26.4 or later for development to match the OpenTUI build dependencies; CI uses Node 26. The distributed package retains its Node 22.18 minimum and uses Kilo’s bundled TUI runtime.

```sh
npm ci
npm run build
npm pack
```

This fork is private until local testing and release setup are approved; `npm pack` still works.

Install the generated tarball into a separate directory and register that installed package's absolute directory in `tui.jsonc`. This exercises a local candidate without publishing it.

## Package shape

This is a TUI-only plugin. The package exports `./tui` and no root or `./server` entry, because Kilo loads a package's root export as a server plugin.

## Checks

| Command | Coverage |
| --- | --- |
| `npm run check` | Typechecking, lint, formatting and unit tests |
| `npm run test:package` | Built tarball installation, the TUI export and declarations |
| `npm run test:native` | Linux x64 Kilo CLI 7.8.27, installed tarball, live APIs, filtering, details, paging, Escape and repeated opens |

Tests should protect observable behavior, safety boundaries and host contracts. The [shared standards](https://github.com/lunchbox-labs/.github/blob/main/agent-guidance/common.md#meaningful-tests) define the testing policy.

## Host compatibility

The tested Kilo version and floor live in [tests/kilo.json](https://github.com/lunchbox-labs/kilo-tool-inspector/blob/main/tests/kilo.json). The `@kilocode/plugin` and `@kilocode/sdk` dev dependencies share one exact version matching that version. The `@opentui/*` and `solid-js` dev dependencies stay on the versions the supported host bundles, because Kilo maps a plugin's imports of them to its own copies. [tests/kilo-baseline.test.mjs](https://github.com/lunchbox-labs/kilo-tool-inspector/blob/main/tests/kilo-baseline.test.mjs) enforces both, so update them only together with the tested version. No Kilo runtime engine restriction is declared.

[Check CI](https://github.com/lunchbox-labs/kilo-tool-inspector/blob/main/.github/workflows/check.yml) runs the unit and package tests on Linux and Windows for every pull request and push to `main`, and the static checks on Linux.

The native check installs the pinned CLI in temporary state and uses a loopback-only model fixture without sending prompts or executing tools. It requires Linux x64 and `script` from util-linux. Set `KILO_BIN` to reuse an existing 7.8.27 binary; its version is checked. Windows runs unit and packed-package checks, not the native TUI check.
