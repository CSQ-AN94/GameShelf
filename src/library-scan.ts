import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { classifyGameSetup, ignoredExecutable, scanDirectory } from './game-detection.ts';
import type { ContentRating, Game, GameType, LibraryScanCandidate } from './shared.ts';

const ignoredDirectory = /^(?:node_modules|\.git|bepinex|melonloader|mods?|save|saves|savedata|renpy|www|[^/]+_data|备份|补丁|全cg存档)$/i;
const genericExecutable = /^(?:game|launcher|start|play|bgi(?:\.chs)?)$/i;
const gameTypes = new Set<GameType>(['visual_novel', 'rpg', 'simulation', 'action', 'other']);
const contentRatings = new Set<ContentRating>(['general', 'mature', 'r18']);

type LocalManifest = {
  title?: unknown;
  chineseTitle?: unknown;
  type?: unknown;
  category?: unknown;
  contentRating?: unknown;
  cover?: unknown;
};

function normalizedPath(value: string): string {
  const pathApi = value.includes('\\') ? path.win32 : path;
  return pathApi.resolve(value).replaceAll('\\', '/').toLocaleLowerCase();
}

function cleanTitle(value: string): string {
  return value.replace(/\.exe$/i, '').replace(/^\s*(?:\[[^\]]+\]\s*)+/, '').replace(/[_-]+/g, ' ').trim();
}

export function canonicalGameTitle(value: string): string {
  // ponytail: heuristic only raises review flags; add explicit identities if false positives become common.
  return cleanTitle(value)
    .replace(/\b(?:v(?:er(?:sion)?)?\.?\s*)?\d+(?:\.\d+){1,3}\b/gi, '')
    .replace(/(?:汉化版|中文版|日文版|全年龄版|重制版|remaster(?:ed)?|complete edition)/gi, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .toLocaleLowerCase();
}

async function findExecutableFolders(root: string): Promise<Map<string, string[]>> {
  const folders = new Map<string, string[]>();
  const queue = [{ directory: path.resolve(root), depth: 0 }];
  let visited = 0;
  while (queue.length && visited < 6000 && folders.size < 500) {
    const current = queue.shift()!;
    let children;
    try { children = await readdir(current.directory, { withFileTypes: true }); } catch { continue; }
    visited += children.length;
    const executables = children
      .filter((entry) => entry.isFile() && entry.name.toLocaleLowerCase().endsWith('.exe') && !ignoredExecutable.test(entry.name))
      .map((entry) => path.join(current.directory, entry.name));
    if (executables.length) folders.set(current.directory, executables);
    if (current.depth >= 4) continue;
    for (const child of children) {
      if (child.isDirectory() && !child.isSymbolicLink() && !ignoredDirectory.test(child.name)) {
        queue.push({ directory: path.join(current.directory, child.name), depth: current.depth + 1 });
      }
    }
  }
  return folders;
}

async function readManifest(folder: string): Promise<LocalManifest | null> {
  const manifestPath = path.join(folder, 'gameshelf.json');
  try {
    const details = await stat(manifestPath);
    if (!details.isFile() || details.size > 64 * 1024) return null;
    return JSON.parse(await readFile(manifestPath, 'utf8')) as LocalManifest;
  } catch {
    return null;
  }
}

async function coverFrom(folder: string, manifest: LocalManifest | null): Promise<string | null> {
  const candidates: string[] = [];
  if (typeof manifest?.cover === 'string' && manifest.cover.trim() && !path.isAbsolute(manifest.cover)) {
    const resolved = path.resolve(folder, manifest.cover);
    if (path.relative(folder, resolved) && !path.relative(folder, resolved).startsWith('..')) candidates.push(resolved);
  }
  try {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      if (entry.isFile() && /^(?:cover|folder|poster)\.(?:jpe?g|png|webp)$/i.test(entry.name)) candidates.push(path.join(folder, entry.name));
    }
  } catch { /* unreadable folders are reported by the missing cover state */ }
  for (const candidate of candidates) {
    try { if ((await stat(candidate)).isFile()) return candidate; } catch { /* try the next local candidate */ }
  }
  return null;
}

function sortExecutables(folder: string, executables: string[]): string[] {
  const folderTitle = canonicalGameTitle(path.basename(folder));
  return [...executables].sort((left, right) => {
    const score = (value: string) => {
      const name = path.basename(value, path.extname(value));
      if (canonicalGameTitle(name) === folderTitle) return 0;
      if (genericExecutable.test(name)) return 1;
      return 2;
    };
    return score(left) - score(right) || left.localeCompare(right, 'zh-CN');
  });
}

export async function scanLibraryRoots(roots: string[], existingGames: Game[]): Promise<LibraryScanCandidate[]> {
  const existingPaths = new Map<string, string>();
  const existingTitles = new Map<string, string>();
  for (const game of existingGames) {
    for (const profile of game.launchProfiles) existingPaths.set(normalizedPath(profile.executablePath), game.id);
    for (const title of [game.title, game.chineseTitle].filter(Boolean)) existingTitles.set(canonicalGameTitle(title), game.id);
  }

  const folderMaps = await Promise.all(roots.map(findExecutableFolders));
  const folders = new Map<string, string[]>();
  for (const folderMap of folderMaps) {
    for (const [folder, executables] of folderMap) folders.set(normalizedPath(folder), executables);
  }

  const candidates: LibraryScanCandidate[] = [];
  for (const executables of folders.values()) {
    const folder = path.dirname(executables[0]!);
    const sortedExecutables = sortExecutables(folder, executables);
    const manifest = await readManifest(folder);
    const analysis = classifyGameSetup(sortedExecutables[0]!, await scanDirectory(folder));
    const executableTitles = sortedExecutables
      .map((value) => cleanTitle(path.basename(value)))
      .filter((value) => value && !genericExecutable.test(value));
    const titleOptions = [
      typeof manifest?.title === 'string' && manifest.title.trim() ? { value: manifest.title.trim(), source: '本地 gameshelf.json' } : null,
      ...executableTitles.map((value) => ({ value, source: '启动文件' })),
      { value: cleanTitle(path.basename(folder)), source: '游戏目录' }
    ].filter((item): item is { value: string; source: string } => Boolean(item));
    const uniqueTitleOptions = titleOptions.filter((item, index) => titleOptions.findIndex((candidate) => candidate.value.toLocaleLowerCase() === item.value.toLocaleLowerCase()) === index);
    const title = uniqueTitleOptions[0]!.value;
    const duplicatePathGameId = sortedExecutables.map((value) => existingPaths.get(normalizedPath(value))).find(Boolean) ?? null;
    const duplicateGameId = existingTitles.get(canonicalGameTitle(title)) ?? null;
    const issues: string[] = [];
    if (duplicatePathGameId) issues.push('启动路径已在游戏库中');
    if (duplicateGameId && duplicateGameId !== duplicatePathGameId) issues.push('名称疑似与已有游戏重复');
    if (sortedExecutables.length > 1) issues.push(`识别到 ${sortedExecutables.length} 个启动项`);
    const coverSourcePath = await coverFrom(folder, manifest);
    if (!coverSourcePath) issues.push('缺少封面');
    candidates.push({
      id: normalizedPath(folder),
      folderPath: folder,
      title,
      titleOptions: uniqueTitleOptions,
      chineseTitle: typeof manifest?.chineseTitle === 'string' ? manifest.chineseTitle.trim() : '',
      type: gameTypes.has(manifest?.type as GameType) ? manifest!.type as GameType : analysis.suggestedType,
      category: typeof manifest?.category === 'string' && manifest.category.trim() ? manifest.category.trim() : analysis.suggestedCategory,
      contentRating: contentRatings.has(manifest?.contentRating as ContentRating) ? manifest!.contentRating as ContentRating : 'general',
      executablePath: sortedExecutables[0]!,
      launchProfiles: sortedExecutables.map((executablePath, index) => ({
        name: index === 0 ? '默认启动' : cleanTitle(path.basename(executablePath)),
        executablePath,
        launchArguments: '',
        isDefault: index === 0
      })),
      coverSourcePath,
      engine: analysis.engine,
      issues,
      duplicatePath: Boolean(duplicatePathGameId),
      duplicateGameId: duplicateGameId ?? duplicatePathGameId,
      relatedCandidateIds: []
    });
  }

  const titleGroups = new Map<string, LibraryScanCandidate[]>();
  for (const candidate of candidates) {
    const key = canonicalGameTitle(candidate.title);
    if (!key) continue;
    titleGroups.set(key, [...(titleGroups.get(key) ?? []), candidate]);
  }
  for (const group of titleGroups.values()) {
    if (group.length < 2) continue;
    for (const candidate of group) {
      candidate.relatedCandidateIds = group.filter((item) => item.id !== candidate.id).map((item) => item.id);
      candidate.issues.push('本批次中有疑似同一作品或其他版本');
    }
  }
  return candidates.sort((left, right) => left.title.localeCompare(right.title, 'zh-CN'));
}
