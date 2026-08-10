import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseLaunchArguments } from '../src/launch.ts';

describe('parseLaunchArguments', () => {
  it('keeps ordinary quoted Windows arguments together', () => {
    assert.deepEqual(parseLaunchArguments('--profile "R18 Chinese" --fullscreen'), [
      '--profile',
      'R18 Chinese',
      '--fullscreen'
    ]);
  });
});
