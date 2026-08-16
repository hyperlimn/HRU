import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SavedSnapshot } from '../../src/modules/saves/save-system';
import { AuthoritativeRuntime } from './authoritative-runtime';

describe('AuthoritativeRuntime saves', () => {
  it('resumes exact state through the shared command layer after restart', async () => {
    const path = await mkdtemp(join(tmpdir(), 'hru-runtime-test-'));
    try {
      const first = new AuthoritativeRuntime(path);
      await first.command({ type: 'time/set-multiplier', multiplier: 100 });
      const result = await first.command({ type: 'saves/save-current', label: 'Restart state' });
      const saved = result.data as SavedSnapshot;
      const restarted = new AuthoritativeRuntime(path);
      const resumed = await restarted.command({ type: 'saves/resume', snapshotId: saved.id });
      expect(resumed.ok).toBe(true);
      expect(restarted.snapshot()).toEqual(saved.state);
    } finally { await rm(path, { recursive: true, force: true }); }
  });
});
