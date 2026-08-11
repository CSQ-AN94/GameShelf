import type { SpawnOptions } from 'node:child_process';

export function parseLaunchArguments(value: string): string[] {
  // ponytail: handles ordinary quoted arguments; use CommandLineToArgvW if advanced Windows escaping becomes necessary.
  return (value.match(/(?:[^\s"]+|"[^"]*")+/g) ?? []).map((argument) =>
    argument.startsWith('"') && argument.endsWith('"') ? argument.slice(1, -1) : argument
  );
}

export function detachedGameProcessOptions(workingDirectory: string): SpawnOptions {
  return {
    cwd: workingDirectory,
    detached: true,
    stdio: 'ignore',
    windowsHide: false
  };
}
