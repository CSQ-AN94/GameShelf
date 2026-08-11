import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { PORTABLE_MARKER } from '../src/data-directory.ts';

const require = createRequire(import.meta.url);

test('marks the portable Windows package', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'gameshelf-portable-package-'));
  const previous = process.env.GAMESHELF_PORTABLE;
  try {
    process.env.GAMESHELF_PORTABLE = '1';
    const config = require('../forge.config.cjs');
    await config.hooks.postPackage({}, { platform: 'win32', outputPaths: [root] });
    assert.match(await readFile(path.join(root, PORTABLE_MARKER), 'utf8'), /data folder/);
    assert.deepEqual(config.makers.find((maker: { name: string }) => maker.name.endsWith('maker-zip')).platforms, ['win32']);
  } finally {
    if (previous === undefined) delete process.env.GAMESHELF_PORTABLE;
    else process.env.GAMESHELF_PORTABLE = previous;
    await rm(root, { recursive: true, force: true });
  }
});
