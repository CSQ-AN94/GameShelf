import type { Game, GameCollection } from './shared.ts';

export function applySafeView(games: Game[], collections: GameCollection[], enabled: boolean): { games: Game[]; collections: GameCollection[] } {
  if (!enabled) return { games, collections };
  const hiddenIds = new Set(games.filter((game) => game.hideInSafeView).map((game) => game.id));
  return {
    games: games.filter((game) => !hiddenIds.has(game.id)),
    collections: collections.filter((collection) => collection.gameIds.every((id) => !hiddenIds.has(id)))
  };
}
