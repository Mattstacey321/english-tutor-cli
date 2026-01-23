import { randomUUID } from "node:crypto";
import type { Difficulty } from "./adaptive.js";
import type { PracticeMode } from "./conversation.js";
import type { ResolvedConfig, TutorConfig } from "./config.js";
import { writeConfig } from "./config.js";
import type { ChatMessage, TutorProvider } from "./providers/types.js";
import {
  getSessionMessages,
  getSessionHistoryWithSummaries,
  getSessionWithSummary,
  updateSessionSummary,
  updateSessionTitle,
  saveVocabItem,
  saveVocabItemsWithDefs,
  getVocabByCollection,
  getAllVocab,
  getVocabStats,
  getCollections,
  createCollection,
  getVocabForPractice,
  getVocabDistractors,
  getLearningStats,
  isValidWord,
} from "./storage.js";
import {
  exportConversation,
  isValidExportFormat,
  type ExportFormat,
} from "./export.js";
import {
  generateSessionSummary,
  buildResumeContext,
  generateSessionTitle,
} from "./summary.js";
import type {
  ConfigState,
  VocabPracticeState,
  MainView,
} from "./stores/tutor-store.js";

export type CommandResult = { message: string; isError?: boolean } | null;
export type CommandArgHint = { left: string; right?: string };
export type CommandPaletteContext = {
  providerName: string;
  hasApiKey: boolean;
};
export type CommandPaletteItem = {
  id: string;
  left: string;
  right?: string;
  command: string;
  disabled?: boolean;
};

export const availableModes: PracticeMode[] = [
  "general",
  "grammar",
  "vocab",
  "role-play",
  "fluency",
  "exam",
];

export type CommandDefinition = {
  command: string;
  description: string;
  handle: (value: string, ctx: CommandContext, actions: CommandActions) => CommandResult;
  isPaletteCommand?: boolean;
  getDisabledReason?: (ctx: CommandPaletteContext) => string | null;
  getArgHints?: () => CommandArgHint[];
};

const formatModeHelp = () => `Modes: ${availableModes.join(", ")}`;

const exportFormatHints = (): CommandArgHint[] => [
  { left: "md", right: "Export as markdown" },
  { left: "txt", right: "Export as plain text" },
  { left: "json", right: "Export as JSON" },
];

const saveArgHint = (): CommandArgHint[] => [
  { left: "<word> <collection>", right: "Default collection if omitted" },
];

const renameArgHint = (): CommandArgHint[] => [
  { left: "<session_id> <new_title>", right: "Rename a session" },
];

const summaryArgHint = (): CommandArgHint[] => [
  { left: "--regenerate", right: "Regenerate the session summary" },
];

const configArgHint = (): CommandArgHint[] => [
  { left: "summary-model <model_id>", right: "Override summary model" },
  { left: "summary-model --reset", right: "Use main model" },
];

const resumeArgHint = (): CommandArgHint[] => [
  { left: "<session_id_prefix>", right: "Resume a session" },
];

const difficultyArgHint = (): CommandArgHint[] => [
  { left: "beginner", right: "Set beginner difficulty" },
  { left: "intermediate", right: "Set intermediate difficulty" },
  { left: "advanced", right: "Set advanced difficulty" },
];

const clearArgHint = (): CommandArgHint[] => [
  { left: "--new-session", right: "Reset with a new session id" },
];

const modeArgHint = (): CommandArgHint[] =>
  availableModes.map((mode) => ({ left: mode, right: "Set practice mode" }));

const vocabArgHint = (): CommandArgHint[] => [
  { left: "list [collection]", right: "List vocabulary" },
  { left: "stats", right: "Show vocabulary stats" },
  { left: "collections", right: "List collections" },
  { left: "practice [collection]", right: "Start practice" },
];

const statsArgHint = (): CommandArgHint[] => [
  { left: "week", right: "Weekly stats" },
  { left: "month", right: "Monthly stats" },
];


export const commandRegistry: CommandDefinition[] = [
  {
    command: "/help",
    description: "Show help",
    handle: () => {
      const available = commandRegistry.map((entry) => entry.command).join(", ");
      return {
        message: `Commands: ${available}\nTip: To send a message starting with /, type //`,
      };
    },
    isPaletteCommand: true,
  },
  {
    command: "/clear",
    description: "Clear conversation",
    handle: (value, _ctx, actions) => {
      const args = value.trim().split(/\s+/).slice(1);
      const newSession = args.includes("--new-session");
      actions.resetSession(newSession);
      return {
        message: newSession
          ? "Conversation cleared. Started new session."
          : "Conversation cleared.",
      };
    },
    isPaletteCommand: true,
    getArgHints: clearArgHint,
  },
  {
    command: "/config",
    description: "View or update config",
    handle: (value, ctx, actions) => {
      const args = value.trim().split(/\s+/).slice(1);
      const key = args[0]?.toLowerCase();
      const configValue = args.slice(1).join(" ");

      if (!key) {
        const summaryModelDisplay = ctx.resolvedConfig.summaryModel ?? "(same as main)";
        return {
          message: `Current Configuration:\n\n  Provider: ${ctx.resolvedConfig.provider}\n  Model: ${ctx.resolvedConfig.model}\n  Summary Model: ${summaryModelDisplay}\n  Config Path: ${ctx.configState.path}\n\nUse /config <key> <value> to change settings.\nKeys: summary-model`,
        };
      }

      if (key === "summary-model") {
        if (!configValue) {
          return {
            message: `Summary model: ${ctx.resolvedConfig.summaryModel ?? "(same as main)"}`,
          };
        }
        const isReset = configValue === "--reset" || configValue === "reset";
        const nextConfig: TutorConfig = {
          provider: ctx.resolvedConfig.provider,
          model: ctx.resolvedConfig.model,
          ...(ctx.configState.config?.apiKey
            ? { apiKey: ctx.configState.config.apiKey }
            : {}),
          ...(isReset ? {} : { summaryModel: configValue }),
        };
        writeConfig(nextConfig);
        actions.setConfigState({
          config: nextConfig,
          error: null,
          path: ctx.configState.path,
        });
        return {
          message: isReset
            ? "Summary model reset to use main model."
            : `Summary model set to ${configValue}.`,
        };
      }

      return {
        message: `Unknown config key: ${key}. Available: summary-model`,
        isError: true,
      };
    },
    isPaletteCommand: false,
    getArgHints: configArgHint,
  },
  {
    command: "/difficulty",
    description: "Set difficulty",
    handle: (value, ctx, actions) => {
      const args = value.trim().split(/\s+/).slice(1);
      const validLevels: Difficulty[] = [
        "beginner",
        "intermediate",
        "advanced",
      ];
      const requested = (args[0] ?? "").toLowerCase();
      if (!requested) {
        return {
          message: `Current difficulty: ${ctx.difficulty}. Options: ${validLevels.join(", ")}`,
        };
      }
      if (validLevels.includes(requested as Difficulty)) {
        actions.setDifficulty(requested as Difficulty);
        return { message: `Difficulty set to ${requested}.` };
      }
      return {
        message: `Unknown difficulty. Options: ${validLevels.join(", ")}`,
        isError: true,
      };
    },
    isPaletteCommand: false,
    getArgHints: difficultyArgHint,
  },
  {
    command: "/mode",
    description: "Choose practice mode",
    handle: (value, _ctx, actions) => {
      const args = value.trim().split(/\s+/).slice(1);
      const requested = (args[0] ?? "").toLowerCase();
      if (!requested) {
        return { message: formatModeHelp() };
      }
      if (availableModes.includes(requested as PracticeMode)) {
        actions.setMode(requested as PracticeMode);
        return { message: `Mode set to ${requested}.` };
      }
      return { message: `Unknown mode. ${formatModeHelp()}`, isError: true };
    },
    isPaletteCommand: true,
    getArgHints: modeArgHint,
  },
  {
    command: "/export",
    description: "Export chat",
    handle: (value, ctx) => {
      if (ctx.history.length === 0) {
        return { message: "No messages to export.", isError: true };
      }
      const args = value.trim().split(/\s+/).slice(1);
      const formatArg = (args[0] ?? "md").toLowerCase();
      if (!isValidExportFormat(formatArg)) {
        return {
          message: "Invalid format. Options: md, txt, json",
          isError: true,
        };
      }
      try {
        const result = exportConversation(
          ctx.history,
          ctx.sessionId,
          formatArg as ExportFormat,
        );
        return { message: `Exported to ${result.filename}` };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Export failed";
        return { message: msg, isError: true };
      }
    },
    isPaletteCommand: true,
    getArgHints: exportFormatHints,
  },
  {
    command: "/history",
    description: "View session history",
    handle: (_value, _ctx, actions) => {
      actions.setMainView("sessionPicker");
      return null;
    },
    isPaletteCommand: true,
  },
  {
    command: "/resume",
    description: "Resume session",
    handle: (value, ctx, actions) => {
      const args = value.trim().split(/\s+/).slice(1);
      const targetId = args[0];
      if (!targetId) {
        actions.setMainView("sessionPicker");
        return null;
      }
      const sessions = getSessionHistoryWithSummaries(100);
      const match = sessions.find((s) => s.session_id.startsWith(targetId));
      if (!match) {
        return {
          message: `Session "${targetId}" not found. Use /history to list sessions.`,
          isError: true,
        };
      }

      actions.setSessionId(match.session_id);

      if (match.summary) {
        const resumeContext = buildResumeContext(
          match.summary,
          ctx.difficulty,
          ctx.mode,
        );
        actions.setHistory(() => [
          {
            id: randomUUID(),
            role: "system" as const,
            content: resumeContext,
          },
        ]);
        return {
          message: `Resumed session ${match.session_id.slice(0, 8)} using summary. Previous: ${match.message_count} messages.`,
        };
      }

      const messages = getSessionMessages(match.session_id);
      if (messages.length === 0) {
        return { message: "Session has no messages.", isError: true };
      }
      const chatMessages = messages.map((m) => ({
        id: m.message_id,
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      }));
      actions.setHistory(() => chatMessages);
      return {
        message: `Resumed session ${match.session_id.slice(0, 8)} with ${messages.length} messages. (Tip: Use /summary to generate a summary for faster resume next time)`,
      };
    },
    isPaletteCommand: false,
    getArgHints: resumeArgHint,
  },
  {
    command: "/rename",
    description: "Rename session",
    handle: (value) => {
      const args = value.trim().split(/\s+/).slice(1);
      const targetId = args[0];
      const newTitle = args.slice(1).join(" ").trim();
      if (!targetId || !newTitle) {
        return {
          message: "Usage: /rename <session_id> <new title>",
          isError: true,
        };
      }
      const sessions = getSessionHistoryWithSummaries(100);
      const matches = sessions.filter((s) => s.session_id.startsWith(targetId));
      if (matches.length === 0) {
        return {
          message: `Session "${targetId}" not found. Use /history to list sessions.`,
          isError: true,
        };
      }
      if (matches.length > 1) {
        return {
          message: `Session id prefix "${targetId}" is ambiguous. Please type more characters.`,
          isError: true,
        };
      }
      const match = matches[0];
      updateSessionTitle(match.session_id, newTitle);
      return {
        message: `Session ${match.session_id.slice(0, 8)} renamed to "${newTitle}".`,
      };
    },
    isPaletteCommand: true,
    getArgHints: renameArgHint,
  },
  {
    command: "/summary",
    description: "Generate session summary",
    handle: (value, ctx, actions) => {
      if (!ctx.provider) {
        return { message: "Provider not configured.", isError: true };
      }
      if (ctx.history.length === 0) {
        return { message: "No messages to summarize.", isError: true };
      }

      const args = value.trim().split(/\s+/).slice(1);
      const existingSession = getSessionWithSummary(ctx.sessionId);
      if (existingSession?.summary && !args.includes("--regenerate")) {
        return {
          message: `Session Summary:\n\n${existingSession.summary}\n\n(Use /summary --regenerate to create a new summary)`,
        };
      }

      const provider = ctx.provider;
      actions.setStatus("thinking");
      generateSessionSummary(provider, ctx.history)
        .then(async (summary) => {
          updateSessionSummary(ctx.sessionId, summary);

          const existingTitle = existingSession?.title;
          let titleMessage = "";
          if (!existingTitle) {
            try {
              const title = await generateSessionTitle(provider, ctx.history);
              updateSessionTitle(ctx.sessionId, title);
              titleMessage = `\nTitle: "${title}"`;
            } catch {
              titleMessage = "";
            }
          }

          actions.addMessage({
            role: "assistant",
            content: `(Tip) Summary generated:${titleMessage}\n\n${summary}`,
          });
          actions.setStatus("idle");
        })
        .catch(() => {
          actions.addMessage({
            role: "assistant",
            content: "(System) Failed to generate summary.",
          });
          actions.setStatus("idle");
        });

      return null;
    },
    isPaletteCommand: true,
    getArgHints: summaryArgHint,
  },
  {
    command: "/save",
    description: "Save vocabulary words",
    handle: (value) => {
      const args = value.trim().split(/\s+/).slice(1);
      if (args.length === 0) {
        return {
          message:
            "Usage: /save <word1, word2, ...> [collection] [--def \"definition\"]\nExample: /save apple, banana, cherry fruits\nExample: /save vocabulary --def \"a list of words\"\n\nNote: Without --def, words are saved with null definitions (use /save word --def for definitions)",
          isError: true,
        };
      }

      const defIndex = args.findIndex((a) => a === "--def");
      let manualDef: string | undefined;
      let remainingArgs = args;
      
      if (defIndex !== -1) {
        manualDef = args.slice(defIndex + 1).join(" ").replace(/^"|"$/g, "");
        remainingArgs = args.slice(0, defIndex);
      }

      const lastArg = remainingArgs[remainingArgs.length - 1];
      const hasCollection = remainingArgs.length > 1 && !lastArg.includes(",");
      const collection = hasCollection ? lastArg.toLowerCase() : "default";
      const wordsArg = hasCollection
        ? remainingArgs.slice(0, -1).join(" ")
        : remainingArgs.join(" ");
      const words = wordsArg
        .split(",")
        .map((w) => w.trim())
        .filter(Boolean);

      if (words.length === 0) {
        return { message: "No words provided.", isError: true };
      }

      if (hasCollection && collection !== "default") {
        createCollection(collection);
      }

      if (manualDef && words.length > 1) {
        return {
          message: "The --def flag can only be used with a single word.\nExample: /save word --def \"definition\"",
          isError: true,
        };
      }

      if (manualDef && words.length === 1) {
        const result = saveVocabItem(words[0], { definition: manualDef, collection });
        if (result.saved) {
          return { message: `Saved "${result.word}" with definition to "${collection}" collection.` };
        }
        return { message: `Failed to save "${result.word}": ${result.reason}`, isError: true };
      }

      const items = words.map((w) => ({ word: w }));
      const { success, failed } = saveVocabItemsWithDefs(items, collection);
      
      let message = `Saved ${success.length} word${success.length !== 1 ? "s" : ""} to "${collection}" collection.`;
      if (failed.length > 0) {
        const failedList = failed.map(f => `${f.word}: ${f.reason}`).join(", ");
        message += `\n\nFailed to save: ${failedList}`;
      }
      
      return { message, isError: failed.length > 0 };
    },
    isPaletteCommand: true,
    getArgHints: saveArgHint,
  },
  {
    command: "/vocab",
    description: "View vocabulary",
    handle: (value, _ctx, actions) => {
      const args = value.trim().split(/\s+/).slice(1);
      const subcommand = args[0]?.toLowerCase();

      if (!subcommand || subcommand === "list") {
        const collection = args[1];
        const items = collection ? getVocabByCollection(collection) : getAllVocab(50);

        if (items.length === 0) {
          return {
            message: collection
              ? `No vocabulary in "${collection}" collection.`
              : "No vocabulary saved yet. Use /save to add words.",
          };
        }

        const grouped = new Map<string, string[]>();
        for (const item of items) {
          const col = item.collection;
          if (!grouped.has(col)) grouped.set(col, []);
          grouped.get(col)!.push(item.word);
        }

        const lines: string[] = [];
        for (const [col, vocabWords] of grouped) {
          lines.push(`[${col}] ${vocabWords.join(", ")}`);
        }

        return {
          message: `Vocabulary (${items.length} words):\n\n${lines.join("\n")}`,
        };
      }

      if (subcommand === "stats") {
        const stats = getVocabStats();
        return {
          message: `Vocabulary Stats:\n\n  Total words: ${stats.total}\n  Mastered: ${stats.mastered}\n  Learning: ${stats.learning}\n  Collections: ${stats.collections}`,
        };
      }

      if (subcommand === "collections") {
        const collections = getCollections();
        if (collections.length === 0) {
          return {
            message: "No collections yet. Words are saved to 'default' collection.",
          };
        }
        const lines = collections.map(
          (c) => `  ${c.name.padEnd(15)} ${c.word_count ?? 0} words`,
        );
        return { message: `Collections:\n\n${lines.join("\n")}` };
      }

      if (subcommand === "practice") {
        const hasTypeFlag = args.includes("--type");
        const hasMcFlag = args.includes("--mc");
        const mode = hasMcFlag ? "multiple-choice" : hasTypeFlag ? "type-answer" : "flashcard";
        
        const collection = args.slice(1).find((arg) => !arg.startsWith("--"));
        const practiceItems = getVocabForPractice(collection, 10);

        if (practiceItems.length === 0) {
          return {
            message: collection
              ? `No vocabulary in "${collection}" to practice.`
              : "No vocabulary to practice. Use /save to add words first.",
            isError: true,
          };
        }

        if (mode === "multiple-choice" && practiceItems.length < 4) {
          return {
            message: "Multiple-choice mode requires at least 4 vocabulary words. Using flashcard mode instead.",
            isError: false,
          };
        }

        const items = practiceItems.map((item) => {
          const base = {
            id: item.id,
            word: item.word,
            definition: item.definition,
          };

          if (mode === "multiple-choice") {
            const distractors = getVocabDistractors(item.word, collection, 3);
            const allOptions = [item.word, ...distractors];
            for (let i = allOptions.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
            }
            return {
              ...base,
              mcOptions: allOptions,
              mcCorrectIndex: allOptions.indexOf(item.word),
            };
          }

          return base;
        });

        actions.setVocabPractice({
          mode: mode as "flashcard" | "type-answer" | "multiple-choice",
          items,
          currentIndex: 0,
          showAnswer: false,
          score: { correct: 0, incorrect: 0 },
          userInput: "",
          selectedOption: null,
          feedback: null,
        });
        actions.setMainView("vocabPractice");
        return null;
      }

      return {
        message:
          "Usage: /vocab [list|stats|collections|practice] [collection] [--type|--mc]\nExamples:\n  /vocab - list all words\n  /vocab list fruits - list words in 'fruits' collection\n  /vocab stats - show statistics\n  /vocab collections - list all collections\n  /vocab practice - flashcard mode (default)\n  /vocab practice --type - type-the-answer mode\n  /vocab practice --mc - multiple-choice mode",
        isError: true,
      };
    },
    isPaletteCommand: true,
    getArgHints: vocabArgHint,
  },
  {
    command: "/stats",
    description: "View learning statistics",
    handle: (_value, _ctx, _actions) => {
      const stats = getLearningStats();

      const sessionLines = [
        `  Total: ${stats.sessions.total}`,
        `  This week: ${stats.sessions.thisWeek}`,
        `  This month: ${stats.sessions.thisMonth}`,
      ];

      const messageLines = [
        `  Total: ${stats.messages.total}`,
        `  You sent: ${stats.messages.userMessages}`,
        `  Tutor replies: ${stats.messages.assistantMessages}`,
        `  Avg per session: ${stats.messages.avgPerSession}`,
      ];

      const vocabLines = [
        `  Total words: ${stats.vocabulary.total}`,
        `  Mastered: ${stats.vocabulary.mastered}`,
        `  Learning: ${stats.vocabulary.learning}`,
        `  Reviewed today: ${stats.vocabulary.reviewedToday}`,
        `  Total reviews: ${stats.vocabulary.totalReviews}`,
      ];

      const streakLines = [
        `  Current streak: ${stats.streaks.currentStreak} day${stats.streaks.currentStreak !== 1 ? "s" : ""}`,
        `  Longest streak: ${stats.streaks.longestStreak} day${stats.streaks.longestStreak !== 1 ? "s" : ""}`,
        `  Last active: ${stats.streaks.lastActiveDate ?? "Never"}`,
      ];

      const modeLines: string[] = [];
      if (stats.practice.mostUsedMode) {
        modeLines.push(`  Favorite mode: ${stats.practice.mostUsedMode}`);
        const breakdown = Object.entries(stats.practice.modeBreakdown)
          .map(([mode, count]) => `${mode}: ${count}`)
          .join(", ");
        if (breakdown) {
          modeLines.push(`  Breakdown: ${breakdown}`);
        }
      } else {
        modeLines.push("  No practice mode data yet");
      }

      const output = [
        "📊 Learning Statistics\n",
        "Sessions:",
        ...sessionLines,
        "",
        "Messages:",
        ...messageLines,
        "",
        "Vocabulary:",
        ...vocabLines,
        "",
        "Streaks:",
        ...streakLines,
        "",
        "Practice Modes:",
        ...modeLines,
      ].join("\n");

      return { message: output };
    },
    isPaletteCommand: true,
    getArgHints: statsArgHint,
  },
  {
    command: "/models",
    description: "List models",
    handle: (_value, ctx, actions) => {
      if (!ctx.resolvedConfig.apiKey) {
        return {
          message: "API key required to list models.",
          isError: true,
        };
      }
      void actions.openModelPalette();
      return null;
    },
    isPaletteCommand: true,
    getDisabledReason: ({ hasApiKey }) =>
      hasApiKey ? null : "API key required",
  },
];

export const getPaletteItems = (
  ctx: CommandPaletteContext,
): CommandPaletteItem[] => {
  return commandRegistry
    .filter((entry) => entry.isPaletteCommand)
    .map((entry) => {
      const disabledReason = entry.getDisabledReason?.(ctx) ?? null;
      return {
        id: entry.command.slice(1),
        left: entry.command,
        right: disabledReason ? disabledReason : entry.description,
        command: entry.command,
        disabled: Boolean(disabledReason),
      };
    });
};

export const getCommandArgHints = (command: string): CommandArgHint[] => {
  const entry = commandRegistry.find((item) => item.command === command);
  return entry?.getArgHints?.() ?? [];
};

export const getKnownCommands = (): string[] =>
  commandRegistry.map((entry) => entry.command);

export const getCommandByName = (command: string): CommandDefinition | undefined =>
  commandRegistry.find((entry) => entry.command === command);

export interface CommandContext {
  sessionId: string;
  history: ChatMessage[];
  difficulty: Difficulty;
  mode: PracticeMode;
  resolvedConfig: ResolvedConfig;
  configState: ConfigState;
  provider: TutorProvider | null;
}

export interface CommandActions {
  resetSession: (newSession?: boolean) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  setMode: (mode: PracticeMode) => void;
  setSessionId: (id: string) => void;
  setHistory: (updater: (current: ChatMessage[]) => ChatMessage[]) => void;
  setConfigState: (state: ConfigState) => void;
  setStatus: (status: "idle" | "thinking" | "error") => void;
  addMessage: (message: ChatMessage) => void;
  setMainView: (view: MainView) => void;
  setVocabPractice: (state: VocabPracticeState | null) => void;
  openModelPalette: () => Promise<void>;
}

export const handleCommand = (
  value: string,
  ctx: CommandContext,
  actions: CommandActions,
): CommandResult => {
  const [command] = value.trim().split(/\s+/);
  const entry = getCommandByName(command);
  if (!entry) {
    return { message: "Unknown command. Use /help.", isError: true };
  }
  return entry.handle(value, ctx, actions);
};
