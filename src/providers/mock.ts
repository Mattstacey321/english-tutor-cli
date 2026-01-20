import { TutorProvider, StreamController } from "./types";

export const createMockProvider = (): TutorProvider => {
  return {
    async sendMessage() {
      return "Hello!";
    },
    streamMessage(_history, onChunk, onComplete): StreamController {
      const response = "Hello!";
      setTimeout(() => {
        onChunk(response);
        onComplete(response);
      }, 100);
      return { abort: () => {} };
    },
  };
};
