import type { ChatMessage } from "../../providers/types.js";
import { AssistantMessage } from "./assistant-message.js";
import { UserMessage } from "./user-message.js";
import { SystemMessage } from "./system-message.js";

type MessageItemProps = {
  message: ChatMessage;
};

export const MessageItem = ({ message }: MessageItemProps) => {
  if (message.role === "assistant") {
    return <AssistantMessage content={message.content} />;
  }

  if (message.role === "system") {
    return <SystemMessage content={message.content} />;
  }

  return <UserMessage content={message.content} />;
};
