import OpenAI from "openai";

import { ChatMessage, TutorProvider } from "./types.js";

export const createOpenAIProvider = (apiKey: string, model: string): TutorProvider => {
  const client = new OpenAI({ apiKey });

  return {
    async sendMessage(history: ChatMessage[]) {
      const completion = await client.chat.completions.create({
        model,
        messages: history.map(({ role, content }) => ({ role, content })),
      });

      return completion.choices[0]?.message?.content ?? "";
    }
  };
};
