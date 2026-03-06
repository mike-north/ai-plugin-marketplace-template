# Universal AI Plugin Marketplace Template

Author AI assistant plugins once and distribute them to all major platforms.

## Supported Platforms

| Platform | Status |
|----------|--------|
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | Supported |
| [Cursor](https://www.cursor.com/) | Supported |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | Supported |
| [Kiro](https://kiro.dev/) | Supported |
| [Vercel Skills CLI](https://sdk.vercel.ai/docs/ai-sdk-core/agents#skills) | Supported |

## Quick Start

### Create a new plugin

```bash
pnpm run scaffold my-plugin
```

### Validate all plugins

```bash
pnpm run validate
```

### Build standalone exports

```bash
pnpm run build:standalone
```

This generates standalone directories in `dist/` for platforms that require repo-root manifests (Gemini CLI and Kiro).

## Repository Structure

```
ai-plugin-marketplace-template/
├── .claude-plugin/
│   └── marketplace.json              # Claude Code marketplace registry
├── .cursor-plugin/
│   └── marketplace.json              # Cursor marketplace registry
├── plugins/
│   └── <plugin-name>/                # One directory per plugin
│       ├── .claude-plugin/
│       │   └── plugin.json           # Claude Code manifest
│       ├── .cursor-plugin/
│       │   └── plugin.json           # Cursor manifest
│       ├── gemini-extension.json     # Gemini CLI manifest
│       ├── POWER.md                  # Kiro power entry point
│       ├── GEMINI.md                 # Gemini CLI context file
│       ├── .mcp.json                 # MCP config (Claude Code / Cursor)
│       ├── mcp.json                  # MCP config (Kiro)
│       ├── skills/                   # SKILL.md files (universal)
│       ├── agents/                   # Agent definitions (.md)
│       ├── rules/                    # Rules (.md for Claude, .mdc for Cursor)
│       ├── steering/                 # Kiro steering files
│       ├── commands/                 # Commands (.md and .toml)
│       ├── hooks/                    # Hook definitions
│       ├── README.md
│       └── LICENSE
├── src/
│   ├── validate.ts                   # Validate plugins and manifests
│   ├── scaffold.ts                   # Create new plugin from template
│   └── build-standalone.ts           # Generate standalone exports
├── templates/                        # Templates for scaffolding
├── dist/                             # Generated standalone repos (gitignored)
│   ├── gemini/
│   └── kiro/
└── README.md
```

## Platform Compatibility Matrix

| Feature | Claude Code | Cursor | Gemini CLI | Kiro | Skills CLI |
|---------|:-----------:|:------:|:----------:|:----:|:----------:|
| Skills (SKILL.md) | ✓ | ✓ | ✓ | via steering | ✓ |
| Agents (.md) | ✓ | ✓ | ✓ | — | — |
| Rules | .md | .mdc | — | steering/ | — |
| Hooks | ✓ | ✓ | ✓ | .kiro/hooks/ | — |
| MCP Servers | .mcp.json | .mcp.json | gemini-extension.json | mcp.json | — |
| Commands | .md | .md/.mdc | .toml | — | — |
| Marketplace | marketplace.json | marketplace.json | gallery | powers panel | `npx skills find` |
| Multi-plugin repo | ✓ | ✓ | — | — | ✓ |

## How It Works

> **Platform terminology note:** Claude Code and Cursor call these *plugins*; Kiro calls them *powers*; Gemini CLI calls them *extensions*; Vercel calls them *skills*. This template uses "plugin" as the generic term throughout.

### Claude Code and Cursor

These platforms share the same internal layout — `skills/`, `agents/`, `hooks/`, `commands/`, `.mcp.json` are identical. Only the manifest wrapper differs (`.claude-plugin/` vs `.cursor-plugin/`).

Plugins are referenced directly from the marketplace.json in the repo.

### Gemini CLI and Kiro

Both platforms expect their manifest at the repository root. The `build:standalone` script copies each plugin into `dist/gemini/<name>/` and `dist/kiro/<name>/` with the correct root-level structure.

Kiro reads skills via steering context files rather than natively parsing SKILL.md frontmatter. Place skill descriptions in `steering/` files so Kiro picks them up automatically.

Kiro does not have a commands concept. Command-like functionality should be expressed via steering files instead.

### Vercel Skills CLI

Works out of the box — `npx skills add owner/repo` auto-discovers all SKILL.md files in the repository.

## Example Plugin: skill-evaluator

The included `skill-evaluator` plugin demonstrates the full multi-platform pattern. It evaluates AI skills across model tiers (opus → sonnet → haiku) using blind sub-agent testing.

See [plugins/skill-evaluator/README.md](plugins/skill-evaluator/README.md) for details.

## Creating a Plugin Manually

If you prefer to create a plugin without the scaffold script:

1. Create a directory under `plugins/`
2. Add platform manifests (see any existing plugin for the pattern)
3. Add your skills, agents, rules, and commands
4. Update both root marketplace.json files (see `.claude-plugin/marketplace.json` for the entry format)
5. Run `pnpm run validate` to verify everything is correct
6. Run `pnpm run build:standalone` to generate Gemini/Kiro exports

## npm Scripts

| Script | Description |
|--------|-------------|
| `pnpm run validate` | Validate all plugins and manifests |
| `pnpm run scaffold <name>` | Create a new plugin from templates |
| `pnpm run build:standalone` | Generate standalone Gemini/Kiro exports |
| `pnpm run build` | Validate + build standalone |
| `pnpm run clean` | Remove dist/ directory |

## License

MIT
