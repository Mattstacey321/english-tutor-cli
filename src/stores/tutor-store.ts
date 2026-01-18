 import { create } from "zustand";
 import { randomUUID } from "node:crypto";
 
 import type { Difficulty } from "../adaptive.js";
 import type { PracticeMode } from "../conversation.js";
 import type { TutorConfig } from "../config.js";
 import type { ChatMessage } from "../providers/types.js";
 
 export type Status = "idle" | "thinking" | "error";
 export type PaletteView = "commands" | "models";
 
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
 
   // Config (persisted externally via config.ts)
   configState: ConfigState;
   setupMode: boolean;
 
   // Tutor settings
   difficulty: Difficulty;
   mode: PracticeMode;
 
   // Command palette UI
   paletteOpen: boolean;
   paletteIndex: number;
   paletteView: PaletteView;
 
   // Model listing
   modelItems: string[];
   modelLoading: boolean;
   modelError: string | null;
 
   // Actions - Session
   setInput: (input: string) => void;
   addMessage: (message: ChatMessage) => void;
   setHistory: (updater: (current: ChatMessage[]) => ChatMessage[]) => void;
   clearHistory: () => void;
   setStatus: (status: Status) => void;
 
   // Actions - Config
   setConfigState: (state: ConfigState) => void;
   setSetupMode: (enabled: boolean) => void;
 
   // Actions - Tutor settings
   setDifficulty: (difficulty: Difficulty) => void;
   setMode: (mode: PracticeMode) => void;
 
   // Actions - Palette
   openPalette: (view?: PaletteView) => void;
   closePalette: () => void;
   setPaletteIndex: (index: number) => void;
   setPaletteView: (view: PaletteView) => void;
 
   // Actions - Models
   setModelItems: (items: string[]) => void;
   setModelLoading: (loading: boolean) => void;
   setModelError: (error: string | null) => void;
 
   // Initialization
   initialize: (configState: ConfigState, setupMode: boolean) => void;
 }
 
 export const useTutorStore = create<TutorState>((set) => ({
   // Initial state - Session
   sessionId: randomUUID(),
   history: [],
   input: "",
   status: "idle",
 
   // Initial state - Config
   configState: { config: null, error: null, path: "" },
   setupMode: false,
 
   // Initial state - Tutor settings
   difficulty: "beginner",
   mode: "general",
 
   // Initial state - Palette
   paletteOpen: false,
   paletteIndex: 0,
   paletteView: "commands",
 
   // Initial state - Models
   modelItems: [],
   modelLoading: false,
   modelError: null,
 
// Actions - Session
  setInput: (input) => set({ input }),
  addMessage: (message) =>
    set((state) => ({
      history: [...state.history, { ...message, id: message.id ?? randomUUID() }],
    })),
  setHistory: (updater) =>
    set((state) => ({
      history: updater(state.history).map((msg) => ({
        ...msg,
        id: msg.id ?? randomUUID(),
      })),
    })),
  clearHistory: () => set({ history: [] }),
  setStatus: (status) => set({ status }),
 
   // Actions - Config
   setConfigState: (configState) => set({ configState }),
   setSetupMode: (setupMode) => set({ setupMode }),
 
   // Actions - Tutor settings
   setDifficulty: (difficulty) => set({ difficulty }),
   setMode: (mode) => set({ mode }),
 
   // Actions - Palette
   openPalette: (view = "commands") =>
     set({ paletteOpen: true, paletteIndex: 0, paletteView: view }),
   closePalette: () => set({ paletteOpen: false }),
   setPaletteIndex: (paletteIndex) => set({ paletteIndex }),
   setPaletteView: (paletteView) => set({ paletteView }),
 
   // Actions - Models
   setModelItems: (modelItems) => set({ modelItems }),
   setModelLoading: (modelLoading) => set({ modelLoading }),
   setModelError: (modelError) => set({ modelError }),
 
   // Initialization
   initialize: (configState, setupMode) => set({ configState, setupMode }),
 }));
