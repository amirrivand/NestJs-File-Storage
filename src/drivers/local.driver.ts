import { promises as fs, constants, createReadStream } from 'fs';
import * as path from 'path';
import { LocalDiskConfig, StorageDriver, FileMetadata } from '../lib/file-storage.interface';
import { Readable } from 'stream';
import * as crypto from 'crypto';
import { IncomingMessage } from 'http';

export class LocalStorageDriver implements StorageDriver {
  private basePublicUrl: string;
  private static tempLinks: Map<
    string,
    { path: string; expiresAt: number; ip?: string; deviceId?: string }
  > = new Map();

  constructor(private config: LocalDiskConfig) {
    this.basePublicUrl = config.basePublicUrl || '';
  }

  /**
   * Merge the path with root path and if the path is absolute, it will return the path as is
   * @param relPath - The relative path to merge with the root path
   * @returns The full path
   */
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
            (await this.listFiles(relEntryPath, true)).map((f) => path.join(entry.name, f)),
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
          results = results.concat(await this.listDirectories(relEntryPath, true));
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

  async setVisibility(relPath: string, visibility: 'public' | 'private'): Promise<void> {
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

  /**
   * Generate a temporary URL for a local file. Supports optional IP/device restriction.
   * @param relPath File path
   * @param expiresIn Expiration in seconds (default: 3600)
   * @param options Optional { ip, deviceId }
   * @returns Signed temporary URL
   */
  async getTemporaryUrl(
    relPath: string,
    expiresIn: number = 3600,
    options?: { ip?: string; deviceId?: string },
  ): Promise<string> {
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + expiresIn * 1000;
    LocalStorageDriver.tempLinks.set(token, { path: relPath, expiresAt, ...options });
    // Example: http://host/files/temp?token=...
    const base = this.basePublicUrl || '';
    return `${base}/temp?token=${token}`;
  }

  static validateTempToken(token: string, req?: IncomingMessage): string | null {
    const entry = LocalStorageDriver.tempLinks.get(token);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      LocalStorageDriver.tempLinks.delete(token);
      return null;
    }
    if (entry.ip && req && req.socket.remoteAddress !== entry.ip) return null;
    if (entry.deviceId && req && req.headers['x-device-id'] !== entry.deviceId) return null;
    return entry.path;
  }

  /**
   * Store a file with expiration metadata (sidecar .meta.json file).
   */
  async putTimed(
    relPath: string,
    content: Buffer | string,
    options: { expiresAt?: Date; ttl?: number; visibility?: 'public' | 'private' },
  ): Promise<void> {
    await this.put(relPath, content, options);
    const expiresAt = options.expiresAt
      ? options.expiresAt.getTime()
      : options.ttl
        ? Date.now() + options.ttl * 1000
        : undefined;
    if (expiresAt) {
      const metaPath = this.fullPath(relPath) + '.meta.json';
      await fs.writeFile(metaPath, JSON.stringify({ expiresAt }));
    }
  }

  /**
   * Delete all expired files (based on .meta.json files). Returns number of deleted files.
   */
  async deleteExpiredFiles(): Promise<number> {
    const files = await this.listFiles('', true);
    let deleted = 0;
    for (const file of files) {
      const metaPath = this.fullPath(file) + '.meta.json';
      try {
        const metaRaw = await fs.readFile(metaPath, 'utf-8');
        const meta = JSON.parse(metaRaw);
        if (meta.expiresAt && Date.now() > meta.expiresAt) {
          await this.delete(file);
          await fs.unlink(metaPath);
          deleted++;
        }
      } catch {
        // No meta file or parse error: skip
      }
    }
    return deleted;
  }
}
