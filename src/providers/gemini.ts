import { GoogleGenerativeAI } from "@google/generative-ai";

import { ChatMessage, TutorProvider, StreamController } from "./types.js";

type ModelListResponse = {
  models?: { name: string; supportedGenerationMethods?: string[] }[];
};

export const listGeminiModels = async (apiKey: string): Promise<string[]> => {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to list models.");
  }

  const data = (await response.json()) as ModelListResponse;
  return (data.models ?? [])
    .filter((model) => model.supportedGenerationMethods?.includes("generateContent"))
    .map((model) => model.name);
};

const buildGeminiChat = (
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  history: ChatMessage[]
) => {
  const instructions = history
    .filter((item) => item.role === "system")
    .map((item) => item.content)
    .join("\n");

  const conversationHistory = history.filter((item) => item.role !== "system");
  const lastUserMessage = conversationHistory.pop();

  const normalizedHistory = conversationHistory.map((item) => ({
    role: item.role === "assistant" ? "model" : item.role,
    parts: [{ text: item.content }]
  }));

  if (instructions) {
    normalizedHistory.unshift({
      role: "user",
      parts: [{ text: `Instructions: ${instructions}` }]
    });
  }

  if (normalizedHistory.length > 0 && normalizedHistory[0].role === "model") {
    normalizedHistory.unshift({ role: "user", parts: [{ text: "Start of conversation." }] });
  }

  const chat = model.startChat({ history: normalizedHistory });
  const messageText = lastUserMessage?.content ?? "";

  return { chat, messageText };
};

export const createGeminiProvider = (apiKey: string, modelName: string): TutorProvider => {
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({ model: modelName });

  return {
    async sendMessage(history: ChatMessage[]) {
      const { chat, messageText } = buildGeminiChat(model, history);
      const result = await chat.sendMessage(messageText);
      return result.response.text();
    },

    streamMessage(
      history: ChatMessage[],
      onChunk: (chunk: string) => void,
      onComplete: (fullResponse: string) => void,
      onError: (error: Error) => void
    ): StreamController {
      let aborted = false;
      let fullContent = "";

      const runStream = async () => {
        try {
          const { chat, messageText } = buildGeminiChat(model, history);
          const result = await chat.sendMessageStream(messageText);

          for await (const chunk of result.stream) {
            if (aborted) break;
            const text = chunk.text();
            if (text) {
              fullContent += text;
              onChunk(text);
            }
          }

          if (!aborted) {
            onComplete(fullContent);
          }
        } catch (error) {
          if (!aborted) {
            onError(error instanceof Error ? error : new Error(String(error)));
          }
        }
      };

      void runStream();

      return {
        abort: () => {
          aborted = true;
          onComplete(fullContent);
        },
      };
    },
  };
};
