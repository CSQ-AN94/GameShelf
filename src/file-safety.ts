import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MAX_FILES = 50_000;
const MAX_BYTES = 20 * 1024 * 1024 * 1024;

type SnapshotFile = { path: string; size: number; sha256: string };
type SnapshotManifest = { version: 1; createdAt: string; files: SnapshotFile[] };

function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function manifestHash(manifest: SnapshotManifest): string {
  return createHash('sha256').update(JSON.stringify({ version: manifest.version, files: manifest.files })).digest('hex');
}

function relativeFilePath(value: string): string {
  if (typeof value !== 'string' || !value || path.isAbsolute(value)) throw new Error('快照包含无效文件路径');
  const parts = value.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) throw new Error('快照包含越界文件路径');
  return path.join(...parts);
}

async function assertMissing(target: string): Promise<void> {
  try {
    await lstat(target);
    throw new Error(`目标已存在：${target}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

async function copyTree(source: string, destination: string): Promise<SnapshotFile[]> {
  const files: SnapshotFile[] = [];
  let totalBytes = 0;
  const visit = async (sourceDirectory: string, destinationDirectory: string, relativeDirectory: string): Promise<void> => {
    const directoryDetails = await lstat(sourceDirectory);
    if (!directoryDetails.isDirectory() || directoryDetails.isSymbolicLink()) throw new Error(`不支持符号链接目录：${sourceDirectory}`);
    await mkdir(destinationDirectory, { recursive: true });
    const entries = await readdir(sourceDirectory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) throw new Error(`不支持符号链接：${path.join(sourceDirectory, entry.name)}`);
      const sourcePath = path.join(sourceDirectory, entry.name);
      const destinationPath = path.join(destinationDirectory, entry.name);
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await visit(sourcePath, destinationPath, relativePath);
      } else if (entry.isFile()) {
        const details = await lstat(sourcePath);
        if (!details.isFile() || details.isSymbolicLink()) throw new Error(`不支持符号链接：${sourcePath}`);
        totalBytes += details.size;
        if (files.length >= MAX_FILES || totalBytes > MAX_BYTES) {
          // ponytail: conservative local-copy ceiling; raise it or add streaming archives only for measured larger libraries.
          throw new Error('目录超过安全快照上限（50000 个文件或 20 GiB）');
        }
        await copyFile(sourcePath, destinationPath);
        files.push({ path: relativePath.replaceAll('\\', '/'), size: details.size, sha256: await hashFile(destinationPath) });
      } else {
        throw new Error(`不支持的文件类型：${sourcePath}`);
      }
    }
  };
  await visit(source, destination, '');
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

export async function createTreeSnapshot(source: string, destination: string): Promise<{ manifestHash: string; fileCount: number; totalBytes: number }> {
  const details = await lstat(source);
  if (!details.isDirectory() || details.isSymbolicLink()) throw new Error('快照来源不是普通文件夹');
  await assertMissing(destination);
  await mkdir(path.dirname(destination), { recursive: true });
  const staged = `${destination}.tmp-${randomUUID()}`;
  try {
    const files = await copyTree(source, path.join(staged, 'files'));
    const manifest: SnapshotManifest = { version: 1, createdAt: new Date().toISOString(), files };
    await writeFile(path.join(staged, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await rename(staged, destination);
    return { manifestHash: manifestHash(manifest), fileCount: files.length, totalBytes: files.reduce((sum, file) => sum + file.size, 0) };
  } catch (error) {
    await rm(staged, { recursive: true, force: true });
    throw error;
  }
}

export async function validateTreeSnapshot(snapshotPath: string): Promise<{ manifest: SnapshotManifest; manifestHash: string }> {
  const snapshotDetails = await lstat(snapshotPath);
  const filesRoot = path.join(snapshotPath, 'files');
  const filesRootDetails = await lstat(filesRoot);
  if (!snapshotDetails.isDirectory() || snapshotDetails.isSymbolicLink() || !filesRootDetails.isDirectory() || filesRootDetails.isSymbolicLink()) {
    throw new Error('快照目录无效或包含符号链接');
  }
  const manifestPath = path.join(snapshotPath, 'manifest.json');
  const details = await lstat(manifestPath);
  if (!details.isFile() || details.isSymbolicLink() || details.size > 16 * 1024 * 1024) throw new Error('快照清单无效或过大');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as SnapshotManifest;
  if (manifest.version !== 1 || !Array.isArray(manifest.files) || manifest.files.length > MAX_FILES) throw new Error('快照清单版本或文件数量无效');
  const seen = new Set<string>();
  let totalBytes = 0;
  for (const file of manifest.files) {
    const relativePath = relativeFilePath(file.path);
    if (seen.has(file.path) || !Number.isSafeInteger(file.size) || file.size < 0 || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error('快照文件清单无效');
    seen.add(file.path);
    totalBytes += file.size;
    if (totalBytes > MAX_BYTES) throw new Error('快照超过 20 GiB 安全上限');
    let directory = filesRoot;
    for (const part of relativePath.split(path.sep).slice(0, -1)) {
      directory = path.join(directory, part);
      const directoryDetails = await lstat(directory);
      if (!directoryDetails.isDirectory() || directoryDetails.isSymbolicLink()) throw new Error(`快照包含无效目录：${file.path}`);
    }
    const source = path.join(filesRoot, relativePath);
    const sourceDetails = await lstat(source);
    if (!sourceDetails.isFile() || sourceDetails.isSymbolicLink() || sourceDetails.size !== file.size || await hashFile(source) !== file.sha256) throw new Error(`快照校验失败：${file.path}`);
  }
  return { manifest, manifestHash: manifestHash(manifest) };
}

export async function restoreTreeSnapshot(snapshotPath: string, targetPath: string): Promise<{ recoveryPath: string; manifestHash: string }> {
  const { manifest, manifestHash: verifiedHash } = await validateTreeSnapshot(snapshotPath);
  const target = path.resolve(targetPath);
  const targetDetails = await lstat(target);
  if (!targetDetails.isDirectory() || targetDetails.isSymbolicLink()) throw new Error('存档位置不是普通文件夹');
  const staged = path.join(path.dirname(target), `.${path.basename(target)}.gameshelf-restore-new-${randomUUID()}`);
  const recoveryPath = path.join(path.dirname(target), `${path.basename(target)}.gameshelf-restore-old-${new Date().toISOString().replace(/[-:.TZ]/g, '')}-${randomUUID().slice(0, 8)}`);
  await assertMissing(staged);
  await assertMissing(recoveryPath);
  try {
    await mkdir(staged, { recursive: true });
    for (const file of manifest.files) {
      const relativePath = relativeFilePath(file.path);
      const destination = path.join(staged, relativePath);
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(path.join(snapshotPath, 'files', relativePath), destination);
      if (await hashFile(destination) !== file.sha256) throw new Error(`恢复暂存校验失败：${file.path}`);
    }
    await rename(target, recoveryPath);
    try {
      await rename(staged, target);
    } catch (error) {
      await rename(recoveryPath, target);
      throw error;
    }
    return { recoveryPath, manifestHash: verifiedHash };
  } catch (error) {
    await rm(staged, { recursive: true, force: true });
    throw error;
  }
}

export async function renameDirectorySafely(sourcePath: string, targetPath: string): Promise<void> {
  const source = path.resolve(sourcePath);
  const target = path.resolve(targetPath);
  if (path.dirname(source) !== path.dirname(target) || source === target) throw new Error('Package 变更必须在同一父目录内完成');
  const sourceDetails = await lstat(source);
  if (!sourceDetails.isDirectory() || sourceDetails.isSymbolicLink()) throw new Error('Package 来源不是普通文件夹');
  await assertMissing(target);
  await rename(source, target);
}

export function isPathInside(parent: string, child: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
}
