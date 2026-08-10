export function parseLaunchArguments(value: string): string[] {
  // ponytail: handles ordinary quoted arguments; use CommandLineToArgvW if advanced Windows escaping becomes necessary.
  return (value.match(/(?:[^\s"]+|"[^"]*")+/g) ?? []).map((argument) =>
    argument.startsWith('"') && argument.endsWith('"') ? argument.slice(1, -1) : argument
  );
}
