import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { alternateTitle, displayTitle } from '../src/title-display.ts';

describe('title display', () => {
  it('uses the selected language and falls back to the original title', () => {
    const translated = { title: 'Aiyoku no Eustia', chineseTitle: '秽翼的尤斯蒂娅' };
    const originalOnly = { title: 'Night of Revenge', chineseTitle: '' };

    assert.equal(displayTitle(translated, 'chinese'), '秽翼的尤斯蒂娅');
    assert.equal(alternateTitle(translated, 'chinese'), 'Aiyoku no Eustia');
    assert.equal(displayTitle(originalOnly, 'chinese'), 'Night of Revenge');
    assert.equal(alternateTitle(originalOnly, 'chinese'), null);
  });
});
