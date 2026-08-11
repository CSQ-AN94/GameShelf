import { existsSync } from 'node:fs';
import path from 'node:path';

export const PORTABLE_MARKER = 'gameshelf-portable';

export function resolveDataDirectory(configured: string | undefined, packaged: boolean, executablePath: string, defaultUserData: string): string {
  if (configured?.trim()) return path.resolve(configured.trim());
  const executableDirectory = path.dirname(executablePath);
  if (packaged && existsSync(path.join(executableDirectory, PORTABLE_MARKER))) return path.join(executableDirectory, 'data');
  return defaultUserData;
}
