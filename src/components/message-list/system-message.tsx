import { Box, Text } from "ink";

type SystemMessageProps = {
  content: string;
};

export const SystemMessage = ({ content }: SystemMessageProps) => {
  return (
    <Box
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      paddingX={2}
      paddingY={1}
      marginY={1}
      width="100%"
      borderStyle="single"
      borderColor="gray"
    >
      <Text bold color="gray" italic>
        SYSTEM
      </Text>
      <Text color="gray">{content}</Text>
    </Box>
  );
};
