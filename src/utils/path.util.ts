import * as path from 'path';

export function joinPath(...segments: string[]): string {
  return path.join(...segments);
} 