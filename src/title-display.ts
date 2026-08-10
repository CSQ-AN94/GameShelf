import type { Game, TitleDisplayMode } from './shared';

type GameTitles = Pick<Game, 'title' | 'chineseTitle'>;

export function displayTitle(game: GameTitles, mode: TitleDisplayMode): string {
  return mode === 'chinese' && game.chineseTitle.trim() ? game.chineseTitle.trim() : game.title;
}

export function alternateTitle(game: GameTitles, mode: TitleDisplayMode): string | null {
  const alternate = mode === 'chinese' ? game.title : game.chineseTitle.trim();
  return alternate && alternate !== displayTitle(game, mode) ? alternate : null;
}
