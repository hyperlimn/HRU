import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';

describe('production observation source',()=>{it('contains no Math.random()',async()=>{const names=execFileSync('rg',['--files','src/observer','server/observation'],{encoding:'utf8'}).trim().split(/\r?\n/).filter((name)=>!name.endsWith('.test.ts'));const sources=await Promise.all(names.map((name)=>readFile(join(process.cwd(),name),'utf8')));expect(sources.join('\n')).not.toContain('Math.random(');});});
