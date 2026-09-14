import { describe, expect, it } from 'vitest';
import { notesStartupRequiresRecovery } from './notesStartupAuthority';

describe('Notes AppContent startup authority', () => {
  it('keeps populated verified local authority available while surfacing a nonfatal bootstrap issue', () => {
    expect(notesStartupRequiresRecovery({
      syncError: 'Notes bootstrap needs attention.',
      noteCount: 108,
      folderCount: 8,
      notesAuthorityState: 'LOADED_POPULATED',
      foldersAuthorityState: 'LOADED_POPULATED',
    })).toBe(false);
  });

  it('fails startup when both domains are empty after a bootstrap issue', () => {
    expect(notesStartupRequiresRecovery({
      syncError: 'Notes bootstrap needs attention.',
      noteCount: 0,
      folderCount: 0,
      notesAuthorityState: 'LOADED_EMPTY',
      foldersAuthorityState: 'LOADED_EMPTY',
    })).toBe(true);
  });

  it('fails startup whenever either durable authority requires recovery', () => {
    expect(notesStartupRequiresRecovery({
      syncError: null,
      noteCount: 108,
      folderCount: 8,
      notesAuthorityState: 'LOADED_POPULATED',
      foldersAuthorityState: 'RECOVERY_REQUIRED',
    })).toBe(true);
  });
});
