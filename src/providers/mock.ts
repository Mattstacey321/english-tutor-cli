import { TutorProvider } from "./types";

export const createMockProvider = (): TutorProvider => {
  return {
    async sendMessage() {
      return "Hello!";
    },
  };
};
