import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { PORTABLE_MARKER, resolveDataDirectory } from '../src/data-directory.ts';

test('keeps installed data stable and portable data beside the executable', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'gameshelf-data-mode-'));
  try {
    const executable = path.join(root, 'GameShelf.exe');
    const installedData = path.join(root, 'AppData', 'GameShelf');
    assert.equal(resolveDataDirectory(undefined, true, executable, installedData), installedData);

    await writeFile(path.join(root, PORTABLE_MARKER), 'portable');
    assert.equal(resolveDataDirectory(undefined, true, executable, installedData), path.join(root, 'data'));
    assert.equal(resolveDataDirectory(path.join(root, 'custom'), true, executable, installedData), path.join(root, 'custom'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
