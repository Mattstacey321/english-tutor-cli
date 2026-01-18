import fs from "node:fs";
import path from "node:path";

import type { ProviderName } from "./providers/types.ts";

export type TutorConfig = {
  provider: ProviderName;
  model: string;
  apiKey?: string;
};

export type ResolvedConfig = {
  provider: ProviderName;
  model: string;
  apiKey: string | null;
  error: string | null;
};

const defaultModels: Record<ProviderName, string> = {
  openai: "gpt-5.2",
  gemini: "gemini-2.5-flash",
};

export const getConfigPath = () => {
  return (
    process.env.CONFIG_PATH ?? path.join(process.cwd(), "data", "config.json")
  );
};

const isProviderName = (value: string): value is ProviderName => {
  return value === "openai" || value === "gemini";
};

export const readConfig = (): {
  config: TutorConfig | null;
  error: string | null;
  path: string;
} => {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return { config: null, error: null, path: configPath };
  }

  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<TutorConfig>;
    if (!parsed.provider || !parsed.model || !isProviderName(parsed.provider)) {
      return {
        config: null,
        error: "Invalid config format.",
        path: configPath,
      };
    }

    return {
      config: {
        provider: parsed.provider,
        model: parsed.model,
        apiKey: parsed.apiKey,
      },
      error: null,
      path: configPath,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read config.";
    return { config: null, error: message, path: configPath };
  }
};

export const writeConfig = (config: TutorConfig) => {
  const configPath = getConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
};

export const resolveConfig = (config: TutorConfig | null): ResolvedConfig => {
  const rawProvider = (
    process.env.PROVIDER ??
    config?.provider ??
    "openai"
  ).toLowerCase();
  const provider: ProviderName = rawProvider === "gemini" ? "gemini" : "openai";
  const model = process.env.MODEL ?? config?.model ?? defaultModels[provider];
  const envKey =
    provider === "gemini"
      ? process.env.GEMINI_API_KEY
      : process.env.OPENAI_API_KEY;
  const apiKey = envKey ?? config?.apiKey ?? null;

  if (!apiKey) {
    const missing = provider === "gemini" ? "GEMINI_API_KEY" : "OPENAI_API_KEY";
    return { provider, model, apiKey: null, error: `Missing ${missing}.` };
  }

  return { provider, model, apiKey, error: null };
};

export const defaultModelFor = (provider: ProviderName) =>
  defaultModels[provider];
