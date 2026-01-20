import fs from "node:fs";
import type { ChatMessage } from "./providers/types.js";

export type ExportFormat = "md" | "txt" | "json";

const formatMarkdown = (messages: ChatMessage[], sessionId: string): string => {
  const header = `# English Tutor Session

**Session ID:** ${sessionId}  
**Exported:** ${new Date().toISOString()}  
**Messages:** ${messages.length}

---

`;

  const body = messages
    .map((m) => {
      const role = m.role === "user" ? "**You:**" : "**Tutor:**";
      return `${role}\n\n${m.content}`;
    })
    .join("\n\n---\n\n");

  return header + body;
};

const formatText = (messages: ChatMessage[], sessionId: string): string => {
  const header = `English Tutor Session
Session ID: ${sessionId}
Exported: ${new Date().toISOString()}
Messages: ${messages.length}

${"=".repeat(50)}

`;

  const body = messages
    .map((m) => {
      const role = m.role === "user" ? "You:" : "Tutor:";
      return `${role}\n${m.content}`;
    })
    .join("\n\n" + "-".repeat(30) + "\n\n");

  return header + body;
};

const formatJson = (messages: ChatMessage[], sessionId: string): string => {
  return JSON.stringify(
    {
      sessionId,
      exportedAt: new Date().toISOString(),
      messageCount: messages.length,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    },
    null,
    2
  );
};

export const exportConversation = (
  messages: ChatMessage[],
  sessionId: string,
  format: ExportFormat = "md"
): { filename: string; path: string } => {
  const timestamp = new Date().toISOString().split("T")[0];
  const shortId = sessionId.slice(0, 8);
  const filename = `english-tutor-${shortId}-${timestamp}.${format}`;

  let content: string;
  switch (format) {
    case "json":
      content = formatJson(messages, sessionId);
      break;
    case "txt":
      content = formatText(messages, sessionId);
      break;
    case "md":
    default:
      content = formatMarkdown(messages, sessionId);
  }

  fs.writeFileSync(filename, content, "utf8");

  return { filename, path: process.cwd() };
};

export const isValidExportFormat = (format: string): format is ExportFormat => {
  return ["md", "txt", "json"].includes(format);
};
