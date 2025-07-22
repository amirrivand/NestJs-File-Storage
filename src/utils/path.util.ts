import * as path from 'path';

/**
 * Join multiple path segments into a single path string.
 * @param segments Path segments to join.
 * @returns The joined path string.
 */
export function joinPath(...segments: string[]): string {
  return path.join(...segments);
} 