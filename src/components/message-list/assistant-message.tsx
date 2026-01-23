import { Box, Text } from "ink";

type AssistantMessageProps = {
  content: string;
  isStreaming?: boolean;
};

export const AssistantMessage = ({
  content,
  isStreaming = false,
}: AssistantMessageProps) => {
  return (
    <Box flexDirection="column" marginBottom={1} paddingX={1}>
      <Box flexDirection="row" alignItems="center">
        <Text bold color="yellow">
          🤖 Tutor
        </Text>
        {isStreaming && <Text color="gray"> (streaming...)</Text>}
      </Box>
      <Box marginTop={0.5} paddingLeft={2}>
        <Text wrap="wrap">{content}</Text>
      </Box>
    </Box>
  );
};
