import type { ContentRating, Game, GameCollection, GameStatus, GameType } from './shared.ts';

export const gameTypeLabels: Record<GameType, string> = { visual_novel: '视觉小说', rpg: 'RPG', simulation: '模拟经营', action: '动作', other: '其他' };
export const ratingLabels: Record<ContentRating, string> = { general: '全年龄', mature: '成人向', r18: 'R18' };
export const statusLabels: Record<GameStatus, string> = { unplayed: '未开始', playing: '游玩中', completed: '已完成', paused: '已搁置' };
const statusSearchAliases: Record<GameStatus, string> = { unplayed: '未游玩 尚未游玩', playing: '正在玩', completed: '已玩完 通关', paused: '暂停 已暂停' };

function normalizeSearchText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

export function searchGames(games: Game[], collections: GameCollection[], query: string): Game[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];
  const tokens = normalizedQuery.split(' ');
  return games.map((game, index) => {
    const titles = [game.title, game.chineseTitle].map(normalizeSearchText).filter(Boolean);
    const collectionNames = collections.filter((collection) => collection.gameIds.includes(game.id)).map((collection) => collection.name);
    const text = normalizeSearchText([
      ...titles, game.developer, game.category, game.type, gameTypeLabels[game.type], game.contentRating, ratingLabels[game.contentRating], game.status, statusLabels[game.status], statusSearchAliases[game.status],
      game.wishlist ? '欲玩 欲玩清单 wishlist' : '', !game.coverDataUrl ? '缺失封面 无封面' : '',
      ...game.languages, game.description, ...collectionNames, ...game.launchProfiles.flatMap((profile) => [profile.name, profile.executablePath, profile.launchArguments])
    ].join(' '));
    if (!tokens.every((token) => text.includes(token))) return null;
    const score = titles.some((title) => title === normalizedQuery) ? 3 : titles.some((title) => title.startsWith(normalizedQuery)) ? 2 : titles.some((title) => title.includes(normalizedQuery)) ? 1 : 0;
    return { game, index, score };
  }).filter((item): item is { game: Game; index: number; score: number } => item !== null)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((item) => item.game);
}
