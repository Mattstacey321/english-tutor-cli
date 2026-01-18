export type ProviderName = "openai" | "gemini";

export type ChatMessage = {
  id?: string;
  role: "system" | "user" | "assistant";
  content: string;
};

export interface TutorProvider {
  sendMessage(history: ChatMessage[]): Promise<string>;
}
