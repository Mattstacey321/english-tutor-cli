import type { TutorProvider, ChatMessage } from "./providers/types.js";

const DEFINITION_PROMPT = `You are an English tutor helping a student understand vocabulary words.

For each word below, provide a clear, concise definition in one sentence suitable for an English learner.
Focus on the most common meaning of each word.

Format your response exactly like this:
word1: definition one sentence here
word2: definition one sentence here
word3: definition one sentence here

Do NOT add any explanations, introductions, or conclusions. Only the definitions in the exact format above.`;

export const fetchDefinitions = async (
  provider: TutorProvider,
  words: string[]
): Promise<Map<string, string>> => {
  const definitions = new Map<string, string>();
  
  if (words.length === 0) {
    return definitions;
  }

  const prompt = `${DEFINITION_PROMPT}\n\nDefine these words:\n${words.map((w, i) => `${i + 1}. ${w}`).join("\n")}`;

  const messages: ChatMessage[] = [
    { role: "system", content: DEFINITION_PROMPT },
    { role: "user", content: prompt },
  ];

  try {
    const response = await provider.sendMessage(messages);
    const lines = response.split("\n");
    
    for (const line of lines) {
      const match = line.match(/^(\d+\.\s*)?([a-zA-Z0-9\s\-']+):\s*(.+)$/);
      if (match) {
        const word = match[2].trim().toLowerCase();
        const definition = match[3].trim();
        
        if (words.includes(word) && definition.length > 5) {
          definitions.set(word, definition);
        }
      }
    }
    
    if (definitions.size === 0) {
      for (const line of lines) {
        const match = line.match(/^([a-zA-Z0-9\s\-']+):\s*(.+)$/);
        if (match) {
          const word = match[1].trim().toLowerCase();
          const definition = match[2].trim();
          
          if (words.includes(word) && definition.length > 5) {
            definitions.set(word, definition);
          }
        }
      }
    }
  } catch {
    // Return empty map on error (fallback to null definitions)
  }

  return definitions;
};
