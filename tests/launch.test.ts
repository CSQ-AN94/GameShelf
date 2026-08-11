import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { detachedGameProcessOptions, parseLaunchArguments } from '../src/launch.ts';

describe('parseLaunchArguments', () => {
  it('keeps ordinary quoted Windows arguments together', () => {
    assert.deepEqual(parseLaunchArguments('--profile "R18 Chinese" --fullscreen'), [
      '--profile',
      'R18 Chinese',
      '--fullscreen'
    ]);
  });

  it('starts games in an independent process group without inherited handles', () => {
    assert.deepEqual(detachedGameProcessOptions('C:\\Games\\Test'), {
      cwd: 'C:\\Games\\Test',
      detached: true,
      stdio: 'ignore',
      windowsHide: false
    });
  });
});
