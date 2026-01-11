export type ProviderName = "openai" | "gemini";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export interface TutorProvider {
  sendMessage(history: ChatMessage[], message: string): Promise<string>;
}
