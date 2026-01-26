import { create } from "zustand";
import { randomUUID } from "node:crypto";

import type { Difficulty } from "../adaptive.js";
import type { PracticeMode } from "../conversation.js";
import type { TutorConfig } from "../config.js";
import type { ChatMessage } from "../providers/types.js";
import type { SessionItem } from "../components/session-picker.js";

export type Status = "idle" | "thinking" | "error";
export type PaletteView = "commands" | "models";
export type PaletteSource = "slash" | null;
export type MainView =
  | "chat"
  | "help"
  | "modePicker"
  | "modelsPicker"
  | "vocabPractice"
  | "sessionPicker";
export type QuizMode = "flashcard" | "type-answer" | "multiple-choice";

export interface VocabPracticeItem {
  id: number;
  word: string;
  definition: string | null;
  mcOptions?: string[];
  mcCorrectIndex?: number;
}

export interface VocabPracticeState {
  mode: QuizMode;
  items: VocabPracticeItem[];
  currentIndex: number;
  showAnswer: boolean;
  score: { correct: number; incorrect: number };
  userInput: string;
  selectedOption: number | null;
  feedback: { correct: boolean; message: string } | null;
}

export interface ConfigState {
  config: TutorConfig | null;
  error: string | null;
  path: string;
}

interface TutorState {
  // Session (transient)
  sessionId: string;
  history: ChatMessage[];
  input: string;
  status: Status;

  // Streaming state
  isStreaming: boolean;
  streamingContent: string;
  streamingMessageId: string | null;

  // Config (persisted externally via config.ts)
  configState: ConfigState;
  setupMode: boolean;

  // Tutor settings
  difficulty: Difficulty;
  mode: PracticeMode;

  mainView: MainView;
  panelIndex: number;

  // Command palette UI
  paletteOpen: boolean;
  paletteIndex: number;
  paletteView: PaletteView;
  paletteSource: PaletteSource;
  slashDismissed: boolean;

  // Model listing
  modelItems: string[];
  modelLoading: boolean;
  modelError: string | null;

  // Vocab practice
  vocabPractice: VocabPracticeState | null;

  // Session picker
  sessionPickerSessions: SessionItem[];

  // Actions - Session
  setSessionId: (sessionId: string) => void;
  setInput: (input: string) => void;
  addMessage: (message: ChatMessage) => void;
  setHistory: (updater: (current: ChatMessage[]) => ChatMessage[]) => void;
  clearHistory: () => void;
  resetSession: (newSession?: boolean) => void;
  setStatus: (status: Status) => void;

  // Actions - Streaming
  startStreaming: (messageId: string) => void;
  appendStreamingContent: (chunk: string) => void;
  finishStreaming: () => void;
  abortStreaming: () => void;

  // Actions - Config
  setConfigState: (state: ConfigState) => void;
  setSetupMode: (enabled: boolean) => void;

  // Actions - Tutor settings
  setDifficulty: (difficulty: Difficulty) => void;
  setMode: (mode: PracticeMode) => void;

  setMainView: (view: MainView) => void;
  setPanelIndex: (index: number) => void;

  // Actions - Palette
  openPalette: (view?: PaletteView, source?: PaletteSource) => void;
  closePalette: () => void;
  setPaletteIndex: (index: number) => void;
  setPaletteView: (view: PaletteView) => void;
  setSlashDismissed: (dismissed: boolean) => void;

  // Actions - Models
  setModelItems: (items: string[]) => void;
  setModelLoading: (loading: boolean) => void;
  setModelError: (error: string | null) => void;

  // Actions - Vocab practice
  setVocabPractice: (state: VocabPracticeState | null) => void;
  vocabPracticeNext: () => void;
  vocabPracticeAnswer: (correct: boolean) => void;
  vocabPracticeToggleAnswer: () => void;
  vocabPracticeSetInput: (input: string) => void;
  vocabPracticeSelectOption: (index: number) => void;
  vocabPracticeSubmitAnswer: () => void;
  vocabPracticeClearFeedback: () => void;

  // Actions - Session picker
  setSessionPickerSessions: (sessions: SessionItem[]) => void;

  // Initialization
  initialize: (configState: ConfigState, setupMode: boolean) => void;
}

export const useTutorStore = create<TutorState>((set) => ({
  // Initial state - Session
  sessionId: randomUUID(),
  history: [],
  input: "",
  status: "idle",

  // Initial state - Streaming
  isStreaming: false,
  streamingContent: "",
  streamingMessageId: null,

  // Initial state - Config
  configState: { config: null, error: null, path: "" },
  setupMode: false,

  // Initial state - Tutor settings
  difficulty: "beginner",
  mode: "general",

  mainView: "chat",
  panelIndex: 0,

  // Initial state - Palette
  paletteOpen: false,
  paletteIndex: -1,
  paletteView: "commands",
  paletteSource: null,
  slashDismissed: false,

  // Initial state - Models
  modelItems: [],
  modelLoading: false,
  modelError: null,

  // Initial state - Vocab practice
  vocabPractice: null,

  // Initial state - Session picker
  sessionPickerSessions: [],

  // Actions - Session
  setSessionId: (sessionId) => set({ sessionId }),
  setInput: (input) => set({ input }),
  addMessage: (message) =>
    set((state) => ({
      history: [
        ...state.history,
        { ...message, id: message.id ?? randomUUID() },
      ],
    })),
  setHistory: (updater) =>
    set((state) => ({
      history: updater(state.history).map((msg) => ({
        ...msg,
        id: msg.id ?? randomUUID(),
      })),
    })),
  clearHistory: () => set({ history: [] }),
  resetSession: (newSession = false) =>
    set(() => ({
      history: [],
      ...(newSession ? { sessionId: randomUUID() } : {}),
    })),
  setStatus: (status) => set({ status }),

  // Actions - Streaming
  startStreaming: (messageId) =>
    set({
      isStreaming: true,
      streamingContent: "",
      streamingMessageId: messageId,
      status: "thinking",
    }),
  appendStreamingContent: (chunk) =>
    set((state) => ({ streamingContent: state.streamingContent + chunk })),
  finishStreaming: () =>
    set({
      isStreaming: false,
      streamingContent: "",
      streamingMessageId: null,
      status: "idle",
    }),
  abortStreaming: () => set({ isStreaming: false, status: "idle" }),

  // Actions - Config
  setConfigState: (configState) => set({ configState }),
  setSetupMode: (setupMode) => set({ setupMode }),

  // Actions - Tutor settings
  setDifficulty: (difficulty) => set({ difficulty }),
  setMode: (mode) => set({ mode }),

  setMainView: (mainView) => set({ mainView, panelIndex: 0 }),
  setPanelIndex: (panelIndex) => set({ panelIndex }),

  // Actions - Palette
  openPalette: (view = "commands", source: PaletteSource = null) =>
    set({
      paletteOpen: true,
      paletteIndex: -1,
      paletteView: view,
      paletteSource: source,
    }),
  closePalette: () => set({ paletteOpen: false, paletteSource: null }),
  setPaletteIndex: (paletteIndex) => set({ paletteIndex }),
  setPaletteView: (paletteView) => set({ paletteView }),
  setSlashDismissed: (slashDismissed) => set({ slashDismissed }),

  // Actions - Models
  setModelItems: (modelItems) => set({ modelItems }),
  setModelLoading: (modelLoading) => set({ modelLoading }),
  setModelError: (modelError) => set({ modelError }),

  // Actions - Vocab practice
  setVocabPractice: (vocabPractice) => set({ vocabPractice }),
  vocabPracticeNext: () =>
    set((state) => {
      if (!state.vocabPractice) return {};
      const nextIndex = state.vocabPractice.currentIndex + 1;
      if (nextIndex >= state.vocabPractice.items.length) {
        const { correct, incorrect } = state.vocabPractice.score;
        const total = correct + incorrect;
        if (total > 0) {
          return {
            mainView: "chat",
            vocabPractice: null,
            history: [
              ...state.history,
              {
                id: randomUUID(),
                role: "assistant",
                content: `(Tip) Practice ended. Score: ${correct}/${total} correct.`,
              },
            ],
          };
        }
        return { mainView: "chat", vocabPractice: null };
      }
      return {
        vocabPractice: {
          ...state.vocabPractice,
          currentIndex: nextIndex,
          showAnswer: false,
          userInput: "",
          selectedOption: null,
          feedback: null,
        },
      };
    }),
  vocabPracticeAnswer: (correct) =>
    set((state) => {
      if (!state.vocabPractice) return {};
      const currentItem =
        state.vocabPractice.items[state.vocabPractice.currentIndex];
      const message = correct
        ? "Correct!"
        : `Incorrect. The answer was "${currentItem?.word}"`;
      return {
        vocabPractice: {
          ...state.vocabPractice,
          feedback: { correct, message },
          score: {
            correct: state.vocabPractice.score.correct + (correct ? 1 : 0),
            incorrect: state.vocabPractice.score.incorrect + (correct ? 0 : 1),
          },
        },
      };
    }),
  vocabPracticeToggleAnswer: () =>
    set((state) => {
      if (!state.vocabPractice) return {};
      return {
        vocabPractice: {
          ...state.vocabPractice,
          showAnswer: !state.vocabPractice.showAnswer,
        },
      };
    }),
  vocabPracticeSetInput: (input) =>
    set((state) => {
      if (!state.vocabPractice) return {};
      return {
        vocabPractice: {
          ...state.vocabPractice,
          userInput: input,
        },
      };
    }),
  vocabPracticeSelectOption: (index) =>
    set((state) => {
      if (!state.vocabPractice) return {};
      return {
        vocabPractice: {
          ...state.vocabPractice,
          selectedOption: index,
        },
      };
    }),
  vocabPracticeSubmitAnswer: () =>
    set((state) => {
      if (!state.vocabPractice) return {};
      const practice = state.vocabPractice;
      const currentItem = practice.items[practice.currentIndex];
      if (!currentItem) return {};

      let isCorrect = false;
      let message = "";

      if (practice.mode === "type-answer") {
        const userAnswer = practice.userInput.toLowerCase().trim();
        const correctAnswer = currentItem.word.toLowerCase().trim();
        isCorrect = userAnswer === correctAnswer;
        message = isCorrect
          ? "Correct!"
          : `Incorrect. The answer was "${currentItem.word}"`;
      } else if (practice.mode === "multiple-choice") {
        if (practice.selectedOption === null) return {};
        isCorrect = practice.selectedOption === currentItem.mcCorrectIndex;
        message = isCorrect
          ? "Correct!"
          : `Incorrect. The answer was "${currentItem.word}"`;
      }

      return {
        vocabPractice: {
          ...practice,
          showAnswer: true,
          feedback: { correct: isCorrect, message },
          score: {
            correct: practice.score.correct + (isCorrect ? 1 : 0),
            incorrect: practice.score.incorrect + (isCorrect ? 0 : 1),
          },
        },
      };
    }),
  vocabPracticeClearFeedback: () =>
    set((state) => {
      if (!state.vocabPractice) return {};
      return {
        vocabPractice: {
          ...state.vocabPractice,
          feedback: null,
        },
      };
    }),

  // Actions - Session picker
  setSessionPickerSessions: (sessionPickerSessions) =>
    set({ sessionPickerSessions }),

  // Initialization
  initialize: (configState, setupMode) => set({ configState, setupMode }),
}));
