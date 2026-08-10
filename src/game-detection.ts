import { readdir } from 'node:fs/promises';
import path from 'node:path';
import type { GameSetupAnalysis, GameType } from './shared';

export type ScannedEntry = { relativePath: string; isDirectory: boolean };

const ignoredExecutable = /(?:unins|uninstall|crashhandler|pythonw?|zsync|dxwebsetup|userconf|config|setup|patch|update|part\d|delfile|ファイル破損|セーブデータフォルダ|(?:^|\/)(?:lib|补丁|原版备份|备份|全cg存档)(?:\/|$))/i;

async function scanDirectory(root: string): Promise<ScannedEntry[]> {
  const entries: ScannedEntry[] = [];
  const queue = [{ directory: root, relativePath: '', depth: 0 }];
  while (queue.length > 0 && entries.length < 4000) {
    const current = queue.shift()!;
    let children;
    try { children = await readdir(current.directory, { withFileTypes: true }); } catch { continue; }
    for (const child of children) {
      const relativePath = path.join(current.relativePath, child.name);
      entries.push({ relativePath, isDirectory: child.isDirectory() });
      if (child.isDirectory() && current.depth < 4) queue.push({ directory: path.join(current.directory, child.name), relativePath, depth: current.depth + 1 });
      if (entries.length >= 4000) break;
    }
  }
  return entries;
}

export function classifyGameSetup(executablePath: string, entries: ScannedEntry[]): GameSetupAnalysis {
  const pathApi = executablePath.includes('\\') ? path.win32 : path;
  const normalizedEntries = entries.map((entry) => ({ ...entry, normalized: entry.relativePath.replaceAll('\\', '/').toLocaleLowerCase() }));
  const files = normalizedEntries.filter((entry) => !entry.isDirectory);
  const directories = normalizedEntries.filter((entry) => entry.isDirectory);
  const hasFile = (pattern: RegExp) => files.some((entry) => pattern.test(entry.normalized));
  const hasDirectory = (pattern: RegExp) => directories.some((entry) => pattern.test(entry.normalized));

  let engine: string | null = null;
  if (hasFile(/(?:^|\/)www\/data\/system\.json$/)) engine = 'RPG Maker MV/MZ';
  else if (hasDirectory(/(?:^|\/)renpy(?:\/|$)/)) engine = 'Ren\'Py';
  else if (hasFile(/(?:^|\/)(?:unityplayer\.dll|gameassembly\.dll)$/) || hasDirectory(/_data$/)) engine = 'Unity';
  else if (hasFile(/(?:^|\/)bgi(?:\.chs)?\.exe$/)) engine = 'BGI / Buriko';
  else if (hasFile(/\.xp3$/)) engine = 'Kirikiri';

  const fullPath = executablePath.toLocaleLowerCase();
  let suggestedType: GameType = 'other';
  let suggestedCategory = '其他游戏';
  if (/\[(?:act|action)/i.test(executablePath)) { suggestedType = 'action'; suggestedCategory = '动作游戏'; }
  else if (/\[rpg/i.test(executablePath) || engine === 'RPG Maker MV/MZ') { suggestedType = 'rpg'; suggestedCategory = 'RPG'; }
  else if (/\[(?:slg|sim)/i.test(executablePath)) { suggestedType = 'simulation'; suggestedCategory = '模拟经营'; }
  else if (/\[3d/i.test(executablePath)) { suggestedCategory = '3D'; }
  else if (/\[adv/i.test(executablePath)) { suggestedType = 'visual_novel'; suggestedCategory = 'ADV'; }
  else if (fullPath.includes('\\galgame\\') || ['Ren\'Py', 'BGI / Buriko', 'Kirikiri'].includes(engine ?? '')) { suggestedType = 'visual_novel'; suggestedCategory = 'Galgame'; }

  const root = pathApi.dirname(executablePath);
  const alternativeExecutables = files
    .filter((entry) => entry.normalized.endsWith('.exe') && !ignoredExecutable.test(entry.normalized))
    .map((entry) => pathApi.join(root, entry.relativePath))
    .filter((candidate) => pathApi.resolve(candidate).toLocaleLowerCase() !== pathApi.resolve(executablePath).toLocaleLowerCase())
    .slice(0, 8);

  const modDirectories = directories.filter((entry) => /(?:^|\/)(?:bepinex(?:\/plugins)?|melonloader(?:\/mods)?|mods)(?:\/|$)/i.test(entry.normalized)).map((entry) => pathApi.join(root, entry.relativePath)).slice(0, 8);
  const saveDirectories = directories.filter((entry) => /(?:^|\/)(?:save|saves|savedata|[^/]+_savedata)(?:\/|$)/i.test(entry.normalized) && !/(?:备份|全cg|补丁)/i.test(entry.relativePath)).map((entry) => pathApi.join(root, entry.relativePath)).slice(0, 8);
  const patchDirectories = directories.filter((entry) => /(?:patch|补丁|汉化|作弊|无码)/i.test(pathApi.basename(entry.relativePath))).map((entry) => pathApi.join(root, entry.relativePath)).slice(0, 8);

  return { engine, suggestedType, suggestedCategory, alternativeExecutables, modDirectories, saveDirectories, patchDirectories };
}

export async function analyzeExecutable(executablePath: string): Promise<GameSetupAnalysis> {
  return classifyGameSetup(executablePath, await scanDirectory(path.dirname(executablePath)));
}
