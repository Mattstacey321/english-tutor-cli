import { Box, Text } from "ink";
import { useShallow } from "zustand/shallow";
import { useTutorStore } from "../stores/tutor-store.js";

interface UserConfigProps {
  providerInfo: {
    name: string;
    model: string;
  };
}

export const UserConfig = ({ providerInfo }: UserConfigProps) => {
  const { difficulty, mode } = useTutorStore(
    useShallow((s) => ({ difficulty: s.difficulty, mode: s.mode })),
  );

  return (
    <Box flexDirection="column">
      <Text>English Tutor CLI</Text>
      <Text color="gray">
        Provider: {providerInfo.name} | Model: {providerInfo.model} |
        Difficulty: {difficulty} | Mode: {mode}
      </Text>
    </Box>
  );
};
