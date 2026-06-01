import { describe, expect, it } from "vitest";

import { useTutorStore } from "../src/stores/tutor-store.js";

describe("useTutorStore vocab practice completion", () => {
  it("emits a tip when practice completes", () => {
    useTutorStore.setState({
      history: [],
      mainView: "vocabPractice",
      vocabPractice: {
        mode: "type-answer",
        items: [{ id: 1, word: "alpha", definition: "first letter" }],
        currentIndex: 0,
        showAnswer: true,
        score: { correct: 1, incorrect: 0 },
        userInput: "alpha",
        selectedOption: null,
        feedback: { correct: true, message: "Correct!" },
      },
    });

    useTutorStore.getState().vocabPracticeNext();

    const next = useTutorStore.getState();
    expect(next.mainView).toBe("chat");
    expect(next.vocabPractice).toBe(null);
    expect(next.history[next.history.length - 1]).toEqual(
      expect.objectContaining({
        role: "assistant",
        content: expect.stringContaining("(Tip) Practice ended. Score: 1/1"),
      }),
    );
  });
});
