import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceDirectories = [
  'src/observer',
  'src/visual-lab',
  'server/observation',
  'server/visual-lab',
];

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? listFiles(path) : entry.isFile() ? [path] : [];
    }),
  );

  return files.flat();
}

describe('production observation source', () => {
  it('contains no Math.random()', async () => {
    const names = (await Promise.all(sourceDirectories.map(listFiles)))
      .flat()
      .filter((name) => !name.endsWith('.test.ts'))
      .sort();
    const sources = await Promise.all(names.map((name) => readFile(name, 'utf8')));

    expect(sources.join('\n')).not.toContain('Math.random(');
  });
});
