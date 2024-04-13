export function getRegExp(pattern: string, flags?: string) {
  return new RegExp(pattern, flags);
}
