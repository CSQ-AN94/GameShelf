import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { scanLibraryRoots } from '../src/library-scan.ts';
import type { Game } from '../src/shared.ts';

describe('library scanning', () => {
  it('uses reviewed local evidence and flags paths, launch variants, and related versions', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'gameshelf-scan-'));
    try {
      const local = path.join(root, 'Local Game');
      const versionA = path.join(root, 'Story v1.2');
      const versionB = path.join(root, 'Story v1.3');
      await Promise.all([mkdir(local), mkdir(versionA), mkdir(versionB)]);
      await Promise.all([
        writeFile(path.join(local, 'game.exe'), ''),
        writeFile(path.join(local, 'game_chs.exe'), ''),
        writeFile(path.join(local, 'cover.png'), 'not-decoded-during-scan'),
        writeFile(path.join(local, 'gameshelf.json'), JSON.stringify({ title: '本地清单标题', chineseTitle: '中文标题', type: 'visual_novel', category: 'ADV', contentRating: 'mature', cover: 'cover.png' })),
        writeFile(path.join(versionA, 'Story_v1.2.exe'), ''),
        writeFile(path.join(versionB, 'Story_v1.3.exe'), '')
      ]);
      const existing = [{ id: 'existing', title: 'Already Here', chineseTitle: '', launchProfiles: [{ id: 'p', name: '默认', executablePath: path.join(local, 'game.exe'), workingDirectory: local, launchArguments: '', isDefault: true }] }] as Game[];

      const results = await scanLibraryRoots([root], existing);
      const manifestGame = results.find((candidate) => candidate.title === '本地清单标题');
      const versions = results.filter((candidate) => candidate.title.startsWith('Story'));

      assert.equal(results.length, 3);
      assert.equal(manifestGame?.type, 'visual_novel');
      assert.equal(manifestGame?.category, 'ADV');
      assert.equal(manifestGame?.contentRating, 'mature');
      assert.equal(manifestGame?.launchProfiles.length, 2);
      assert.equal(manifestGame?.duplicatePath, true);
      assert.equal(manifestGame?.coverSourcePath, path.join(local, 'cover.png'));
      assert.equal(versions.length, 2);
      assert.ok(versions.every((candidate) => candidate.relatedCandidateIds.length === 1));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
