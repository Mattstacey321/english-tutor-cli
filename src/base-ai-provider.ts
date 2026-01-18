enum ChatRole {
  USER = "user",
  ASSISTANT = "assistant",
}

export interface BaseAIProvider {
  name: string;
  listModels(): Promise<string[]>;
  createChat({ model }: { model: string }): Promise<Chat>;
}

export interface Chat {
  id: string;
  model: string;
  sendMessage(history: ChatMessage, message: string): Promise<ChatMessage>;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}
