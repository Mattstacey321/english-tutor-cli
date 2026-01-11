import React, { useEffect, useMemo, useState } from "react";
import { render, Box, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";
import { randomUUID } from "node:crypto";

import { updateDifficulty, type Difficulty } from "./adaptive.js";
import {
  defaultModelFor,
  readConfig,
  resolveConfig,
  writeConfig,
  type ResolvedConfig,
  type TutorConfig,
} from "./config.js";
import { buildTutorPrompt, type PracticeMode } from "./conversation.js";
import { createGeminiProvider, listGeminiModels } from "./providers/gemini.js";
import { createOpenAIProvider } from "./providers/openai.js";
import type {
  ChatMessage,
  ProviderName,
  TutorProvider,
} from "./providers/types.js";
import { saveMessage } from "./storage.js";

type Status = "idle" | "thinking" | "error";
type CommandResult = { message: string; isError?: boolean } | null;
type PaletteItem = {
  id: string;
  label: string;
  command?: string;
  mode?: PracticeMode;
  modelName?: string;
  disabled?: boolean;
};

type PaletteView = "commands" | "models";

const availableModes: PracticeMode[] = [
  "general",
  "grammar",
  "vocab",
  "role-play",
  "fluency",
  "exam",
];

const formatModeHelp = () => {
  return `Modes: ${availableModes.join(", ")}`;
};

const buildProvider = (
  resolved: ResolvedConfig,
): {
  provider: TutorProvider | null;
  error: string | null;
  name: string;
  model: string;
} => {
  if (resolved.error || !resolved.apiKey) {
    return {
      provider: null,
      error: resolved.error,
      name: resolved.provider,
      model: resolved.model,
    };
  }

  if (resolved.provider === "gemini") {
    return {
      provider: createGeminiProvider(resolved.apiKey, resolved.model),
      error: null,
      name: "gemini",
      model: resolved.model,
    };
  }

  return {
    provider: createOpenAIProvider(resolved.apiKey, resolved.model),
    error: null,
    name: "openai",
    model: resolved.model,
  };
};

type SetupState = {
  step: "provider" | "model" | "apikey" | "confirm";
  provider: ProviderName;
  model: string;
  apiKey: string;
  error: string | null;
};

const SetupWizard = ({
  configPath,
  configError,
  onComplete,
}: {
  configPath: string;
  configError: string | null;
  onComplete: (config: TutorConfig) => void;
}) => {
  const [entry, setEntry] = useState("");
  const [state, setState] = useState<SetupState>({
    step: "provider",
    provider: "openai",
    model: defaultModelFor("openai"),
    apiKey: "",
    error: null,
  });

  const advanceProvider = (input: string) => {
    const value = input.trim().toLowerCase();
    if (value === "1" || value === "openai") {
      setState((current) => ({
        ...current,
        provider: "openai",
        model: defaultModelFor("openai"),
        step: "model",
        error: null,
      }));
      setEntry("");
      return;
    }

    if (value === "2" || value === "gemini") {
      setState((current) => ({
        ...current,
        provider: "gemini",
        model: defaultModelFor("gemini"),
        step: "model",
        error: null,
      }));
      setEntry("");
      return;
    }

    setState((current) => ({
      ...current,
      error: "Enter 1 (OpenAI) or 2 (Gemini).",
    }));
  };

  const advanceModel = (input: string) => {
    const model = input.trim() || defaultModelFor(state.provider);
    setState((current) => ({ ...current, model, step: "apikey", error: null }));
    setEntry("");
  };

  const advanceApiKey = (input: string) => {
    const apiKey = input.trim();
    const envKey =
      state.provider === "gemini"
        ? process.env.GEMINI_API_KEY
        : process.env.OPENAI_API_KEY;
    if (!apiKey && !envKey) {
      setState((current) => ({
        ...current,
        error: `Missing ${state.provider === "gemini" ? "GEMINI_API_KEY" : "OPENAI_API_KEY"}.`,
      }));
      return;
    }

    setState((current) => ({
      ...current,
      apiKey,
      step: "confirm",
      error: null,
    }));
    setEntry("");
  };

  const advanceConfirm = (input: string) => {
    const value = input.trim().toLowerCase();
    if (value === "y") {
      const config: TutorConfig = {
        provider: state.provider,
        model: state.model,
        ...(state.apiKey ? { apiKey: state.apiKey } : {}),
      };
      writeConfig(config);
      onComplete(config);
      setEntry("");
      return;
    }

    if (value === "n") {
      setState((current) => ({ ...current, step: "provider", error: null }));
      setEntry("");
      return;
    }

    setState((current) => ({
      ...current,
      error: "Type y to save or n to restart.",
    }));
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Text>English Tutor CLI Setup</Text>
      <Text color="gray">Config will be saved to: {configPath}</Text>
      <Text color="gray">
        Docker users can also set PROVIDER/MODEL and API keys via environment
        variables.
      </Text>
      {configError && <Text color="yellow">Config warning: {configError}</Text>}
      <Box marginTop={1} flexDirection="column">
        {state.step === "provider" && (
          <>
            <Text>Select provider: 1) OpenAI 2) Gemini</Text>
            <TextInput
              value={entry}
              onChange={setEntry}
              onSubmit={advanceProvider}
              placeholder="1 or 2"
            />
          </>
        )}
        {state.step === "model" && (
          <>
            <Text>
              Model for {state.provider} (blank for default:{" "}
              {defaultModelFor(state.provider)})
            </Text>
            <TextInput
              value={entry}
              onChange={setEntry}
              onSubmit={advanceModel}
              placeholder={defaultModelFor(state.provider)}
            />
          </>
        )}
        {state.step === "apikey" && (
          <>
            <Text>
              API key (blank to use env{" "}
              {state.provider === "gemini"
                ? "GEMINI_API_KEY"
                : "OPENAI_API_KEY"}
              )
            </Text>
            <TextInput
              value={entry}
              onChange={setEntry}
              onSubmit={advanceApiKey}
              placeholder="sk-..."
              mask="*"
            />
          </>
        )}
        {state.step === "confirm" && (
          <>
            <Text>Save config and start tutor? (y/n)</Text>
            <TextInput
              value={entry}
              onChange={setEntry}
              onSubmit={advanceConfirm}
              placeholder="y"
            />
          </>
        )}
        {state.error && <Text color="red">{state.error}</Text>}
      </Box>
    </Box>
  );
};

const App = () => {
  const { exit } = useApp();
  const sessionId = useMemo(() => randomUUID(), []);
  const initialConfigState = useMemo(() => readConfig(), []);
  const [configState, setConfigState] = useState(initialConfigState);
  const [setupMode, setSetupMode] = useState(() =>
    process.argv.includes("--setup"),
  );
  const resolvedConfig = useMemo(
    () => resolveConfig(configState.config),
    [configState.config],
  );
  const providerInfo = useMemo(
    () => buildProvider(resolvedConfig),
    [resolvedConfig],
  );
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>(
    providerInfo.error ? "error" : "idle",
  );
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner");
  const [mode, setMode] = useState<PracticeMode>("general");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [paletteView, setPaletteView] = useState<PaletteView>("commands");
  const [modelItems, setModelItems] = useState<string[]>([]);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);

  const showSetup = setupMode || Boolean(resolvedConfig.error);

  const paletteItems: PaletteItem[] = useMemo(() => {
    const items: PaletteItem[] = [
      { id: "help", label: "Show help", command: "/help" },
      {
        id: "models",
        label: "List Gemini models",
        command: "/models",
        disabled: providerInfo.name !== "gemini" || !resolvedConfig.apiKey,
      },
    ];

    for (const option of availableModes) {
      items.push({
        id: `mode-${option}`,
        label: `Set mode: ${option}`,
        mode: option,
      });
    }

    return items;
  }, [providerInfo.name, resolvedConfig.apiKey]);

  const openPalette = () => {
    if (status === "thinking" || providerInfo.error) {
      return;
    }
    setPaletteView("commands");
    setPaletteIndex(0);
    setPaletteOpen(true);
  };

  const closePalette = () => {
    setPaletteOpen(false);
  };

  const openModelPalette = async () => {
    if (status === "thinking" || providerInfo.error) {
      return;
    }

    setPaletteView("models");
    setPaletteIndex(0);
    setPaletteOpen(true);
    setModelLoading(true);
    setModelError(null);

    try {
      const models = await listGeminiModels(resolvedConfig.apiKey ?? "");
      setModelItems(models);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to list models.";
      setModelError(message);
      setModelItems([]);
    } finally {
      setModelLoading(false);
    }
  };

  const applyModelSelection = (modelName: string) => {
    const nextConfig: TutorConfig = {
      provider: resolvedConfig.provider,
      model: modelName,
      ...(configState.config?.apiKey
        ? { apiKey: configState.config.apiKey }
        : {}),
    };
    writeConfig(nextConfig);
    setConfigState({ config: nextConfig, error: null, path: configState.path });
    setHistory((current) => [
      ...current,
      { role: "assistant", content: `(Tip) Model set to ${modelName}.` },
    ]);
  };

  const modelPaletteItems: PaletteItem[] = useMemo(() => {
    if (modelLoading) {
      return [
        { id: "models-loading", label: "Loading models...", disabled: true },
      ];
    }

    if (modelError) {
      return [
        {
          id: "models-error",
          label: `Failed to load models: ${modelError}`,
          disabled: true,
        },
      ];
    }

    if (modelItems.length === 0) {
      return [
        { id: "models-empty", label: "No models returned.", disabled: true },
      ];
    }

    return modelItems.map((model) => {
      const normalized = model.replace(/^models\//, "");
      return {
        id: `model-${model}`,
        label: normalized,
        modelName: normalized,
      };
    });
  }, [modelError, modelItems, modelLoading]);

  const runPaletteItem = (item: PaletteItem): boolean => {
    if (item.disabled) {
      return false;
    }

    if (item.command) {
      const result = handleCommand(item.command);
      if (result) {
        setHistory((current) => [
          ...current,
          {
            role: "assistant",
            content: `${result.isError ? "(System)" : "(Tip)"} ${result.message}`,
          },
        ]);
      }
      return result !== null;
    }

    if (item.modelName) {
      applyModelSelection(item.modelName);
      return true;
    }

    if (item.mode) {
      setMode(item.mode);
      setHistory((current) => [
        ...current,
        { role: "assistant", content: `(Tip) Mode set to ${item.mode}.` },
      ]);
    }

    return true;
  };

  useEffect(() => {
    if (paletteOpen && (status === "thinking" || providerInfo.error)) {
      closePalette();
    }
  }, [paletteOpen, providerInfo.error, status]);

  useInput((inputChar, key) => {
    if (inputChar === "\u0003") {
      exit();
      return;
    }

    if (paletteOpen) {
      if (key.escape) {
        closePalette();
        return;
      }

      if (key.upArrow) {
        const items =
          paletteView === "models" ? modelPaletteItems : paletteItems;
        const count = items.length || 1;
        setPaletteIndex((current) => (current - 1 + count) % count);
        return;
      }

      if (key.downArrow) {
        const items =
          paletteView === "models" ? modelPaletteItems : paletteItems;
        const count = items.length || 1;
        setPaletteIndex((current) => (current + 1) % count);
        return;
      }

      if (key.return) {
        const items =
          paletteView === "models" ? modelPaletteItems : paletteItems;
        const shouldClose = runPaletteItem(items[paletteIndex]);
        if (shouldClose) {
          closePalette();
        }
        return;
      }

      return;
    }

    if (key.ctrl && inputChar.toLowerCase() === "k") {
      openPalette();
      return;
    }

    if (inputChar === "/" && input === "") {
      setInput("");
      openPalette();
    }
  });

  useEffect(() => {
    if (providerInfo.error) {
      setStatus("error");
      return;
    }

    setStatus((current) => (current === "error" ? "idle" : current));
  }, [providerInfo.error]);

  const handleCommand = (value: string): CommandResult => {
    const [command, ...args] = value.trim().split(/\s+/);
    switch (command) {
      case "/help":
        return { message: "Commands: /mode <name>, /models, /help" };
      case "/mode": {
        const requested = (args[0] ?? "").toLowerCase();
        if (!requested) {
          return { message: formatModeHelp() };
        }

        if (availableModes.includes(requested as PracticeMode)) {
          setMode(requested as PracticeMode);
          return { message: `Mode set to ${requested}.` };
        }

        return { message: `Unknown mode. ${formatModeHelp()}`, isError: true };
      }
      case "/models": {
        if (providerInfo.name !== "gemini" || !resolvedConfig.apiKey) {
          return {
            message:
              "Model listing is only available for Gemini with an API key.",
            isError: true,
          };
        }
        void openModelPalette();
        return null;
      }
      default:
        return { message: "Unknown command. Use /help.", isError: true };
    }
  };

  const handleSubmit = async (value: string) => {
    if (status === "thinking" || !value.trim() || !providerInfo.provider) {
      return;
    }

    const trimmed = value.trim();
    if (trimmed.startsWith("/")) {
      const result = handleCommand(trimmed);
      if (result) {
        setHistory((current) => [
          ...current,
          {
            role: "assistant",
            content: `${result.isError ? "(System)" : "(Tip)"} ${result.message}`,
          },
        ]);
      }
      setInput("");
      return;
    }

    setInput("");
    setStatus("thinking");

    const nextHistory: ChatMessage[] = [
      ...history,
      { role: "user", content: trimmed },
    ];
    setHistory(nextHistory);
    saveMessage(sessionId, "user", trimmed);

    try {
      const requestHistory: ChatMessage[] = [
        { role: "system", content: buildTutorPrompt(difficulty, mode) },
        ...history,
      ];

      const reply = await providerInfo.provider.sendMessage(
        requestHistory,
        trimmed,
      );
      const assistantMessage = reply || "(No response from tutor.)";

      setHistory((current) => [
        ...current,
        { role: "assistant", content: assistantMessage },
      ]);
      saveMessage(sessionId, "assistant", assistantMessage);
      setDifficulty(updateDifficulty(difficulty, trimmed));
      setStatus("idle");
    } catch (error) {
      let message = error instanceof Error ? error.message : "Request failed.";
      if (providerInfo.name === "gemini" && /404|not found/i.test(message)) {
        message = `${message} (Try /models to list available Gemini models.)`;
      }
      setHistory((current) => [
        ...current,
        { role: "assistant", content: message },
      ]);
      setStatus("error");
    }
  };

  const messagesToShow = history.slice(-10);

  if (showSetup) {
    return (
      <SetupWizard
        configPath={configState.path}
        configError={configState.error}
        onComplete={(config) => {
          setConfigState({ config, error: null, path: configState.path });
          setSetupMode(false);
        }}
      />
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text>English Tutor CLI</Text>
      <Text color="gray">
        Provider: {providerInfo.name} | Model: {providerInfo.model} |
        Difficulty: {difficulty} | Mode: {mode}
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {messagesToShow.map((message, index) => (
          <Text key={`${message.role}-${index}`}>
            {message.role === "user" ? "You" : "Tutor"}: {message.content}
          </Text>
        ))}
      </Box>
      {providerInfo.error && <Text color="red">{providerInfo.error}</Text>}
      {status === "thinking" && <Text color="yellow">Thinking...</Text>}
      {paletteOpen && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="gray">
            {paletteView === "models"
              ? "Select a Gemini model (Enter to select, Esc to close)"
              : "Command palette (Enter to select, Esc to close)"}
          </Text>
          {(paletteView === "models" ? modelPaletteItems : paletteItems).map(
            (item, index) => {
              const isSelected = index === paletteIndex;
              const color = item.disabled
                ? "gray"
                : isSelected
                  ? "cyan"
                  : "white";
              const prefix = isSelected ? ">" : " ";
              return (
                <Text key={item.id} color={color}>
                  {prefix} {item.label}
                </Text>
              );
            },
          )}
        </Box>
      )}
      <TextInput
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        placeholder="Type your message..."
        focus={!providerInfo.error && status !== "thinking"}
      />
      <Text color="gray">Ctrl+K for commands | Ctrl+C to exit</Text>
    </Box>
  );
};

render(<App />);
