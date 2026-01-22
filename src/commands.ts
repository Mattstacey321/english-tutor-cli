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
  saveVocabItems,
  getVocabByCollection,
  getAllVocab,
  getVocabStats,
  getCollections,
  createCollection,
  getVocabForPractice,
  getLearningStats,
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

export const availableModes: PracticeMode[] = [
  "general",
  "grammar",
  "vocab",
  "role-play",
  "fluency",
  "exam",
];

const availableCommands = [
  "/clear",
  "/config",
  "/difficulty",
  "/mode",
  "/export",
  "/history",
  "/resume",
  "/rename",
  "/summary",
  "/save",
  "/vocab",
  "/stats",
  "/models",
  "/help",
];

const formatModeHelp = () => `Modes: ${availableModes.join(", ")}`;

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
  const [command, ...args] = value.trim().split(/\s+/);

  switch (command) {
    case "/help":
      return {
        message: `Commands: ${availableCommands.join(", ")}\nTip: To send a message starting with /, type //`,
      };

    case "/clear": {
      const newSession = args.includes("--new-session");
      actions.resetSession(newSession);
      return {
        message: newSession
          ? "Conversation cleared. Started new session."
          : "Conversation cleared.",
      };
    }

    case "/difficulty":
    case "/diff": {
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
    }

    case "/mode": {
      const requested = (args[0] ?? "").toLowerCase();
      if (!requested) {
        return { message: formatModeHelp() };
      }
      if (availableModes.includes(requested as PracticeMode)) {
        actions.setMode(requested as PracticeMode);
        return { message: `Mode set to ${requested}.` };
      }
      return { message: `Unknown mode. ${formatModeHelp()}`, isError: true };
    }

    case "/export": {
      if (ctx.history.length === 0) {
        return { message: "No messages to export.", isError: true };
      }
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
    }

    case "/history": {
      actions.setMainView("sessionPicker");
      return null;
    }

    case "/resume": {
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
    }

    case "/models": {
      if (!ctx.resolvedConfig.apiKey) {
        return {
          message: "API key required to list models.",
          isError: true,
        };
      }
      void actions.openModelPalette();
      return null;
    }

    case "/config": {
      const key = args[0]?.toLowerCase();
      const configValue = args.slice(1).join(" ");

      if (!key) {
        const summaryModelDisplay =
          ctx.resolvedConfig.summaryModel ?? "(same as main)";
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
    }

    case "/rename": {
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
    }

    case "/summary": {
      if (!ctx.provider) {
        return { message: "Provider not configured.", isError: true };
      }
      if (ctx.history.length === 0) {
        return { message: "No messages to summarize.", isError: true };
      }

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
    }

    case "/save":
    case "/s": {
      if (args.length === 0) {
        return {
          message:
            "Usage: /save <word1, word2, ...> [collection]\nExample: /save apple, banana, cherry fruits",
          isError: true,
        };
      }

      const lastArg = args[args.length - 1];
      const hasCollection = args.length > 1 && !lastArg.includes(",");
      const collection = hasCollection ? lastArg.toLowerCase() : "default";
      const wordsArg = hasCollection
        ? args.slice(0, -1).join(" ")
        : args.join(" ");
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

      const saved = saveVocabItems(words, collection);
      return {
        message: `Saved ${saved} word${saved !== 1 ? "s" : ""} to "${collection}" collection.`,
      };
    }

    case "/vocab": {
      const subcommand = args[0]?.toLowerCase();

      if (!subcommand || subcommand === "list") {
        const collection = args[1];
        const items = collection
          ? getVocabByCollection(collection)
          : getAllVocab(50);

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
            message:
              "No collections yet. Words are saved to 'default' collection.",
          };
        }
        const lines = collections.map(
          (c) => `  ${c.name.padEnd(15)} ${c.word_count ?? 0} words`,
        );
        return { message: `Collections:\n\n${lines.join("\n")}` };
      }

      if (subcommand === "practice") {
        const collection = args[1];
        const practiceItems = getVocabForPractice(collection, 10);

        if (practiceItems.length === 0) {
          return {
            message: collection
              ? `No vocabulary in "${collection}" to practice.`
              : "No vocabulary to practice. Use /save to add words first.",
            isError: true,
          };
        }

        actions.setVocabPractice({
          items: practiceItems.map((item) => ({
            id: item.id,
            word: item.word,
            definition: item.definition,
          })),
          currentIndex: 0,
          showAnswer: false,
          score: { correct: 0, incorrect: 0 },
        });
        actions.setMainView("vocabPractice");
        return null;
      }

      return {
        message:
          "Usage: /vocab [list|stats|collections|practice] [collection]\nExamples:\n  /vocab - list all words\n  /vocab list fruits - list words in 'fruits' collection\n  /vocab stats - show statistics\n  /vocab collections - list all collections\n  /vocab practice - start practice session",
        isError: true,
      };
    }

    case "/stats": {
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
    }

    default:
      return { message: "Unknown command. Use /help.", isError: true };
  }
};
