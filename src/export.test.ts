import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import { exportConversation, isValidExportFormat } from './export.js';
import type { ChatMessage } from './providers/types.js';

vi.mock('node:fs', () => ({
  default: {
    writeFileSync: vi.fn(),
  },
}));

describe('isValidExportFormat', () => {
  it('returns true for valid formats', () => {
    expect(isValidExportFormat('md')).toBe(true);
    expect(isValidExportFormat('txt')).toBe(true);
    expect(isValidExportFormat('json')).toBe(true);
  });

  it('returns false for invalid formats', () => {
    expect(isValidExportFormat('pdf')).toBe(false);
    expect(isValidExportFormat('docx')).toBe(false);
    expect(isValidExportFormat('')).toBe(false);
  });
});

describe('exportConversation', () => {
  const mockMessages: ChatMessage[] = [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there!' },
  ];
  const sessionId = 'test-session-12345678';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports markdown format', () => {
    const result = exportConversation(mockMessages, sessionId, 'md');
    
    expect(result.filename).toMatch(/^english-tutor-test-ses.*\.md$/);
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    
    const content = (fs.writeFileSync as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(content).toContain('# English Tutor Session');
    expect(content).toContain('**You:**');
    expect(content).toContain('Hello');
    expect(content).toContain('**Tutor:**');
    expect(content).toContain('Hi there!');
  });

  it('exports text format', () => {
    const result = exportConversation(mockMessages, sessionId, 'txt');
    
    expect(result.filename).toMatch(/\.txt$/);
    
    const content = (fs.writeFileSync as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(content).toContain('English Tutor Session');
    expect(content).toContain('You:');
    expect(content).toContain('Tutor:');
  });

  it('exports JSON format', () => {
    const result = exportConversation(mockMessages, sessionId, 'json');
    
    expect(result.filename).toMatch(/\.json$/);
    
    const content = (fs.writeFileSync as ReturnType<typeof vi.fn>).mock.calls[0][1];
    const parsed = JSON.parse(content);
    expect(parsed.sessionId).toBe(sessionId);
    expect(parsed.messageCount).toBe(2);
    expect(parsed.messages).toHaveLength(2);
  });

  it('defaults to markdown format', () => {
    const result = exportConversation(mockMessages, sessionId);
    expect(result.filename).toMatch(/\.md$/);
  });
});
