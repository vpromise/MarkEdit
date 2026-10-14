// Task marker validation adapted from MarkEdit-preview (MIT).
export function resolveTaskToggle(line: string): { offset: number; replacement: string } | null {
  const match = /^((?:\s{0,3}>\s*)*\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])\](?= )/.exec(line);
  return match === null ? null : {
    offset: match[1].length,
    replacement: match[2] === ' ' ? 'x' : ' ',
  };
}
