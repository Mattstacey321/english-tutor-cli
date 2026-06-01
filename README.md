# English Tutor CLI

An interactive TUI app for practicing English with an AI tutor. It supports OpenAI and Gemini, provides corrections and vocabulary suggestions, adapts difficulty, and saves chat history in SQLite.

## Quick start

Local dev:

```bash
pnpm install
OPENAI_API_KEY=your_key_here pnpm run dev
```

Docker (self-host):

```bash
docker compose up
```

## Install

```bash
pnpm install
```

## Usage

Run the TUI:

```bash
pnpm run dev
```

Build and run the compiled CLI:

```bash
pnpm run build
pnpm run start
```

Once built, you can also run:

```bash
english-tutor
```

In-app commands:

- `/help` show available commands
- `/mode <general|grammar|vocab|role-play|fluency|exam>` change practice mode
- `/models` list Gemini models that support `generateContent`

## Config

The app uses a first-run setup wizard and saves config to `data/config.json` by default.

Environment variables:

- `PROVIDER` (openai | gemini)
- `MODEL` (model id override)
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `DB_PATH` (SQLite path, default `data/tutor.db`)
- `CONFIG_PATH` (config file path, default `data/config.json`)

Docker compose passes `DB_PATH=/data/tutor.db` and uses a named volume.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Start TUI in dev mode |
| `pnpm run build` | Bundle to `dist/` |
| `pnpm run start` | Run compiled output |
| `pnpm run lint` | Lint code |
| `pnpm run typecheck` | Run TypeScript checks |
| `pnpm run test` | Run unit tests |

## Testing

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
```

## Troubleshooting

- Gemini 404 for model: run `/models` and set `MODEL` to a listed model.
- Missing API key: set `OPENAI_API_KEY` or `GEMINI_API_KEY`, or rerun setup with `--setup`.
- SQLite errors: confirm `DB_PATH` is writable.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, scripts, and code style guidelines.

## License

MIT — see [LICENSE](LICENSE) for the full text.
