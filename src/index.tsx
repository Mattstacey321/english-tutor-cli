import { useEffect, useMemo, useRef } from "react";
import { randomUUID } from "node:crypto";
import { render, Box, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";
import { updateDifficulty } from "./adaptive.js";
import {
  readConfig,
  resolveConfig,
  writeConfig,
  type ResolvedConfig,
  type TutorConfig,
} from "./config.js";
import { buildTutorPrompt } from "./conversation.js";
import { createGeminiProvider, listGeminiModels } from "./providers/gemini.js";
import { createOpenAIProvider } from "./providers/openai.js";
import type { TutorProvider, ChatMessage } from "./providers/types.js";
import { saveMessage } from "./storage.js";
import { useTutorStore, type PaletteView } from "./stores/tutor-store.js";
import type { PracticeMode } from "./conversation.js";
import { CommandPalette } from "./components/command-palette.js";
import { ScrollableMessageList, type ScrollableMessageListRef } from "./components/scrollable-message-list.js";
import Spinner from "ink-spinner";
import { SetupWizard } from "./layouts/setup-wizard.js";
import { ErrorBoundary } from "./components/error-boundary.js";
import { useTerminalSize } from "./hooks/use-terminal-size.js";

type CommandResult = { message: string; isError?: boolean } | null;
type PaletteItem = {
  id: string;
  label: string;
  command?: string;
  mode?: PracticeMode;
  modelName?: string;
  disabled?: boolean;
};

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

const App = () => {
  const { exit } = useApp();
  const terminalSize = useTerminalSize();
  const scrollRef = useRef<ScrollableMessageListRef>(null);

  // Session state & actions (selective subscriptions for better performance)
  const sessionId = useTutorStore((s) => s.sessionId);
  const history = useTutorStore((s) => s.history);
  const input = useTutorStore((s) => s.input);
  const status = useTutorStore((s) => s.status);

  const setHistory = useTutorStore((s) => s.setHistory);
  const addMessage = useTutorStore((s) => s.addMessage);
  const setInput = useTutorStore((s) => s.setInput);
  const setStatus = useTutorStore((s) => s.setStatus);

  // Config state & actions
  const configState = useTutorStore((s) => s.configState);
  const setupMode = useTutorStore((s) => s.setupMode);
  const setConfigState = useTutorStore((s) => s.setConfigState);
  const setSetupMode = useTutorStore((s) => s.setSetupMode);
  const initialize = useTutorStore((s) => s.initialize);

  // Tutor settings
  const difficulty = useTutorStore((s) => s.difficulty);
  const mode = useTutorStore((s) => s.mode);
  const setDifficulty = useTutorStore((s) => s.setDifficulty);
  const setMode = useTutorStore((s) => s.setMode);

  // Palette state & actions
  const paletteOpen = useTutorStore((s) => s.paletteOpen);
  const paletteIndex = useTutorStore((s) => s.paletteIndex);
  const paletteView = useTutorStore((s) => s.paletteView);
  const openPalette = useTutorStore((s) => s.openPalette);
  const closePalette = useTutorStore((s) => s.closePalette);
  const setPaletteIndex = useTutorStore((s) => s.setPaletteIndex);

  // Model state & actions
  const modelItems = useTutorStore((s) => s.modelItems);
  const modelLoading = useTutorStore((s) => s.modelLoading);
  const modelError = useTutorStore((s) => s.modelError);
  const setModelItems = useTutorStore((s) => s.setModelItems);
  const setModelLoading = useTutorStore((s) => s.setModelLoading);
  const setModelError = useTutorStore((s) => s.setModelError);

  // Initialize store with config on mount
  const initialConfigState = useMemo(() => readConfig(), []);
  useEffect(() => {
    initialize(initialConfigState, process.argv.includes("--setup"));
  }, [initialize, initialConfigState]);

  const resolvedConfig = useMemo(
    () => resolveConfig(configState.config),
    [configState.config],
  );
  const providerInfo = useMemo(
    () => buildProvider(resolvedConfig),
    [resolvedConfig],
  );

  // Set initial status based on provider error
  useEffect(() => {
    if (providerInfo.error && status === "idle") {
      setStatus("error");
    }
  }, [providerInfo.error, status, setStatus]);

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

  const openPaletteHandler = (view: PaletteView = "commands") => {
    if (status === "thinking" || providerInfo.error) {
      return;
    }
    openPalette(view);
  };

  const openModelPalette = async () => {
    openPalette("models");
    setModelLoading(true);
    setModelError(null);

    try {
      const fetchedModels = await listGeminiModels(resolvedConfig.apiKey ?? "");
      setModelItems(fetchedModels);
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
    addMessage({
      role: "assistant",
      content: `(Tip) Model set to ${modelName}.`,
    });
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
        addMessage({
          role: "assistant",
          content: `${result.isError ? "(System)" : "(Tip)"} ${result.message}`,
        });
      }
      return result !== null;
    }

    if (item.modelName) {
      applyModelSelection(item.modelName);
      return true;
    }

    if (item.mode) {
      setMode(item.mode);
      addMessage({
        role: "assistant",
        content: `(Tip) Mode set to ${item.mode}.`,
      });
    }

    return true;
  };

  useEffect(() => {
    if (paletteOpen && (status === "thinking" || providerInfo.error)) {
      closePalette();
    }
  }, [paletteOpen, providerInfo.error, status, closePalette]);

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
        const newIndex = (paletteIndex - 1 + count) % count;
        setPaletteIndex(newIndex);
        return;
      }

      if (key.downArrow) {
        const items =
          paletteView === "models" ? modelPaletteItems : paletteItems;
        const count = items.length || 1;
        const newIndex = (paletteIndex + 1) % count;
        setPaletteIndex(newIndex);
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

    if (input === "" && status !== "thinking") {
      if (key.upArrow) {
        scrollRef.current?.scrollBy(-1);
        return;
      }
      if (key.downArrow) {
        scrollRef.current?.scrollBy(1);
        return;
      }
      if (key.pageUp) {
        scrollRef.current?.scrollBy(-5);
        return;
      }
      if (key.pageDown) {
        scrollRef.current?.scrollBy(5);
        return;
      }
    }

    if (key.ctrl && inputChar.toLowerCase() === "k") {
      openPaletteHandler();
      return;
    }
  });

  useEffect(() => {
    if (providerInfo.error) {
      setStatus("error");
      return;
    }

    if (status === "error") {
      setStatus("idle");
    }
  }, [providerInfo.error]);
  // Note: intentionally not including status/setStatus in deps to avoid loop

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
        addMessage({
          role: "assistant",
          content: `${result.isError ? "(System)" : "(Tip)"} ${result.message}`,
        });
      }
      setInput("");
      return;
    }

    setInput("");
    setStatus("thinking");

    const userMessageId = randomUUID();
    setHistory((current) => [...current, { id: userMessageId, role: "user", content: trimmed }]);
    saveMessage(userMessageId, sessionId, "user", trimmed);

    try {
      const currentHistory = useTutorStore.getState().history;
      const requestHistory: ChatMessage[] = [
        { role: "system", content: buildTutorPrompt(difficulty, mode) },
        ...currentHistory,
      ];

      const reply = await providerInfo.provider.sendMessage(
        requestHistory,
      );
      const assistantMessage = reply || "(No response from tutor.)";

      const assistantMessageId = randomUUID();
      setHistory((current) => [
        ...current,
        { id: assistantMessageId, role: "assistant", content: assistantMessage },
      ]);

      saveMessage(assistantMessageId, sessionId, "assistant", assistantMessage);
      setDifficulty(updateDifficulty(difficulty, trimmed));
      setStatus("idle");
    } catch (error) {
      let message = error instanceof Error ? error.message : "Request failed.";
      if (providerInfo.name === "gemini" && /404|not found/i.test(message)) {
        message = `${message} (Try /models to list available Gemini models.)`;
      }
      addMessage({ role: "assistant", content: message });
      setStatus("error");
    }
  };

  const messageListHeight = Math.max(5, terminalSize.height - 15);

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
      {/* Header */}
      <Box
        flexDirection="row"
        justifyContent="space-between"
        marginBottom={1}
        padding={1}
        borderStyle="round"
        borderColor="cyan"
      >
        <Text bold color="cyan">
          🎓 English Tutor CLI
        </Text>
        <Text color="gray">
          {mode.toUpperCase()} | {difficulty.toUpperCase()} | {providerInfo.name.toUpperCase()}
        </Text>
      </Box>

      {paletteOpen && (
        <CommandPalette
          items={paletteView === "models" ? modelPaletteItems : paletteItems}
        />
      )}

      {/* Messages Container */}
      <ScrollableMessageList
        ref={scrollRef}
        messages={history}
        height={messageListHeight}
      />

      {/* Status Bar */}
      <Box
        flexDirection="row"
        justifyContent="space-between"
        marginTop={1}
        paddingX={1}
      >
        <Box flexDirection="row">
          {status === "thinking" && (
            <Text color="green">
              <Spinner type="dots" /> Thinking...
            </Text>
          )}
          {providerInfo.error && (
            <Text color="red">⚠️ {providerInfo.error}</Text>
          )}
        </Box>
        <Text color="gray">
          {history.length} messages | Mode: {mode}
        </Text>
      </Box>

      {/* Input */}
      <Box
        borderStyle="single"
        borderColor={status === "thinking" ? "yellow" : "green"}
        padding={0.5}
        marginTop={1}
      >
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder="Type your message... (Ctrl+K for commands)"
          showCursor={true}
          focus={!providerInfo.error && status !== "thinking"}
        />
      </Box>

      {/* Footer */}
      <Box
        borderColor="gray"
        borderStyle="single"
        flexWrap="nowrap"
        marginTop={1}
        paddingX={1}
      >
        <Text color="gray">
          <Text bold>Ctrl+K</Text> Commands | <Text bold>Ctrl+C</Text> Exit | <Text bold>↑↓</Text> Scroll
        </Text>
      </Box>
    </Box>
  );
};

render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
