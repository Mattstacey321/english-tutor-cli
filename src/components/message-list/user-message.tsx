import { Box, Text } from "ink";

type UserMessageProps = {
  content: string;
};

export const UserMessage = ({ content }: UserMessageProps) => {
  return (
    <Box flexDirection="column" marginBottom={1} paddingX={1}>
      <Box flexDirection="row" alignItems="center">
        <Text bold color="green">
          👤 You
        </Text>
      </Box>
      <Box marginTop={0.5} paddingLeft={2}>
        <Text wrap="wrap">{content}</Text>
      </Box>
    </Box>
  );
};
