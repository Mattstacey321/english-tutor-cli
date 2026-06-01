# Contributing

Thanks for your interest in English Tutor CLI!

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) >= 9

## Setup

```bash
pnpm install
```

## Development

Start the TUI in dev mode:

```bash
pnpm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Start TUI in dev mode |
| `pnpm run build` | Bundle to `dist/` |
| `pnpm run start` | Run compiled output |
| `pnpm run lint` | Lint code |
| `pnpm run typecheck` | Run TypeScript checks |
| `pnpm run test` | Run unit tests |

## Before submitting

Ensure your changes pass all checks:

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

## Code style

- TypeScript with strict mode.
- ESLint rules must not be weakened — fix violations at the source.
- Tests use Vitest and should accompany new functionality.
