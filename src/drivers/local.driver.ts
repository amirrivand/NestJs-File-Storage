import * as crypto from 'crypto';
import { constants, createReadStream, createWriteStream, promises as fs } from 'fs';
import { IncomingMessage } from 'http';
import * as path from 'path';
import { Readable } from 'stream';
import { FileMetadata, LocalDiskConfig, StorageDriver } from '../lib/file-storage.interface';

/**
 * Storage driver for local filesystem operations.
 * Implements file operations using Node.js fs and path modules.
 */
export class LocalStorageDriver implements StorageDriver {
  private basePublicUrl: string;
  private static tempLinks: Map<
    string,
    { path: string; expiresAt: number; ip?: string; deviceId?: string }
  > = new Map();

  /**
   * Create a new LocalStorageDriver.
   * @param config Local disk configuration.
   */
  constructor(private config: LocalDiskConfig) {
    this.basePublicUrl = config.basePublicUrl || '';
  }

  /**
   * Merge the path with root path and if the path is absolute, it will return the path as is.
   * @param relPath The relative path to merge with the root path.
   * @returns The full path.
   */
  private fullPath(relPath: string): string {
    return relPath;
  }

  /**
   * List files in a directory, optionally recursively.
   * @param dir Directory path.
   * @param recursive Whether to list recursively.
   * @returns Array of file paths.
   */
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

  /**
   * List directories in a directory, optionally recursively.
   * @param dir Directory path.
   * @param recursive Whether to list recursively.
   * @returns Array of directory paths.
   */
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

  /**
   * Store a file at the given path.
   * @param relPath Path to store the file at.
   * @param content File content as Buffer or string.
   * @param options Optional visibility settings.
   */
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

  /**
   * Store a file stream at the given path.
   * @param relPath Path to store the file at.
   * @param stream Readable stream of file content.
   * @param options Optional visibility settings.
   */
  async putStream(
    relPath: string,
    stream: Readable,
    options?: { visibility?: 'public' | 'private' },
  ): Promise<void> {
    const filePath = this.fullPath(relPath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await new Promise<void>((resolve, reject) => {
      const writeStream = createWriteStream(filePath);
      stream.pipe(writeStream);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
    if (options?.visibility) {
      await this.setVisibility(relPath, options.visibility);
    }
  }

  /**
   * Set the visibility of a file.
   * @param relPath Path of the file.
   * @param visibility Visibility setting.
   */
  async setVisibility(relPath: string, visibility: 'public' | 'private'): Promise<void> {
    const filePath = this.fullPath(relPath);
    const mode = visibility === 'public' ? 0o644 : 0o600;
    await fs.chmod(filePath, mode);
  }

  /**
   * Get the visibility of a file.
   * @param relPath Path of the file.
   * @returns Visibility setting.
   */
  async getVisibility(relPath: string): Promise<'public' | 'private'> {
    const filePath = this.fullPath(relPath);
    const stats = await fs.stat(filePath);
    // 0o644 is public, 0o600 is private
    if ((stats.mode & 0o777) === 0o644) return 'public';
    if ((stats.mode & 0o777) === 0o600) return 'private';
    return 'private';
  }

  /**
   * Retrieve a file as a Buffer.
   * @param relPath Path of the file to retrieve.
   * @returns File content as Buffer.
   */
  async get(relPath: string): Promise<Buffer> {
    return fs.readFile(this.fullPath(relPath));
  }

  /**
   * Delete a file at the given path.
   * @param relPath Path of the file to delete.
   */
  async delete(relPath: string): Promise<void> {
    await fs.unlink(this.fullPath(relPath));
  }

  /**
   * Check if a file exists at the given path.
   * @param relPath Path to check.
   * @returns True if file exists, false otherwise.
   */
  async exists(relPath: string): Promise<boolean> {
    try {
      await fs.access(this.fullPath(relPath), constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Copy a file from src to dest.
   * @param src Source path.
   * @param dest Destination path.
   */
  async copy(src: string, dest: string): Promise<void> {
    await fs.copyFile(this.fullPath(src), this.fullPath(dest));
  }

  /**
   * Move a file from src to dest.
   * @param src Source path.
   * @param dest Destination path.
   */
  async move(src: string, dest: string): Promise<void> {
    await fs.rename(this.fullPath(src), this.fullPath(dest));
  }

  /**
   * Create a directory at the given path.
   * @param relPath Directory path.
   */
  async makeDirectory(relPath: string): Promise<void> {
    await fs.mkdir(this.fullPath(relPath), { recursive: true });
  }

  /**
   * Delete a directory at the given path.
   * @param relPath Directory path.
   */
  async deleteDirectory(relPath: string): Promise<void> {
    await fs.rm(this.fullPath(relPath), { recursive: true, force: true });
  }

  /**
   * Get metadata for a file.
   * @param relPath Path of the file.
   * @returns File metadata.
   */
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

  /**
   * Get a public URL for a file, if supported.
   * @param relPath Path of the file.
   * @returns Public URL or file path.
   */
  async url(relPath: string): Promise<string> {
    if (this.basePublicUrl) {
      return `${this.basePublicUrl}/${relPath}`;
    }
    return relPath;
  }

  /**
   * Create a readable stream for a file.
   * @param relPath Path of the file.
   * @returns Readable stream.
   */
  createReadStream(relPath: string): Readable {
    return createReadStream(this.fullPath(relPath));
  }

  /**
   * Prepend content to a file.
   * @param relPath Path of the file.
   * @param content Content to prepend.
   */
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

  /**
   * Append content to a file.
   * @param relPath Path of the file.
   * @param content Content to append.
   */
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

  /**
   * Validate a temporary token for file access.
   * @param token The token to validate.
   * @param req Optional HTTP request for IP/device validation.
   * @returns The file path if valid, otherwise null.
   */
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
   * @param relPath Path to store the file at.
   * @param content File content as Buffer or string.
   * @param options Expiration and visibility options.
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
   * @returns Number of deleted files.
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
