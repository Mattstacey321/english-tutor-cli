import { describe, it, expect } from 'vitest';
import { updateDifficulty } from '../src/adaptive.js';

describe('updateDifficulty', () => {
  it('returns current difficulty for empty message', () => {
    expect(updateDifficulty('intermediate', '')).toBe('intermediate');
    expect(updateDifficulty('intermediate', '   ')).toBe('intermediate');
  });

  it('decreases difficulty for short messages (≤6 words)', () => {
    expect(updateDifficulty('intermediate', 'Hello there')).toBe('beginner');
    expect(updateDifficulty('advanced', 'How are you today?')).toBe('intermediate');
  });

  it('does not decrease below beginner', () => {
    expect(updateDifficulty('beginner', 'Hi')).toBe('beginner');
  });

  it('increases difficulty for long messages (≥20 words)', () => {
    const longMessage = 'This is a very long message that contains more than twenty words to test the difficulty adjustment logic in the adaptive module properly';
    expect(updateDifficulty('beginner', longMessage)).toBe('intermediate');
    expect(updateDifficulty('intermediate', longMessage)).toBe('advanced');
  });

  it('does not increase above advanced', () => {
    const longMessage = 'This is a very long message that contains more than twenty words to test the difficulty adjustment logic in the adaptive module properly';
    expect(updateDifficulty('advanced', longMessage)).toBe('advanced');
  });

  it('increases difficulty for complex punctuation', () => {
    expect(updateDifficulty('beginner', 'Hello; how are you?')).toBe('intermediate');
    expect(updateDifficulty('intermediate', 'First: let me explain')).toBe('advanced');
  });

  it('keeps difficulty for medium-length messages without complex punctuation', () => {
    expect(updateDifficulty('intermediate', 'I would like to practice my English skills')).toBe('intermediate');
  });
});
