# AGENTS.md - English Tutor CLI

> Guidelines for AI coding agents working in this repository.

## Project Overview

Node.js TypeScript TUI built with Ink (React) for practicing English with AI tutors.
Supports OpenAI and Gemini providers, persists chat history in SQLite.

## Commands

```bash
# Development
npm run dev              # Run TUI in dev mode (tsx)
npm run build            # Bundle to dist/ (tsup)
npm run start            # Run compiled output

# Quality
npm run lint             # ESLint check
npm run typecheck        # TypeScript check (tsc --noEmit)
npm run test             # Run all tests (vitest)
npm run test -- path/to/file.test.ts   # Run single test file

# Docker
docker compose up        # Run containerized app
```

## Project Structure

```
./
├── data/                 # Runtime config + SQLite DB (gitignored)
├── src/
│   ├── index.tsx         # Ink TUI entrypoint, command handling, UI state
│   ├── adaptive.ts       # Difficulty heuristic
│   ├── conversation.ts   # Tutor prompt builder + mode guidance
│   ├── config.ts         # Config read/write, env resolution
│   ├── storage.ts        # SQLite persistence layer
│   └── providers/
│       ├── types.ts      # Shared types (ChatMessage, TutorProvider)
│       ├── openai.ts     # OpenAI adapter
│       └── gemini.ts     # Gemini adapter
├── dist/                 # Build output (gitignored)
├── package.json
├── tsconfig.json
├── .eslintrc.cjs
├── Dockerfile
└── docker-compose.yml
```

## Code Style

### TypeScript & ESM

- **Strict mode enabled** - never use `as any`, `@ts-ignore`, or `@ts-expect-error`
- **ESM with .js extensions** - local imports must use `.js` extension (bundler resolution)
  ```typescript
  // Correct
  import { updateDifficulty } from "./adaptive.js";
  import type { ChatMessage } from "./providers/types.js";
  
  // Wrong
  import { updateDifficulty } from "./adaptive";
  import { updateDifficulty } from "./adaptive.ts";
  ```
- **Target ES2022** - use modern JS features (optional chaining, nullish coalescing)

### Imports

Order imports in this sequence (no blank lines between groups):
1. External packages (react, ink, openai, etc.)
2. Node built-ins with `node:` prefix
3. Local modules (relative paths)

```typescript
import React, { useState, useMemo } from "react";
import { render, Box, Text } from "ink";
import { randomUUID } from "node:crypto";
import fs from "node:fs";

import { updateDifficulty } from "./adaptive.js";
import type { ChatMessage } from "./providers/types.js";
```

### Type Annotations

- Use `type` keyword for type aliases and imports
- Prefer interfaces for object shapes that may be extended
- Export types explicitly with `export type`

```typescript
// Types
export type Difficulty = "beginner" | "intermediate" | "advanced";
export type PracticeMode = "general" | "grammar" | "vocab";

// Interfaces for extensible contracts
export interface TutorProvider {
  sendMessage(history: ChatMessage[], message: string): Promise<string>;
}
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files | kebab-case | `adaptive.ts`, `types.ts` |
| Types/Interfaces | PascalCase | `ChatMessage`, `TutorProvider` |
| Functions | camelCase | `buildTutorPrompt`, `createOpenAIProvider` |
| Constants | camelCase or UPPER_SNAKE | `defaultModels`, `DB_PATH` |
| React Components | PascalCase | `SetupWizard`, `App` |

### Functions

- Prefer arrow functions for exports: `export const fn = () => {}`
- Use factory pattern for providers: `createOpenAIProvider()`, `createGeminiProvider()`
- Keep functions focused and small

### Error Handling

- Always catch and type-check errors before accessing properties
- Provide meaningful fallback messages

```typescript
try {
  // operation
} catch (error) {
  const message = error instanceof Error ? error.message : "Request failed.";
  // handle message
}
```

### React/Ink Patterns

- Use functional components with hooks
- Destructure props in component signature
- Place state declarations at component top
- Use `useMemo` for derived/expensive computations

```typescript
const Component = ({ configPath, onComplete }: Props) => {
  const [state, setState] = useState(initialState);
  const derived = useMemo(() => compute(state), [state]);
  // ...
};
```

## Testing

- Test framework: Vitest
- No test files exist yet - create in `src/__tests__/` or colocate as `*.test.ts`
- Run single test: `npm run test -- src/__tests__/adaptive.test.ts`

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `PROVIDER` | openai or gemini | openai |
| `MODEL` | Model ID override | gpt-5.2 / gemini-1.5-flash |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `GEMINI_API_KEY` | Gemini API key | - |
| `DB_PATH` | SQLite database path | data/tutor.db |
| `CONFIG_PATH` | Config file path | data/config.json |

## Anti-Patterns (Avoid)

- **No type suppression**: Never use `as any`, `@ts-ignore`, `@ts-expect-error`
- **No empty catch blocks**: Always handle or log errors
- **No .ts extensions in imports**: Use `.js` for ESM bundler resolution
- **Don't modify dist/**: Generated output only
- **Don't commit data/**: Runtime storage (config.json, tutor.db)

## Key Implementation Notes

1. **Provider factory pattern**: `createOpenAIProvider()` and `createGeminiProvider()` return `TutorProvider` interface
2. **Config resolution order**: env vars > config file > defaults
3. **Command palette**: Opens with Ctrl+K or "/" on empty input
4. **History display**: Shows last 10 messages with "You"/"Tutor" labels
5. **Tutor responses**: Prompted to include a "Corrections:" section
6. **Setup wizard**: Runs on first launch or with `--setup` flag

## Quick Reference

| Task | Location |
|------|----------|
| UI/commands/state | src/index.tsx |
| Tutor prompt logic | src/conversation.ts |
| Difficulty heuristic | src/adaptive.ts |
| Provider adapters | src/providers/*.ts |
| Config handling | src/config.ts |
| Database persistence | src/storage.ts |
