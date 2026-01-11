export type Difficulty = "beginner" | "intermediate" | "advanced";

const levels: Difficulty[] = ["beginner", "intermediate", "advanced"];

export const updateDifficulty = (current: Difficulty, userMessage: string): Difficulty => {
  const text = userMessage.trim();
  if (!text) {
    return current;
  }

  const wordCount = text.split(/\s+/).length;
  const hasComplexPunctuation = /[;:]/.test(text);

  let index = levels.indexOf(current);
  if (wordCount >= 20 || hasComplexPunctuation) {
    index = Math.min(index + 1, levels.length - 1);
  } else if (wordCount <= 6) {
    index = Math.max(index - 1, 0);
  }

  return levels[index];
};
