import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifyGameSetup, type ScannedEntry } from '../src/game-detection.ts';

const directory = (relativePath: string): ScannedEntry => ({ relativePath, isDirectory: true });
const file = (relativePath: string): ScannedEntry => ({ relativePath, isDirectory: false });

describe('game setup detection', () => {
  it('recognizes Unity mods, saves, patches, and ignores helper executables', () => {
    const result = classifyGameSetup('G:\\game\\[ACT]复仇之夜\\NightofRevenge.exe', [
      file('NightofRevenge.exe'), file('UnityPlayer.dll'), file('UnityCrashHandler64.exe'),
      directory('BepInEx'), directory('BepInEx\\plugins'), directory('SaveData'),
      directory('无码补丁'), file('无码补丁\\patch.exe')
    ]);

    assert.equal(result.engine, 'Unity');
    assert.equal(result.suggestedType, 'action');
    assert.equal(result.suggestedCategory, '动作游戏');
    assert.deepEqual(result.alternativeExecutables, []);
    assert.ok(result.modDirectories.some((item) => item.endsWith('BepInEx')));
    assert.ok(result.saveDirectories.some((item) => item.endsWith('SaveData')));
    assert.ok(result.patchDirectories.some((item) => item.endsWith('无码补丁')));
  });

  it('recognizes a localized BGI launcher without treating it as a helper', () => {
    const result = classifyGameSetup('G:\\GalGame\\樱之诗\\BGI.exe', [file('BGI.exe'), file('BGI.chs.exe'), directory('SaveData'), directory('汉化补丁')]);

    assert.equal(result.engine, 'BGI / Buriko');
    assert.equal(result.suggestedCategory, 'Galgame');
    assert.ok(result.alternativeExecutables.some((item) => item.endsWith('BGI.chs.exe')));
  });
});
