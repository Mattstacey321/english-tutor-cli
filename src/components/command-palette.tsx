import { Box, Text } from "ink";

type PaletteItem = {
  id: string;
  left: string;
  right?: string;
  disabled?: boolean;
};

interface CommandPaletteProps {
  items: PaletteItem[];
  selectedIndex: number; // -1 means no selection (input focused)
}

export const CommandPalette = ({
  items,
  selectedIndex,
}: CommandPaletteProps) => {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} marginTop={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Commands </Text>
        <Text color="gray">↑↓ Navigate | Enter Select | Esc Close</Text>
      </Box>
      {items.map((item, index) => {
        const isSelected = index === selectedIndex;
        const color = item.disabled ? "gray" : isSelected ? "cyan" : "white";
        const prefix = isSelected ? "▶ " : "  ";

        return (
          <Box key={item.id}>
            <Text color={color} bold={isSelected}>
              {prefix}
            </Text>
            <Text color={color} bold={isSelected}>
              {item.left.padEnd(14)}
            </Text>
            <Text color={isSelected ? "cyan" : "gray"}>
              {item.right ?? ""}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
};
