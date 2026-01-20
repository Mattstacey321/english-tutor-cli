import type { ChatMessage, TutorProvider } from "./providers/types.js";

const SUMMARY_PROMPT = `You are a session summarizer for an English tutoring app. Summarize the conversation concisely in 2-3 sentences, focusing on:
- What topics or skills were practiced
- Key corrections or vocabulary learned
- The learner's progress or areas needing work

Keep it brief and informative. Do not include greetings or fluff.`;

export const generateSessionSummary = async (
  provider: TutorProvider,
  messages: ChatMessage[]
): Promise<string> => {
  const userAssistantMessages = messages.filter(
    (m) => m.role === "user" || m.role === "assistant"
  );

  if (userAssistantMessages.length === 0) {
    return "Empty session.";
  }

  const conversationText = userAssistantMessages
    .map((m) => `${m.role === "user" ? "Learner" : "Tutor"}: ${m.content}`)
    .join("\n\n");

  const truncated =
    conversationText.length > 4000
      ? conversationText.slice(0, 4000) + "\n\n[...conversation truncated...]"
      : conversationText;

  const summaryRequest: ChatMessage[] = [
    { role: "system", content: SUMMARY_PROMPT },
    {
      role: "user",
      content: `Summarize this English tutoring session:\n\n${truncated}`,
    },
  ];

  try {
    const summary = await provider.sendMessage(summaryRequest);
    return summary.trim() || "Unable to generate summary.";
  } catch {
    return "Summary generation failed.";
  }
};

export const buildResumeContext = (
  summary: string,
  difficulty: string,
  mode: string
): string => {
  return `[Resuming previous session]
Previous session summary: ${summary}
Current difficulty: ${difficulty}
Practice mode: ${mode}

Continue the tutoring session naturally, acknowledging you're picking up where you left off.`;
};
