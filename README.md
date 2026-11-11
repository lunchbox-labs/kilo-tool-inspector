# Kilo Tool Inspector

Browse the tools available to Kilo agents from the TUI: each tool's description, input schema and the agents that can use it.

Requires Node **22.18+**. Built for Kilo CLI **7.8.27**.

## Install

This fork is not published yet. For local testing, [build a local package](docs/wiki/Developer.md#build-a-local-package).

Add the package to `plugin` in `tui.jsonc`:

```jsonc
{ "plugin": ["@lunchbox-labs/kilo-tool-inspector"] }
```

## Browse tools

Run `/tools`, or **Browse tools** from the command palette, to list the tools Kilo offers a model; the dialog's title names which one. Type to filter the list, press Enter to see a tool's input schema, the agents that can use it and its full description, and press Escape to return to the list.

## Documentation

The [wiki](https://github.com/lunchbox-labs/kilo-tool-inspector/wiki) has the full guides:

- [Usage](https://github.com/lunchbox-labs/kilo-tool-inspector/wiki/Usage): which model's tools are listed, what the list leaves out and how input schemas are shown.
- [Agent access](https://github.com/lunchbox-labs/kilo-tool-inspector/wiki/Usage#agent-access): how a tool's detail shows each agent's access.
- [Developer](https://github.com/lunchbox-labs/kilo-tool-inspector/wiki/Developer): development, compatibility testing and publishing.
