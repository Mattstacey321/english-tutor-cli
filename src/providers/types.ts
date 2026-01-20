export type ProviderName = "openai" | "gemini";

export type ChatMessage = {
  id?: string;
  role: "system" | "user" | "assistant";
  content: string;
};

export interface StreamController {
  abort: () => void;
}

export interface TutorProvider {
  sendMessage(history: ChatMessage[]): Promise<string>;
  streamMessage(
    history: ChatMessage[],
    onChunk: (chunk: string) => void,
    onComplete: (fullResponse: string) => void,
    onError: (error: Error) => void
  ): StreamController;
}
