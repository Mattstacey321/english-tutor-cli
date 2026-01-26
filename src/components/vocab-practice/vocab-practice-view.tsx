import { Box, Text } from "ink";
import type { VocabPracticeState } from "../../stores/tutor-store.js";

export interface VocabPracticeViewProps {
  vocabPractice: VocabPracticeState | null;
  height: number;
}

export const VocabPracticeView = ({
  vocabPractice,
  height,
}: VocabPracticeViewProps) => {
  if (!vocabPractice) {
    return null;
  }

  const currentItem = vocabPractice.items[vocabPractice.currentIndex];
  const modeLabel =
    vocabPractice.mode === "flashcard"
      ? "Flashcard"
      : vocabPractice.mode === "type-answer"
        ? "Type Answer"
        : "Multiple Choice";

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="magenta"
      padding={1}
      height={height}
    >
      <Box marginBottom={1}>
        <Text bold color="magenta">
          Vocabulary Practice ({modeLabel})
        </Text>
        <Text color="gray">
          {" "}
          ({vocabPractice.currentIndex + 1}/{vocabPractice.items.length}) | Score:{" "}
          {vocabPractice.score.correct}/
          {vocabPractice.score.correct + vocabPractice.score.incorrect}
        </Text>
      </Box>

      <Box
        flexDirection="column"
        flexGrow={1}
        justifyContent="center"
        alignItems="center"
      >
        {vocabPractice.mode === "flashcard" && (
          <>
            <Text bold color="cyan">
              {currentItem?.word}
            </Text>
            {vocabPractice.showAnswer && (
              <Box marginTop={1}>
                <Text color="gray">
                  {currentItem?.definition || "(no definition)"}
                </Text>
              </Box>
            )}
            {vocabPractice.feedback && (
              <Box marginTop={1}>
                <Text
                  color={vocabPractice.feedback.correct ? "green" : "red"}
                >
                  {vocabPractice.feedback.message}
                </Text>
              </Box>
            )}
          </>
        )}

        {vocabPractice.mode === "type-answer" && (
          <>
            <Text color="gray">What word matches this definition?</Text>
            <Box marginTop={1}>
              <Text bold color="cyan">
                {currentItem?.definition || "(no definition)"}
              </Text>
            </Box>
            <Box marginTop={1}>
              <Text>Your answer: </Text>
              <Text bold color="yellow">
                {vocabPractice.userInput || "_"}
              </Text>
              {currentItem?.word && (
                <Text color="gray">
                  {" "}
                  ({vocabPractice.userInput.length}/{currentItem.word.length})
                </Text>
              )}
            </Box>
            {vocabPractice.feedback && (
              <Box marginTop={1}>
                <Text
                  color={vocabPractice.feedback.correct ? "green" : "red"}
                >
                  {vocabPractice.feedback.message}
                </Text>
              </Box>
            )}
          </>
        )}

        {vocabPractice.mode === "multiple-choice" && (
          <>
            <Text color="gray">What word matches this definition?</Text>
            <Box marginTop={1}>
              <Text bold color="cyan">
                {currentItem?.definition || "(no definition)"}
              </Text>
            </Box>
            <Box marginTop={1} flexDirection="column">
              {currentItem?.mcOptions?.map((option, idx) => {
                const letter = String.fromCharCode(65 + idx);
                const isSelected = vocabPractice.selectedOption === idx;
                const isCorrect =
                  vocabPractice.feedback && idx === currentItem.mcCorrectIndex;
                const isWrong =
                  vocabPractice.feedback &&
                  isSelected &&
                  !vocabPractice.feedback.correct;

                let color: string = "white";
                if (isCorrect) color = "green";
                else if (isWrong) color = "red";
                else if (isSelected) color = "yellow";

                return (
                  <Box key={idx}>
                    <Text color={color}>
                      {isSelected ? "▸ " : "  "}
                      {letter}. {option}
                    </Text>
                  </Box>
                );
              })}
            </Box>
            {vocabPractice.feedback && (
              <Box marginTop={1}>
                <Text
                  color={vocabPractice.feedback.correct ? "green" : "red"}
                >
                  {vocabPractice.feedback.message}
                </Text>
              </Box>
            )}
          </>
        )}
      </Box>

      <Box marginTop={1} justifyContent="center">
        {vocabPractice.mode === "flashcard" &&
          (vocabPractice.feedback ? (
            <Text color="gray">
              Press Enter or Space to continue | Esc to exit
            </Text>
          ) : !vocabPractice.showAnswer ? (
            <Text color="gray">
              Press Space to reveal | Esc to exit
            </Text>
          ) : (
            <Text color="gray">
              Press Y (correct) or N (incorrect) | Esc to exit
            </Text>
          ))}
        {vocabPractice.mode === "type-answer" &&
          (vocabPractice.feedback ? (
            <Text color="gray">
              Press Enter or Space to continue | Esc to exit
            </Text>
          ) : (
            <Text color="gray">
              Type your answer and press Enter | Esc to exit
            </Text>
          ))}
        {vocabPractice.mode === "multiple-choice" &&
          (vocabPractice.feedback ? (
            <Text color="gray">
              Press Enter or Space to continue | Esc to exit
            </Text>
          ) : (
            <Text color="gray">
              Press A/B/C/D to select, Enter to confirm | Esc to exit
            </Text>
          ))}
      </Box>
    </Box>
  );
};
