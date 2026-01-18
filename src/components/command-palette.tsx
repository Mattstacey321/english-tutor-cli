import { Box, Text } from "ink";
import { useTutorStore } from "../stores/tutor-store.js";
import { useTerminalSize } from "../hooks/use-terminal-size.js";

type PaletteItem = {
  id: string;
  label: string;
  disabled?: boolean;
};

interface CommandPaletteProps {
  items: PaletteItem[];
}

export const CommandPalette = ({ items }: CommandPaletteProps) => {
  const paletteView = useTutorStore((s) => s.paletteView);
  const paletteIndex = useTutorStore((s) => s.paletteIndex);
  const terminalSize = useTerminalSize();

  // Calculate visible items based on terminal height
  // Leave room for header (2), footer (1), and padding
  const maxVisible = Math.max(5, terminalSize.height - 8);
  const startIndex = Math.max(0, paletteIndex - Math.floor(maxVisible / 2));
  const visibleItems = items.slice(startIndex, startIndex + maxVisible);

  return (
    <Box
      flexDirection="column"
      marginTop={1}
      borderStyle="round"
      borderColor="cyan"
      padding={1}
      width={Math.min(60, terminalSize.width - 4)}
    >
      <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        <Text bold color="cyan">
          {paletteView === "models" ? "📋 Select Gemini Model" : "⚡ Command Palette"}
        </Text>
        <Text color="gray">
          {paletteView === "models" ? "↑↓ Navigate | Enter Select | Esc Close" : "↑↓ Navigate | Enter Select | Esc Close"}
        </Text>
      </Box>

      <Box
        borderStyle="single"
        borderColor="gray"
        padding={0.5}
        height={Math.max(3, terminalSize.height - 12)}
        overflow="hidden"
      >
        {visibleItems.map((item, index) => {
          const actualIndex = startIndex + index;
          const isSelected = actualIndex === paletteIndex;
          const color = item.disabled ? "gray" : isSelected ? "cyan" : "white";
          const prefix = isSelected ? "▶" : " ";
          const bgColor = isSelected ? "cyan" : undefined;

          return (
            <Box
              key={item.id}
              flexDirection="row"
              paddingX={0.5}
              backgroundColor={bgColor}
            >
              <Text color={color} bold={isSelected}>
                {prefix} {item.label}
              </Text>
              {item.disabled && (
                <Text color="gray" italic>
                  {" "} (disabled)
                </Text>
              )}
            </Box>
          );
        })}
      </Box>

      {items.length > maxVisible && (
        <Box marginTop={1} flexDirection="row" justifyContent="space-between">
          <Text color="gray">
            Showing {visibleItems.length} of {items.length} items
          </Text>
          <Text color="yellow">
            Scroll: {startIndex + 1}-{startIndex + visibleItems.length}
          </Text>
        </Box>
      )}

      {paletteView === "models" && (
        <Box marginTop={1}>
          <Text color="gray" italic>
            💡 Tip: Use /models command to refresh the list
          </Text>
        </Box>
      )}
    </Box>
  );
};
