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
import {
  saveMessage,
  updateVocabMastery,
  getSessionHistoryWithSummaries,
  getSessionMessages,
} from "./storage.js";
import { useTutorStore } from "./stores/tutor-store.js";
import type { PracticeMode } from "./conversation.js";
import { CommandPalette } from "./components/command-palette.js";
import {
  handleCommand,
  availableModes,
  getPaletteItems,
  getCommandArgHints,
  getKnownCommands,
  type CommandContext,
  type CommandActions,
  type CommandResult,
} from "./commands.js";
import {
  ScrollableMessageList,
  type ScrollableMessageListRef,
} from "./components/message-list/index.js";
import { SessionPicker } from "./components/session-picker.js";
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
  const lastScrollTimeRef = useRef<number>(0);

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
  const vocabPracticeToggleAnswer = useTutorStore(
    (s) => s.vocabPracticeToggleAnswer,
  );
  const vocabPracticeSetInput = useTutorStore((s) => s.vocabPracticeSetInput);
  const vocabPracticeSelectOption = useTutorStore(
    (s) => s.vocabPracticeSelectOption,
  );
  const vocabPracticeSubmitAnswer = useTutorStore(
    (s) => s.vocabPracticeSubmitAnswer,
  );
  const vocabPracticeClearFeedback = useTutorStore(
    (s) => s.vocabPracticeClearFeedback,
  );

  // Session picker state & actions
  const sessionPickerSessions = useTutorStore((s) => s.sessionPickerSessions);
  const setSessionPickerSessions = useTutorStore(
    (s) => s.setSessionPickerSessions,
  );

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
    return getPaletteItems({
      providerName: providerInfo.name,
      hasApiKey: Boolean(resolvedConfig.apiKey),
    });
  }, [providerInfo.name, resolvedConfig.apiKey]);

  const commandNames = useMemo(() => getKnownCommands(), []);

  const commandArgHints = useMemo<Record<string, PaletteItem[]>>(() => {
    const entries = commandNames.map((command) => {
      const hints = getCommandArgHints(command).map((hint, index) => ({
        id: `${command}-hint-${index}`,
        left: hint.left,
        right: hint.right,
        disabled: true,
      }));
      return [command, hints] as const;
    });
    return Object.fromEntries(entries);
  }, [commandNames]);

  const knownCommands = useMemo(
    () => new Set(commandNames),
    [commandNames],
  );

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

  const isArgInput =
    input.startsWith("/") && !input.startsWith("//") && input.includes(" ");

  const filteredPaletteItems = useMemo(() => {
    if (paletteView === "models") {
      return modelPaletteItems;
    }

    if (input.startsWith("/") && !input.startsWith("//")) {
      const commandKey = input.split(/\s+/)[0]?.toLowerCase();
      if (input.includes(" ")) {
        return (
          commandArgHints[commandKey] ?? [
            {
              id: "no-arg-hints",
              left: "(none)",
              right: "No argument tips available",
              disabled: true,
            },
          ]
        );
      }

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
  }, [paletteItems, modelPaletteItems, paletteView, input, commandArgHints]);

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
      case "/history":
        setSessionPickerSessions(getSessionHistoryWithSummaries(20));
        setMainView("sessionPicker");
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
        return;
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
    const isSlashCommand = input.startsWith("/") && !input.startsWith("//");

    const shouldOpen =
      isSlashCommand && status !== "thinking" && !providerInfo.error;

    if (shouldOpen && !slashDismissed) {
      if (!paletteOpen) {
        openPalette("commands", "slash");
      }
    } else if (!isSlashCommand) {
      if (slashDismissed && !isSlashCommand) {
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

  // Reset palette index when items change, auto-highlight single match
  useEffect(() => {
    if (!paletteOpen) return;

    if (isArgInput) {
      setPaletteIndex(-1);
      return;
    }

    const validItems = filteredPaletteItems.filter((item) => !item.disabled);
    if (validItems.length === 1) {
      setPaletteIndex(0);
    } else if (paletteIndex >= filteredPaletteItems.length) {
      setPaletteIndex(0);
    }
  }, [paletteOpen, paletteIndex, filteredPaletteItems, setPaletteIndex, isArgInput]);

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
      if (paletteSource === "slash" && isArgInput) {
        if (key.escape) {
          setSlashDismissed(true);
          closePalette();
        }
        return;
      }

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

      const currentItem = vocabPractice.items[vocabPractice.currentIndex];

      if (vocabPractice.mode === "flashcard") {
        if (vocabPractice.feedback) {
          if (key.return || inputChar === " ") {
            if (currentItem) {
              updateVocabMastery(currentItem.id, vocabPractice.feedback.correct);
            }
            vocabPracticeClearFeedback();
            vocabPracticeNext();
            return;
          }
        } else if (!vocabPractice.showAnswer) {
          if (inputChar === " ") {
            vocabPracticeToggleAnswer();
            return;
          }
        } else {
          if (inputChar.toLowerCase() === "y") {
            vocabPracticeAnswer(true);
            return;
          }
          if (inputChar.toLowerCase() === "n") {
            vocabPracticeAnswer(false);
            return;
          }
        }
      }

      if (vocabPractice.mode === "type-answer") {
        if (vocabPractice.feedback) {
          if (key.return || inputChar === " ") {
            if (currentItem) {
              updateVocabMastery(currentItem.id, vocabPractice.feedback.correct);
            }
            vocabPracticeClearFeedback();
            vocabPracticeNext();
            return;
          }
        } else {
          if (key.return) {
            vocabPracticeSubmitAnswer();
            return;
          }
          if (key.backspace || key.delete) {
            vocabPracticeSetInput(vocabPractice.userInput.slice(0, -1));
            return;
          }
          if (inputChar && inputChar.length === 1 && !key.ctrl && !key.meta) {
            vocabPracticeSetInput(vocabPractice.userInput + inputChar);
            return;
          }
        }
      }

      if (vocabPractice.mode === "multiple-choice") {
        if (vocabPractice.feedback) {
          if (key.return || inputChar === " ") {
            if (currentItem) {
              updateVocabMastery(currentItem.id, vocabPractice.feedback.correct);
            }
            vocabPracticeClearFeedback();
            vocabPracticeNext();
            return;
          }
        } else {
          const optionKeys = ["a", "b", "c", "d"];
          const lowerChar = inputChar.toLowerCase();
          const optionIndex = optionKeys.indexOf(lowerChar);
          if (optionIndex !== -1 && currentItem?.mcOptions?.[optionIndex]) {
            vocabPracticeSelectOption(optionIndex);
            return;
          }
          if (key.return && vocabPractice.selectedOption !== null) {
            vocabPracticeSubmitAnswer();
            return;
          }
        }
      }

      return;
    }

    if (mainView === "sessionPicker") {
      if (key.escape || inputChar.toLowerCase() === "b") {
        setMainView("chat");
        return;
      }

      if (key.upArrow || key.downArrow) {
        const count = sessionPickerSessions.length || 1;
        const delta = key.upArrow ? -1 : 1;
        const next = (panelIndex + delta + count) % count;
        setPanelIndex(next);
        return;
      }

      if (key.return) {
        const selected = sessionPickerSessions[panelIndex];
        if (selected) {
          setSessionId(selected.session_id);
          const messages = getSessionMessages(selected.session_id);
          if (messages.length > 0) {
            const chatMessages = messages.map((m) => ({
              id: m.message_id,
              role: m.role as "user" | "assistant" | "system",
              content: m.content,
            }));
            setHistory(() => chatMessages);
          }
          setMainView("chat");
          addMessage({
            role: "system",
            content: `(Tip) Resumed session ${selected.session_id.slice(0, 8)} with ${messages.length} messages.`,
          });
        }
        return;
      }

      if (inputChar.toLowerCase() === "r") {
        const selected = sessionPickerSessions[panelIndex];
        if (selected) {
          setInput(`/rename ${selected.session_id} `);
          setMainView("chat");
        }
        return;
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

  });

  useEffect(() => {
    if (mainView === "modelsPicker" && resolvedConfig.apiKey) {
      void openModelPalette();
    }
  }, [mainView, resolvedConfig.apiKey]);

  useEffect(() => {
    if (mainView === "sessionPicker") {
      const sessions = getSessionHistoryWithSummaries(20);
      setSessionPickerSessions(sessions);
      setPanelIndex(0);
    }
  }, [mainView, setSessionPickerSessions, setPanelIndex]);

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

        const now = Date.now();
        if (now - lastScrollTimeRef.current > 150) {
          lastScrollTimeRef.current = now;
          scrollRef.current?.scrollToBottom();
        }
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
        scrollRef.current?.scrollToBottom();
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
      const commandKey = trimmed.split(/\s+/)[0]?.toLowerCase();
      const hasArgs = trimmed.includes(" ");
      if (paletteOpen && paletteSource === "slash" && !hasArgs) {
        return;
      }
      if (!knownCommands.has(commandKey) && !hasArgs) {
        return;
      }
      selectCommand(trimmed);
      setInput("");
      return;
    }

    sendChatMessage(trimmed);
  };

  const messageListHeight = Math.max(5, terminalSize.height - 15);
  const fullscreenHeight = Math.max(5, terminalSize.height - 4);

  const isFullscreenView = mainView !== "chat";
  const viewHeight = isFullscreenView ? fullscreenHeight : messageListHeight;

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
      {!isFullscreenView && (
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
      )}

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

      {mainView === "sessionPicker" && (
        <SessionPicker
          sessions={sessionPickerSessions}
          selectedIndex={panelIndex}
          height={viewHeight}
        />
      )}

      {mainView === "vocabPractice" && vocabPractice && (() => {
        const currentItem = vocabPractice.items[vocabPractice.currentIndex];
        const modeLabel = vocabPractice.mode === "flashcard" ? "Flashcard" :
          vocabPractice.mode === "type-answer" ? "Type Answer" : "Multiple Choice";

        return (
          <Box
            flexDirection="column"
            borderStyle="round"
            borderColor="magenta"
            padding={1}
            height={messageListHeight}
          >
            <Box marginBottom={1}>
              <Text bold color="magenta">
                Vocabulary Practice ({modeLabel})
              </Text>
              <Text color="gray">
                {" "}
                ({vocabPractice.currentIndex + 1}/{vocabPractice.items.length}) |
                Score: {vocabPractice.score.correct}/
                {vocabPractice.score.correct + vocabPractice.score.incorrect}
              </Text>
            </Box>

            <Box
              flexDirection="column"
              flexGrow={1}
              justifyContent="center"
              alignItems="center"
            >
              {vocabPractice.mode === "flashcard" && (
                <>
                  <Text bold color="cyan">
                    {currentItem?.word}
                  </Text>
                  {vocabPractice.showAnswer && (
                    <Box marginTop={1}>
                      <Text color="gray">
                        {currentItem?.definition || "(no definition)"}
                      </Text>
                    </Box>
                  )}
                  {vocabPractice.feedback && (
                    <Box marginTop={1}>
                      <Text color={vocabPractice.feedback.correct ? "green" : "red"}>
                        {vocabPractice.feedback.message}
                      </Text>
                    </Box>
                  )}
                </>
              )}

              {vocabPractice.mode === "type-answer" && (
                <>
                  <Text color="gray">What word matches this definition?</Text>
                  <Box marginTop={1}>
                    <Text bold color="cyan">
                      {currentItem?.definition || "(no definition)"}
                    </Text>
                  </Box>
                  <Box marginTop={1}>
                    <Text>Your answer: </Text>
                    <Text bold color="yellow">
                      {vocabPractice.userInput || "_"}
                    </Text>
                  </Box>
                  {vocabPractice.feedback && (
                    <Box marginTop={1}>
                      <Text color={vocabPractice.feedback.correct ? "green" : "red"}>
                        {vocabPractice.feedback.message}
                      </Text>
                    </Box>
                  )}
                </>
              )}

              {vocabPractice.mode === "multiple-choice" && (
                <>
                  <Text color="gray">What word matches this definition?</Text>
                  <Box marginTop={1}>
                    <Text bold color="cyan">
                      {currentItem?.definition || "(no definition)"}
                    </Text>
                  </Box>
                  <Box marginTop={1} flexDirection="column">
                    {currentItem?.mcOptions?.map((option, idx) => {
                      const letter = String.fromCharCode(65 + idx);
                      const isSelected = vocabPractice.selectedOption === idx;
                      const isCorrect = vocabPractice.feedback && idx === currentItem.mcCorrectIndex;
                      const isWrong = vocabPractice.feedback && isSelected && !vocabPractice.feedback.correct;
                      
                      let color: string = "white";
                      if (isCorrect) color = "green";
                      else if (isWrong) color = "red";
                      else if (isSelected) color = "yellow";

                      return (
                        <Box key={idx}>
                          <Text color={color}>
                            {isSelected ? "▸ " : "  "}
                            {letter}. {option}
                          </Text>
                        </Box>
                      );
                    })}
                  </Box>
                  {vocabPractice.feedback && (
                    <Box marginTop={1}>
                      <Text color={vocabPractice.feedback.correct ? "green" : "red"}>
                        {vocabPractice.feedback.message}
                      </Text>
                    </Box>
                  )}
                </>
              )}
            </Box>

            <Box marginTop={1} justifyContent="center">
              {vocabPractice.mode === "flashcard" && (
                vocabPractice.feedback ? (
                  <Text color="gray">Press Enter or Space to continue | Esc to exit</Text>
                ) : !vocabPractice.showAnswer ? (
                  <Text color="gray">Press Space to reveal | Esc to exit</Text>
                ) : (
                  <Text color="gray">
                    Press Y (correct) or N (incorrect) | Esc to exit
                  </Text>
                )
              )}
              {vocabPractice.mode === "type-answer" && (
                vocabPractice.feedback ? (
                  <Text color="gray">Press Enter or Space to continue | Esc to exit</Text>
                ) : (
                  <Text color="gray">Type your answer and press Enter | Esc to exit</Text>
                )
              )}
              {vocabPractice.mode === "multiple-choice" && (
                vocabPractice.feedback ? (
                  <Text color="gray">Press Enter or Space to continue | Esc to exit</Text>
                ) : (
                  <Text color="gray">Press A/B/C/D to select, Enter to confirm | Esc to exit</Text>
                )
              )}
            </Box>
          </Box>
        );
      })()}

      {!isFullscreenView && (
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
      )}

      {!isFullscreenView && (
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
            placeholder="Type your message..."
            showCursor={true}
            focus={
              !providerInfo.error &&
              status !== "thinking" &&
              (!paletteOpen || paletteSource === "slash")
            }
          />
        </Box>
      )}

      {paletteOpen && !isFullscreenView && (
        <CommandPalette
          items={filteredPaletteItems}
          selectedIndex={paletteIndex}
        />
      )}

      {!isFullscreenView && (
        <Box
          borderColor="gray"
          borderStyle="single"
          flexWrap="nowrap"
          marginTop={1}
          paddingX={1}
        >
          <Text color="gray">
            <Text bold>Ctrl+C</Text> Exit | <Text bold>↑↓</Text> Scroll
          </Text>
        </Box>
      )}
    </Box>
  );
};

render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
  {
    incrementalRendering: true,
    maxFps: 15,
  },
);
