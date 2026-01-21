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
import { createOpenAIProvider, listOpenAIModels } from "./providers/openai.js";
import type { TutorProvider, ChatMessage } from "./providers/types.js";
import { saveMessage, updateVocabMastery } from "./storage.js";
import { useTutorStore } from "./stores/tutor-store.js";
import type { PracticeMode } from "./conversation.js";
import { CommandPalette } from "./components/command-palette.js";
import {
  handleCommand,
  availableModes,
  type CommandContext,
  type CommandActions,
  type CommandResult,
} from "./commands.js";
import {
  ScrollableMessageList,
  type ScrollableMessageListRef,
} from "./components/scrollable-message-list.js";
import Spinner from "ink-spinner";
import { SetupWizard } from "./layouts/setup-wizard.js";
import { ErrorBoundary } from "./components/error-boundary.js";
import { useTerminalSize } from "./hooks/use-terminal-size.js";

type PaletteItem = {
  id: string;
  left: string;
  right?: string;
  command?: string;
  mode?: PracticeMode;
  modelName?: string;
  disabled?: boolean;
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
  const resetSession = useTutorStore((s) => s.resetSession);
  const setSessionId = useTutorStore((s) => s.setSessionId);

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

  const mainView = useTutorStore((s) => s.mainView);
  const panelIndex = useTutorStore((s) => s.panelIndex);
  const setMainView = useTutorStore((s) => s.setMainView);
  const setPanelIndex = useTutorStore((s) => s.setPanelIndex);

  // Palette state & actions
  const paletteOpen = useTutorStore((s) => s.paletteOpen);
  const paletteIndex = useTutorStore((s) => s.paletteIndex);
  const paletteView = useTutorStore((s) => s.paletteView);
  const paletteSource = useTutorStore((s) => s.paletteSource);
  const slashDismissed = useTutorStore((s) => s.slashDismissed);
  const openPalette = useTutorStore((s) => s.openPalette);
  const closePalette = useTutorStore((s) => s.closePalette);
  const setPaletteIndex = useTutorStore((s) => s.setPaletteIndex);
  const setSlashDismissed = useTutorStore((s) => s.setSlashDismissed);

  // Model state & actions
  const modelItems = useTutorStore((s) => s.modelItems);
  const modelLoading = useTutorStore((s) => s.modelLoading);
  const modelError = useTutorStore((s) => s.modelError);
  const setModelItems = useTutorStore((s) => s.setModelItems);
  const setModelLoading = useTutorStore((s) => s.setModelLoading);
  const setModelError = useTutorStore((s) => s.setModelError);

  // Streaming state & actions
  const isStreaming = useTutorStore((s) => s.isStreaming);
  const streamingContent = useTutorStore((s) => s.streamingContent);
  const startStreaming = useTutorStore((s) => s.startStreaming);
  const appendStreamingContent = useTutorStore((s) => s.appendStreamingContent);
  const finishStreaming = useTutorStore((s) => s.finishStreaming);
  const abortStreaming = useTutorStore((s) => s.abortStreaming);

  // Vocab practice state & actions
  const vocabPractice = useTutorStore((s) => s.vocabPractice);
  const setVocabPractice = useTutorStore((s) => s.setVocabPractice);
  const vocabPracticeNext = useTutorStore((s) => s.vocabPracticeNext);
  const vocabPracticeAnswer = useTutorStore((s) => s.vocabPracticeAnswer);
  const vocabPracticeToggleAnswer = useTutorStore((s) => s.vocabPracticeToggleAnswer);

  // Ref to store the current stream controller for aborting
  const streamControllerRef = useRef<{ abort: () => void } | null>(null);

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
      { id: "help", left: "/help", right: "Show help", command: "/help" },
      {
        id: "clear",
        left: "/clear",
        right: "Clear conversation",
        command: "/clear",
      },
      {
        id: "export",
        left: "/export",
        right: "Export chat",
        command: "/export",
      },
      {
        id: "history",
        left: "/history",
        right: "View session history",
        command: "/history",
      },
      {
        id: "mode",
        left: "/mode",
        right: "Choose practice mode",
        command: "/mode",
      },
      {
        id: "summary",
        left: "/summary",
        right: "Generate session summary",
        command: "/summary",
      },
      {
        id: "save",
        left: "/save",
        right: "Save vocabulary words",
        command: "/save",
      },
      {
        id: "vocab",
        left: "/vocab",
        right: "View vocabulary",
        command: "/vocab",
      },
      {
        id: "stats",
        left: "/stats",
        right: "View learning statistics",
        command: "/stats",
      },
      {
        id: "models",
        left: "/models",
        right: `List ${providerInfo.name} models`,
        command: "/models",
        disabled: !resolvedConfig.apiKey,
      },
    ];

    return items;
  }, [providerInfo.name, resolvedConfig.apiKey]);

  const openModelPalette = async () => {
    setModelLoading(true);
    setModelError(null);

    try {
      let fetchedModels: string[];
      if (providerInfo.name === "gemini") {
        fetchedModels = await listGeminiModels(resolvedConfig.apiKey ?? "");
      } else {
        fetchedModels = await listOpenAIModels(resolvedConfig.apiKey ?? "");
      }
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
        {
          id: "models-loading",
          left: "Loading",
          right: "Fetching models...",
          disabled: true,
        },
      ];
    }

    if (modelError) {
      return [
        {
          id: "models-error",
          left: "Error",
          right: `Failed to load models: ${modelError}`,
          disabled: true,
        },
      ];
    }

    if (modelItems.length === 0) {
      return [
        {
          id: "models-empty",
          left: "None",
          right: "No models returned.",
          disabled: true,
        },
      ];
    }

    return modelItems.map((model) => {
      const normalized = model.replace(/^models\//, "");
      return {
        id: `model-${model}`,
        left: normalized,
        right: "Select model",
        modelName: normalized,
      };
    });
  }, [modelError, modelItems, modelLoading]);

  const filteredPaletteItems = useMemo(() => {
    if (paletteView === "models") {
      return modelPaletteItems;
    }

    if (input.startsWith("/") && !input.startsWith("//")) {
      const query = input.toLowerCase();
      const matches = paletteItems.filter((item) =>
        item.left.toLowerCase().startsWith(query),
      );
      return matches.length > 0
        ? matches
        : [
            {
              id: "no-match",
              left: "(none)",
              right: "No matching commands",
              disabled: true,
            },
          ];
    }

    return paletteItems;
  }, [paletteItems, modelPaletteItems, paletteView, input]);

  const runPaletteItem = (item: PaletteItem): boolean => {
    if (item.disabled) {
      return false;
    }

    if (item.command) {
      selectCommand(item.command);
      return true;
    }

    return false;
  };

  const selectCommand = (command: string) => {
    switch (command) {
      case "/help":
        setMainView("help");
        return;
      case "/mode":
        setMainView("modePicker");
        return;
      case "/models":
        setMainView("modelsPicker");
        void openModelPalette();
        return;
      default: {
        const result = runCommand(command);
        if (result) {
          addMessage({
            role: "system",
            content: `${result.isError ? "(System)" : "(Tip)"} ${result.message}`,
          });
        }
      }
    }
  };

  const runPanelItem = (item: PaletteItem): boolean => {
    if (item.disabled) {
      return false;
    }

    if (mainView === "modePicker" && item.mode) {
      setMode(item.mode);
      addMessage({
        role: "assistant",
        content: `(Tip) Mode set to ${item.mode}.`,
      });
      setMainView("chat");
      return true;
    }

    if (mainView === "modelsPicker" && item.modelName) {
      applyModelSelection(item.modelName);
      setMainView("chat");
      return true;
    }

    return false;
  };

  const modePanelItems: PaletteItem[] = useMemo(() => {
    return availableModes.map((option) => ({
      id: `mode-panel-${option}`,
      left: option,
      right: "Set practice mode",
      mode: option,
    }));
  }, []);

  const helpPanelItems: PaletteItem[] = useMemo(() => {
    return [
      { id: "help-tip", left: "//", right: "Send a message starting with /" },
      ...paletteItems,
    ];
  }, [paletteItems]);

  // Close palette when status changes to thinking or on error
  useEffect(() => {
    if (paletteOpen && (status === "thinking" || providerInfo.error)) {
      closePalette();
    }
  }, [paletteOpen, providerInfo.error, status, closePalette]);

  // Open/close palette based on slash input
  useEffect(() => {
    const shouldOpen =
      input.startsWith("/") &&
      !input.startsWith("//") &&
      status !== "thinking" &&
      !providerInfo.error;

    if (shouldOpen && !slashDismissed) {
      if (!paletteOpen) {
        openPalette("commands", "slash");
      }
    } else if (!input.startsWith("/") || input.startsWith("//")) {
      if (slashDismissed) {
        setSlashDismissed(false);
      }
      if (paletteOpen && paletteSource === "slash") {
        closePalette();
      }
    }
  }, [
    input,
    paletteOpen,
    paletteSource,
    status,
    providerInfo.error,
    slashDismissed,
    openPalette,
    closePalette,
    setSlashDismissed,
  ]);

  // Reset palette index when items change
  useEffect(() => {
    if (paletteOpen && paletteIndex >= filteredPaletteItems.length) {
      setPaletteIndex(0);
    }
  }, [paletteOpen, paletteIndex, filteredPaletteItems.length, setPaletteIndex]);

  useInput((inputChar, key) => {
    if (inputChar === "\u0003") {
      if (isStreaming && streamControllerRef.current) {
        streamControllerRef.current.abort();
        abortStreaming();
        addMessage({
          role: "assistant",
          content: streamingContent || "(Response interrupted)",
        });
        return;
      }
      exit();
      return;
    }

    if (paletteOpen) {
      if (key.escape) {
        if (paletteSource === "slash") {
          setSlashDismissed(true);
        }
        closePalette();
        return;
      }

      const items = filteredPaletteItems;
      const count = items.length;

      if (key.upArrow) {
        if (paletteIndex <= 0) {
          setPaletteIndex(-1);
        } else {
          setPaletteIndex(paletteIndex - 1);
        }
        return;
      }

      if (key.downArrow) {
        if (paletteIndex >= count - 1) {
          setPaletteIndex(-1);
        } else {
          setPaletteIndex(paletteIndex + 1);
        }
        return;
      }

      if (key.return) {
        if (paletteIndex === -1 || items.length === 0) {
          return;
        }
        const selected = items[Math.min(paletteIndex, items.length - 1)];
        if (!selected.disabled) {
          runPaletteItem(selected);
          closePalette();
          setInput("");
        }
        return;
      }

      if (paletteSource !== "slash") {
        return;
      }
    }

    if (mainView === "vocabPractice" && vocabPractice) {
      if (key.escape) {
        setMainView("chat");
        setVocabPractice(null);
        const { correct, incorrect } = vocabPractice.score;
        if (correct + incorrect > 0) {
          addMessage({
            role: "assistant",
            content: `(Tip) Practice ended. Score: ${correct}/${correct + incorrect} correct.`,
          });
        }
        return;
      }

      if (!vocabPractice.showAnswer) {
        if (inputChar === " ") {
          vocabPracticeToggleAnswer();
          return;
        }
      } else {
        const currentItem = vocabPractice.items[vocabPractice.currentIndex];
        if (inputChar.toLowerCase() === "y") {
          vocabPracticeAnswer(true);
          if (currentItem) updateVocabMastery(currentItem.id, true);
          vocabPracticeNext();
          return;
        }
        if (inputChar.toLowerCase() === "n") {
          vocabPracticeAnswer(false);
          if (currentItem) updateVocabMastery(currentItem.id, false);
          vocabPracticeNext();
          return;
        }
      }
      return;
    }

    if (mainView !== "chat") {
      if (key.escape) {
        setMainView("chat");
        return;
      }

      if (key.upArrow || key.downArrow) {
        const items =
          mainView === "modePicker" ? modePanelItems : modelPaletteItems;
        const count = items.length || 1;
        const delta = key.upArrow ? -1 : 1;
        const next = (panelIndex + delta + count) % count;
        setPanelIndex(next);
        return;
      }

      if (key.return) {
        const items =
          mainView === "modePicker" ? modePanelItems : modelPaletteItems;
        if (items.length === 0) {
          return;
        }
        const selected = items[Math.min(panelIndex, items.length - 1)];
        runPanelItem(selected);
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
      if (status !== "thinking" && !providerInfo.error) {
        openPalette("commands", "ctrlk");
      }
      return;
    }
  });

  useEffect(() => {
    if (mainView === "modelsPicker" && resolvedConfig.apiKey) {
      void openModelPalette();
    }
  }, [mainView, resolvedConfig.apiKey]);

  useEffect(() => {
    if (mainView !== "chat" && paletteOpen) {
      closePalette();
    }
  }, [mainView, paletteOpen, closePalette]);

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

  const runCommand = (value: string): CommandResult => {
    const ctx: CommandContext = {
      sessionId,
      history,
      difficulty,
      mode,
      resolvedConfig,
      configState,
      provider: providerInfo.provider,
    };

    const actions: CommandActions = {
      resetSession,
      setDifficulty,
      setMode,
      setSessionId,
      setHistory,
      setConfigState,
      setStatus,
      addMessage,
      setMainView,
      setVocabPractice,
      openModelPalette: async () => {
        await openModelPalette();
      },
    };

    return handleCommand(value, ctx, actions);
  };

  const sendChatMessage = (content: string) => {
    if (!providerInfo.provider) {
      return;
    }

    setInput("");

    const userMessageId = randomUUID();
    setHistory((current) => [
      ...current,
      { id: userMessageId, role: "user", content },
    ]);
    saveMessage(userMessageId, sessionId, "user", content);

    const currentHistory = useTutorStore.getState().history;
    const requestHistory: ChatMessage[] = [
      { role: "system", content: buildTutorPrompt(difficulty, mode) },
      ...currentHistory,
    ];

    const assistantMessageId = randomUUID();
    startStreaming(assistantMessageId);

    const controller = providerInfo.provider.streamMessage(
      requestHistory,
      (chunk) => {
        appendStreamingContent(chunk);

        // Scroll to bottom after each chunk
        scrollRef.current?.scrollToBottom();
      },
      (fullResponse) => {
        const assistantMessage = fullResponse || "(No response from tutor.)";
        setHistory((current) => [
          ...current,
          {
            id: assistantMessageId,
            role: "assistant",
            content: assistantMessage,
          },
        ]);
        saveMessage(
          assistantMessageId,
          sessionId,
          "assistant",
          assistantMessage,
        );
        setDifficulty(updateDifficulty(difficulty, content));
        finishStreaming();
        streamControllerRef.current = null;
      },
      (error) => {
        let message = error.message || "Request failed.";
        if (providerInfo.name === "gemini" && /404|not found/i.test(message)) {
          message = `${message} (Try /models to list available Gemini models.)`;
        }
        addMessage({ role: "assistant", content: message });
        finishStreaming();
        setStatus("error");
        streamControllerRef.current = null;
      },
    );

    streamControllerRef.current = controller;
  };

  const handleSubmit = (value: string) => {
    if (status === "thinking" || !value.trim() || !providerInfo.provider) {
      return;
    }

    const trimmed = value.trim();
    if (trimmed.startsWith("//")) {
      const literal = trimmed.slice(1);
      sendChatMessage(literal);
      return;
    }

    if (trimmed.startsWith("/")) {
      selectCommand(trimmed);
      setInput("");
      return;
    }

    sendChatMessage(trimmed);
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
          {mode.toUpperCase()} | {difficulty.toUpperCase()} |{" "}
          {providerInfo.name.toUpperCase()}
        </Text>
      </Box>

      {mainView === "chat" && (
        <ScrollableMessageList
          ref={scrollRef}
          messages={history}
          height={messageListHeight}
          isStreaming={isStreaming}
          streamingContent={streamingContent}
        />
      )}

      {mainView === "help" && (
        <CommandPalette items={helpPanelItems} selectedIndex={0} />
      )}

      {mainView === "modePicker" && (
        <CommandPalette items={modePanelItems} selectedIndex={panelIndex} />
      )}

      {mainView === "modelsPicker" && (
        <CommandPalette items={modelPaletteItems} selectedIndex={panelIndex} />
      )}

      {mainView === "vocabPractice" && vocabPractice && (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="magenta"
          padding={1}
          height={messageListHeight}
        >
          <Box marginBottom={1}>
            <Text bold color="magenta">
              Vocabulary Practice
            </Text>
            <Text color="gray">
              {" "}
              ({vocabPractice.currentIndex + 1}/{vocabPractice.items.length}) | Score:{" "}
              {vocabPractice.score.correct}/{vocabPractice.score.correct + vocabPractice.score.incorrect}
            </Text>
          </Box>

          <Box flexDirection="column" flexGrow={1} justifyContent="center" alignItems="center">
            <Text bold color="cyan">
              {vocabPractice.items[vocabPractice.currentIndex]?.word}
            </Text>

            {vocabPractice.showAnswer && (
              <Box marginTop={1}>
                <Text color="gray">
                  {vocabPractice.items[vocabPractice.currentIndex]?.definition || "(no definition)"}
                </Text>
              </Box>
            )}
          </Box>

          <Box marginTop={1} justifyContent="center">
            {!vocabPractice.showAnswer ? (
              <Text color="gray">Press Space to reveal | Esc to exit</Text>
            ) : (
              <Text color="gray">Press Y (correct) or N (incorrect) | Esc to exit</Text>
            )}
          </Box>
        </Box>
      )}

      {/* Status Bar */}
      <Box
        flexDirection="row"
        justifyContent="space-between"
        marginTop={1}
        paddingX={1}
      >
        <Box flexDirection="row">
          {isStreaming && (
            <Text color="cyan">
              <Spinner type="dots" /> Streaming... (Ctrl+C to stop)
            </Text>
          )}
          {!isStreaming && status === "thinking" && (
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
          focus={
            !providerInfo.error &&
            status !== "thinking" &&
            (!paletteOpen || paletteSource === "slash")
          }
        />
      </Box>

      {paletteOpen && (
        <CommandPalette
          items={filteredPaletteItems}
          selectedIndex={paletteIndex}
        />
      )}

      {/* Footer */}
      <Box
        borderColor="gray"
        borderStyle="single"
        flexWrap="nowrap"
        marginTop={1}
        paddingX={1}
      >
        <Text color="gray">
          <Text bold>Ctrl+K</Text> Commands | <Text bold>Ctrl+C</Text> Exit |{" "}
          <Text bold>↑↓</Text> Scroll
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
