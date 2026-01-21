import { Box, Text } from "ink";

export interface SessionItem {
  session_id: string;
  title?: string | null;
  summary?: string | null;
  message_count: number;
  started_at: string;
}

interface SessionPickerProps {
  sessions: SessionItem[];
  selectedIndex: number;
  height: number;
}

const formatDate = (isoDate: string) => isoDate.split("T")[0];

export const SessionPicker = ({
  sessions,
  selectedIndex,
  height,
}: SessionPickerProps) => {
  if (sessions.length === 0) {
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="cyan"
        padding={1}
        height={height}
        justifyContent="center"
        alignItems="center"
      >
        <Text color="gray" italic>
          No sessions found.
        </Text>
        <Box marginTop={1}>
          <Text color="gray">Press B to return to chat.</Text>
        </Box>
      </Box>
    );
  }

  const rowsPerItem = 3;
  const chromeRows = 4;
  const availableRows = Math.max(1, height - chromeRows);
  const maxVisible = Math.max(1, Math.floor(availableRows / rowsPerItem));
  const clampedIndex = Math.min(
    Math.max(selectedIndex, 0),
    Math.max(0, sessions.length - 1),
  );
  const maxStart = Math.max(0, sessions.length - maxVisible);
  const startIndex = Math.min(
    Math.max(0, clampedIndex - Math.floor(maxVisible / 2)),
    maxStart,
  );
  const visibleSessions = sessions.slice(startIndex, startIndex + maxVisible);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      padding={1}
      height={height}
    >
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Sessions{" "}
        </Text>
        <Text color="gray">↑↓ Navigate | Enter Resume | R Rename | B Back</Text>
      </Box>
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {visibleSessions.map((session, index) => {
          const actualIndex = startIndex + index;
          const isSelected = actualIndex === clampedIndex;
          const shortId = session.session_id.slice(0, 8);
          const date = formatDate(session.started_at);
          const title = session.title?.trim();
          const header = title || `Session ${shortId}`;
          const summaryPreview = session.summary
            ? session.summary.slice(0, 60) + (session.summary.length > 60 ? "..." : "")
            : "(no summary)";

          return (
            <Box key={session.session_id} flexDirection="column" marginBottom={1}>
              <Box>
                <Text color={isSelected ? "cyan" : "white"} bold={isSelected}>
                  {isSelected ? "▶ " : "  "}
                  {header}
                </Text>
                <Text color="gray">
                  {"  "}
                  {shortId} | {date} | {session.message_count} msgs
                </Text>
              </Box>
              <Box paddingLeft={4}>
                <Text color={isSelected ? "cyan" : "gray"} dimColor={!isSelected}>
                  {summaryPreview}
                </Text>
              </Box>
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="gray">Press B to return to main chat.</Text>
      </Box>
    </Box>
  );
};
