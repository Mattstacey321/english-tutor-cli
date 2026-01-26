import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleCommand, availableModes, type CommandContext, type CommandActions } from '../src/commands.js';
import type { ResolvedConfig } from '../src/config.js';

vi.mock('../src/storage.js', () => ({
  getSessionMessages: vi.fn(() => []),
  getSessionHistoryWithSummaries: vi.fn(() => []),
  getSessionWithSummary: vi.fn(() => null),
  updateSessionSummary: vi.fn(),
  saveVocabItemsWithDefs: vi.fn(() => ({ success: [{ word: 'test' }], failed: [] })),
  getVocabByCollection: vi.fn(() => []),
  getAllVocab: vi.fn(() => []),
  getVocabStats: vi.fn(() => ({ total: 10, mastered: 3, learning: 7, collections: 2 })),
  getCollections: vi.fn(() => []),
  createCollection: vi.fn(),
  getVocabForPractice: vi.fn(() => []),
  getLearningStats: vi.fn(() => ({
    sessions: { total: 5, thisWeek: 2, thisMonth: 4 },
    messages: { total: 50, userMessages: 25, assistantMessages: 25, avgPerSession: 10 },
    vocabulary: { total: 10, mastered: 3, learning: 7, reviewedToday: 2, totalReviews: 20 },
    streaks: { currentStreak: 3, longestStreak: 7, lastActiveDate: '2026-01-20' },
    practice: { mostUsedMode: 'general', modeBreakdown: { general: 3, grammar: 2 } },
  })),
}));

vi.mock('../src/vocab-definitions.js', () => ({
  fetchDefinitions: vi.fn(async () => new Map([['test', 'a test word']])),
}));

vi.mock('../src/export.js', () => ({
  exportConversation: vi.fn(() => ({ filename: 'test.md', path: '/tmp' })),
  isValidExportFormat: vi.fn((f) => ['md', 'txt', 'json'].includes(f)),
}));

vi.mock('../src/summary.js', () => ({
  generateSessionSummary: vi.fn(),
  buildResumeContext: vi.fn(),
}));

describe('handleCommand', () => {
  let mockCtx: CommandContext;
  let mockActions: CommandActions;

  beforeEach(() => {
    const resolvedConfig: ResolvedConfig = {
      provider: 'openai',
      model: 'gpt-4',
      apiKey: 'test-key',
      summaryModel: null,
      error: null,
    };

    mockCtx = {
      sessionId: 'test-session',
      history: [],
      difficulty: 'intermediate',
      mode: 'general',
      resolvedConfig,
      configState: {
        config: null,
        error: null,
        path: '/tmp/config.json',
      },
      provider: {
        sendMessage: vi.fn(async () => "test: a test word definition"),
      } as unknown as CommandContext['provider'],
    };

    mockActions = {
      resetSession: vi.fn(),
      setDifficulty: vi.fn(),
      setMode: vi.fn(),
      setSessionId: vi.fn(),
      setHistory: vi.fn(),
      setConfigState: vi.fn(),
      setStatus: vi.fn(),
      addMessage: vi.fn(),
      setMainView: vi.fn(),
      setVocabPractice: vi.fn(),
      openModelPalette: vi.fn(),
    };
  });

  describe('/help', () => {
    it('returns help message with commands', () => {
      const result = handleCommand('/help', mockCtx, mockActions);
      expect(result?.message).toContain('Commands:');
      expect(result?.message).toContain('/help');
    });
  });

  describe('/clear', () => {
    it('clears conversation', () => {
      const result = handleCommand('/clear', mockCtx, mockActions);
      expect(mockActions.resetSession).toHaveBeenCalledWith(false);
      expect(result?.message).toBe('Conversation cleared.');
    });

    it('starts new session with --new-session flag', () => {
      const result = handleCommand('/clear --new-session', mockCtx, mockActions);
      expect(mockActions.resetSession).toHaveBeenCalledWith(true);
      expect(result?.message).toContain('new session');
    });
  });

  describe('/difficulty', () => {
    it('shows current difficulty without argument', () => {
      const result = handleCommand('/difficulty', mockCtx, mockActions);
      expect(result?.message).toContain('intermediate');
    });

    it('sets valid difficulty', () => {
      const result = handleCommand('/difficulty advanced', mockCtx, mockActions);
      expect(mockActions.setDifficulty).toHaveBeenCalledWith('advanced');
      expect(result?.message).toContain('advanced');
    });

    it('rejects invalid difficulty', () => {
      const result = handleCommand('/difficulty expert', mockCtx, mockActions);
      expect(result?.isError).toBe(true);
      expect(mockActions.setDifficulty).not.toHaveBeenCalled();
    });
  });

  describe('/mode', () => {
    it('shows available modes without argument', () => {
      const result = handleCommand('/mode', mockCtx, mockActions);
      expect(result?.message).toContain('Modes:');
    });

    it('sets valid mode', () => {
      handleCommand('/mode grammar', mockCtx, mockActions);
      expect(mockActions.setMode).toHaveBeenCalledWith('grammar');
    });

    it('rejects invalid mode', () => {
      const result = handleCommand('/mode invalid', mockCtx, mockActions);
      expect(result?.isError).toBe(true);
    });
  });

  describe('/stats', () => {
    it('returns learning statistics', () => {
      const result = handleCommand('/stats', mockCtx, mockActions);
      expect(result?.message).toContain('Learning Statistics');
      expect(result?.message).toContain('Sessions:');
      expect(result?.message).toContain('Messages:');
      expect(result?.message).toContain('Vocabulary:');
      expect(result?.message).toContain('Streaks:');
    });
  });

  describe('/save', () => {
    it('saves vocabulary words to collection', async () => {
      const result = handleCommand('/save apple, banana fruits', mockCtx, mockActions);
      expect(result).toBe(null);
      expect(mockActions.setStatus).toHaveBeenCalledWith('thinking');
      await new Promise((r) => setTimeout(r, 10));
      expect(mockActions.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'assistant',
          content: expect.stringContaining('Saved'),
        })
      );
    });

    it('saves words to default collection when no collection specified', async () => {
      const result = handleCommand('/save hello', mockCtx, mockActions);
      expect(result).toBe(null);
      expect(mockActions.setStatus).toHaveBeenCalledWith('thinking');
      await new Promise((r) => setTimeout(r, 10));
      expect(mockActions.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'assistant',
          content: expect.stringContaining('Saved'),
        })
      );
    });

    it('shows usage without words', () => {
      const result = handleCommand('/save', mockCtx, mockActions);
      expect(result?.isError).toBe(true);
      expect(result?.message).toContain('Usage:');
    });
  });

  describe('/vocab practice', () => {
    it('starts type-answer practice and emits a tip when some words lack definitions', async () => {
      const storage = await import('../src/storage.js');
      const getVocabForPracticeMock = vi.mocked(storage.getVocabForPractice);

      getVocabForPracticeMock.mockReturnValue([
        { id: 1, word: 'alpha', definition: 'first letter', collection: 'default' } as any,
        { id: 2, word: 'beta', definition: 'second letter', collection: 'default' } as any,
        { id: 3, word: 'gamma', definition: null, collection: 'default' } as any,
        { id: 4, word: 'delta', definition: null, collection: 'default' } as any,
        { id: 5, word: 'epsilon', definition: null, collection: 'default' } as any,
        { id: 6, word: 'zeta', definition: null, collection: 'default' } as any,
        { id: 7, word: 'eta', definition: null, collection: 'default' } as any,
        { id: 8, word: 'theta', definition: null, collection: 'default' } as any,
        { id: 9, word: 'iota', definition: null, collection: 'default' } as any,
        { id: 10, word: 'kappa', definition: null, collection: 'default' } as any,
      ]);

      const result = handleCommand('/vocab practice --type', mockCtx, mockActions);
      expect(result).toBe(null);

      expect(mockActions.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('(Tip) Warning: 8 of 10 words have no definition and will be skipped.'),
        }),
      );

      expect(mockActions.setMainView).toHaveBeenCalledWith('vocabPractice');
      expect(mockActions.setVocabPractice).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'type-answer',
        }),
      );

      const setArg = vi.mocked(mockActions.setVocabPractice).mock.calls[0]?.[0] as any;
      expect(setArg.items).toHaveLength(2);
      expect(setArg.items[0]?.definition).toBeTruthy();
      expect(setArg.items[1]?.definition).toBeTruthy();
    });
  });

  describe('unknown command', () => {
    it('returns error for unknown command', () => {
      const result = handleCommand('/unknown', mockCtx, mockActions);
      expect(result?.isError).toBe(true);
      expect(result?.message).toContain('Unknown command');
    });
  });
});

describe('availableModes', () => {
  it('contains expected modes', () => {
    expect(availableModes).toContain('general');
    expect(availableModes).toContain('grammar');
    expect(availableModes).toContain('vocab');
    expect(availableModes).toContain('role-play');
    expect(availableModes).toContain('fluency');
    expect(availableModes).toContain('exam');
  });
});
