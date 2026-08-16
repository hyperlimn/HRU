import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('universe law source', () => {
  it('does not use Math.random()', async () => {
    const directory = join(process.cwd(), 'server', 'law'); const names = (await readdir(directory)).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts')).sort();
    const sources = await Promise.all(names.map((name) => readFile(join(directory, name), 'utf8')));
    expect(sources.join('\n')).not.toContain('Math.random(');
  });
});
