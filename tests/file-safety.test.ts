import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { createTreeSnapshot, renameDirectorySafely, restoreTreeSnapshot, validateTreeSnapshot } from '../src/file-safety.ts';

describe('file safety boundaries', () => {
  it('validates snapshots, creates a recovery copy, and restores atomically', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'gameshelf-saves-'));
    try {
      const save = path.join(root, 'SaveData');
      const snapshot = path.join(root, 'snapshots', 'one');
      const beforeRestore = path.join(root, 'snapshots', 'before');
      await mkdir(path.join(save, 'nested'), { recursive: true });
      await writeFile(path.join(save, 'slot.dat'), 'snapshot-state');
      await writeFile(path.join(save, 'nested', 'config.json'), '{}');
      const created = await createTreeSnapshot(save, snapshot);
      assert.equal((await validateTreeSnapshot(snapshot)).manifestHash, created.manifestHash);

      await writeFile(path.join(save, 'slot.dat'), 'current-state');
      await createTreeSnapshot(save, beforeRestore);
      const restored = await restoreTreeSnapshot(snapshot, save);
      assert.equal(await readFile(path.join(save, 'slot.dat'), 'utf8'), 'snapshot-state');
      assert.equal(await readFile(path.join(restored.recoveryPath, 'slot.dat'), 'utf8'), 'current-state');
      assert.equal((await validateTreeSnapshot(beforeRestore)).manifestHash.length, 64);

      await writeFile(path.join(snapshot, 'files', 'slot.dat'), 'tampered');
      await assert.rejects(validateTreeSnapshot(snapshot), /快照校验失败/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('backs up and toggles a package directory without deleting files', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'gameshelf-package-'));
    try {
      const enabled = path.join(root, 'Mods');
      const disabled = path.join(root, 'Mods.gameshelf-disabled');
      const backup = path.join(root, 'backups', 'mods');
      await mkdir(enabled);
      await writeFile(path.join(enabled, 'example.mod'), 'data');
      await createTreeSnapshot(enabled, backup);
      await renameDirectorySafely(enabled, disabled);
      await access(path.join(disabled, 'example.mod'));
      await renameDirectorySafely(disabled, enabled);
      await access(path.join(enabled, 'example.mod'));
      assert.equal((await validateTreeSnapshot(backup)).manifestHash.length, 64);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects linked snapshot sources and restore targets', { skip: process.platform === 'win32' }, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'gameshelf-links-'));
    try {
      const realSave = path.join(root, 'real-save');
      const linkedSave = path.join(root, 'linked-save');
      const snapshot = path.join(root, 'snapshot');
      await mkdir(realSave);
      await writeFile(path.join(realSave, 'slot.dat'), 'data');
      await symlink(realSave, linkedSave, 'dir');
      await assert.rejects(createTreeSnapshot(linkedSave, snapshot), /普通文件夹/);
      await createTreeSnapshot(realSave, snapshot);
      await assert.rejects(restoreTreeSnapshot(snapshot, linkedSave), /普通文件夹/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
