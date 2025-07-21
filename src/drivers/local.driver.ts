import { promises as fs, constants, createReadStream } from 'fs';
import * as path from 'path';
import { LocalDiskConfig, StorageDriver, FileMetadata } from '../lib/file-storage.interface';
import { Readable } from 'stream';

export class LocalStorageDriver implements StorageDriver {
  private basePublicUrl: string;

  constructor(private config: LocalDiskConfig) {
    this.basePublicUrl = config.basePublicUrl || '';
  }

  private fullPath(relPath: string): string {
    return path.join(this.config.root || '', relPath);
  }

  async listFiles(dir = '', recursive = true): Promise<string[]> {
    const dirPath = this.fullPath(dir);
    let results: string[] = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullEntryPath = path.join(dirPath, entry.name);
      const relEntryPath = path.relative(this.config.root || '', fullEntryPath);
      if (entry.isDirectory()) {
        if (recursive) {
          results = results.concat(
            (await this.listFiles(relEntryPath, true)).map((f) =>
              path.join(entry.name, f),
            ),
          );
        }
      } else {
        results.push(path.join(dir, entry.name));
      }
    }
    return results;
  }

  async listDirectories(dir = '', recursive = true): Promise<string[]> {
    const dirPath = this.fullPath(dir);
    let results: string[] = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const relEntryPath = path.join(dir, entry.name);
        results.push(relEntryPath);
        if (recursive) {
          results = results.concat(
            await this.listDirectories(relEntryPath, true),
          );
        }
      }
    }
    return results;
  }

  async put(
    relPath: string,
    content: Buffer | string,
    options?: { visibility?: 'public' | 'private' },
  ): Promise<void> {
    const filePath = this.fullPath(relPath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content);
    if (options?.visibility) {
      await this.setVisibility(relPath, options.visibility);
    }
  }

  async setVisibility(
    relPath: string,
    visibility: 'public' | 'private',
  ): Promise<void> {
    const filePath = this.fullPath(relPath);
    const mode = visibility === 'public' ? 0o644 : 0o600;
    await fs.chmod(filePath, mode);
  }

  async getVisibility(relPath: string): Promise<'public' | 'private'> {
    const filePath = this.fullPath(relPath);
    const stats = await fs.stat(filePath);
    // 0o644 is public, 0o600 is private
    if ((stats.mode & 0o777) === 0o644) return 'public';
    if ((stats.mode & 0o777) === 0o600) return 'private';
    return 'private';
  }

  async get(relPath: string): Promise<Buffer> {
    return fs.readFile(this.fullPath(relPath));
  }

  async delete(relPath: string): Promise<void> {
    await fs.unlink(this.fullPath(relPath));
  }

  async exists(relPath: string): Promise<boolean> {
    try {
      await fs.access(this.fullPath(relPath), constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async copy(src: string, dest: string): Promise<void> {
    await fs.copyFile(this.fullPath(src), this.fullPath(dest));
  }

  async move(src: string, dest: string): Promise<void> {
    await fs.rename(this.fullPath(src), this.fullPath(dest));
  }

  async makeDirectory(relPath: string): Promise<void> {
    await fs.mkdir(this.fullPath(relPath), { recursive: true });
  }

  async deleteDirectory(relPath: string): Promise<void> {
    await fs.rm(this.fullPath(relPath), { recursive: true, force: true });
  }

  async getMetadata(relPath: string): Promise<FileMetadata> {
    const stats = await fs.stat(this.fullPath(relPath));
    return {
      path: relPath,
      size: stats.size,
      lastModified: stats.mtime,
      visibility: await this.getVisibility(relPath),
      // mimeType: not implemented
    };
  }

  async url(relPath: string): Promise<string> {
    if (this.basePublicUrl) {
      return `${this.basePublicUrl}/${relPath}`;
    }
    return relPath;
  }

  createReadStream(relPath: string): Readable {
    return createReadStream(this.fullPath(relPath));
  }

  async prepend(relPath: string, content: Buffer | string): Promise<void> {
    const filePath = this.fullPath(relPath);
    let existing = '';
    try {
      existing = (await fs.readFile(filePath)).toString();
    } catch {
      // If file does not exist, treat as empty
    }
    const newContent = Buffer.isBuffer(content)
      ? Buffer.concat([content, Buffer.from(existing)])
      : content + existing;
    await fs.writeFile(filePath, newContent);
  }

  async append(relPath: string, content: Buffer | string): Promise<void> {
    const filePath = this.fullPath(relPath);
    await fs.appendFile(filePath, content);
  }
}
