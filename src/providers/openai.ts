import OpenAI from "openai";

import { ChatMessage, TutorProvider, StreamController } from "./types.js";

export const listOpenAIModels = async (apiKey: string): Promise<string[]> => {
  const client = new OpenAI({ apiKey });
  const models = await client.models.list();
  return models.data
    .filter((m) => m.id.includes("gpt") || m.id.includes("o1") || m.id.includes("o3"))
    .map((m) => m.id)
    .sort();
};

export const createOpenAIProvider = (apiKey: string, model: string): TutorProvider => {
  const client = new OpenAI({ apiKey });

  return {
    async sendMessage(history: ChatMessage[]) {
      const completion = await client.chat.completions.create({
        model,
        messages: history.map(({ role, content }) => ({ role, content })),
      });

      return completion.choices[0]?.message?.content ?? "";
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
          const stream = await client.chat.completions.create({
            model,
            messages: history.map(({ role, content }) => ({ role, content })),
            stream: true,
          });

          for await (const chunk of stream) {
            if (aborted) break;
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              fullContent += content;
              onChunk(content);
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
