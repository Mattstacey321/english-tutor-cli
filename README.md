# English Tutor CLI

An interactive TUI app for practicing English with an AI tutor. It supports OpenAI and Gemini, provides corrections and vocabulary suggestions, adapts difficulty, and saves chat history in SQLite.

## Quick start

Local dev:

```bash
npm install
OPENAI_API_KEY=your_key_here npm run dev
```

Docker (self-host):

```bash
docker compose up
```

## Install

```bash
npm install
```

## Usage

Run the TUI:

```bash
npm run dev
```

Build and run the compiled CLI:

```bash
npm run build
npm run start
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

- `npm run dev` start TUI in dev mode
- `npm run build` bundle to `dist/`
- `npm run start` run compiled output
- `npm run lint` lint code
- `npm run typecheck` run TypeScript checks
- `npm run test` run unit tests

## Testing

```bash
npm run lint
npm run typecheck
npm run test
```

## Troubleshooting

- Gemini 404 for model: run `/models` and set `MODEL` to a listed model.
- Missing API key: set `OPENAI_API_KEY` or `GEMINI_API_KEY`, or rerun setup with `--setup`.
- SQLite errors: confirm `DB_PATH` is writable.

## Contributing

TODO: Add contribution guidelines.

## License

TODO: Add license.
