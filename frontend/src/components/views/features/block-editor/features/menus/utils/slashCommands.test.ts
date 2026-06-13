import { describe, expect, it } from 'vitest';
import { resolveSlashCommand, slashCommandKeysMatching, slashDisplayLabel } from './slashCommands';

describe('resolveSlashCommand', () => {
  it.each([
    ['h1', 'heading1'],
    ['h2', 'heading2'],
    ['h3', 'heading3'],
    ['h4', 'heading4'],
    ['todo', 'todo'],
    ['toggle', 'toggle'],
    ['toggle1', 'toggleHeading1'],
    ['toggle2', 'toggleHeading2'],
    ['toggle3', 'toggleHeading3'],
    ['toggle4', 'toggleHeading4'],
    ['bullet', 'bullet'],
    ['number', 'numbered'],
    ['code', 'code'],
    ['math', 'math'],
    ['quote', 'quote'],
    ['divider', 'divider'],
    ['image', 'image'],
  ] as const)('resolves /%s', (cmd, type) => {
    expect(resolveSlashCommand(cmd)).toBe(type);
    expect(resolveSlashCommand(`/${cmd}`)).toBe(type);
  });

  it('returns null for unknown command', () => {
    expect(resolveSlashCommand('unknown')).toBeNull();
  });
});

describe('slashCommandKeysMatching', () => {
  it('matches prefix to', () => {
    const keys = slashCommandKeysMatching('to');
    expect(keys).toContain('todo');
    expect(keys).toContain('toggle');
  });
});

describe('slashDisplayLabel', () => {
  it('returns Korean labels', () => {
    expect(slashDisplayLabel('heading1')).toBe('제목 1');
    expect(slashDisplayLabel('heading4')).toBe('제목 4');
    expect(slashDisplayLabel('todo')).toBe('할 일');
  });
});
