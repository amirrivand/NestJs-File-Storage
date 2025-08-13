import { Client } from 'basic-ftp';
import * as fs from 'fs';
import * as path from 'path';
import { PassThrough, Readable } from 'stream';
import { FileMetadata, FTPDiskConfig, StorageDriver } from '../lib/file-storage.interface';

/**
 * Storage driver for FTP operations using the basic-ftp library.
 * Implements file operations for FTP servers.
 */
export class FTPStorageDriver implements StorageDriver {
  private basePublicUrl: string;

  /**
   * Create a new FTPStorageDriver.
   * @param config FTP disk configuration.
   */
  constructor(private config: FTPDiskConfig) {
    this.basePublicUrl = config.basePublicUrl || '';
  }

  private normalizeRemotePath(relPath: string): string {
    // Convert to POSIX and ensure it's relative (no leading slash) since we cd into root
    const posixPath = path.posix.normalize(relPath).replace(/^\/+/, '');
    return posixPath;
  }

  private toReadable(content: Buffer | string): Readable {
    const stream = new PassThrough();
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    stream.end(buffer);
    return stream;
  }

  private async withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
    const client = new Client();
    try {
      await client.access({
        host: this.config.host,
        user: this.config.user,
        password: this.config.password,
        port: this.config.port,
        secure: this.config.secure,
        secureOptions: { rejectUnauthorized: false },
      });
      if (this.config.root) {
        // Ensure and change into configured root so all operations are relative to it
        await client.ensureDir(this.config.root);
        await client.cd(this.config.root);
      }
      return await fn(client);
    } finally {
      client.close();
    }
  }

  /**
   * Store a file at the given path on the FTP server.
   * @param relPath Path to store the file at.
   * @param content File content as Buffer or string.
   * @param _options Optional visibility settings (not used).
   */
  async put(
    relPath: string,
    content: Buffer | string,
    _options?: { visibility?: 'public' | 'private' },
  ): Promise<void> {
    const putCommand = async (client: Client) => {
      const remotePath = this.normalizeRemotePath(relPath);
      const remoteDir = path.posix.dirname(remotePath);
      if (remoteDir && remoteDir !== '.' && remoteDir !== '/') {
        await client.ensureDir(remoteDir);
      }
      const stream = this.toReadable(content);
      const fileName = path.posix.basename(remotePath);
      await client.uploadFrom(stream, fileName);
    };
    await this.withClient(putCommand);
  }

  /**
   * Retrieve a file as a Buffer from the FTP server.
   * @param relPath Path of the file to retrieve.
   * @returns File content as Buffer.
   */
  async get(relPath: string): Promise<Buffer> {
    const getCommand = async (client: Client) => {
      const remotePath = this.normalizeRemotePath(relPath);
      const pass = new PassThrough();
      await client.downloadTo(pass, remotePath);

      // Collect the stream into a Buffer
      const chunks: Buffer[] = [];
      return await new Promise<Buffer>((resolve, reject) => {
        pass.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        pass.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
        pass.on('error', (err) => {
          reject(err);
        });
      });
    };

    return this.withClient(getCommand);
  }

  /**
   * Delete a file at the given path from the FTP server.
   * @param relPath Path of the file to delete.
   */
  async delete(relPath: string): Promise<void> {
    const remotePath = this.normalizeRemotePath(relPath);
    const deleteCommand = async (client: Client) => {
      await client.remove(remotePath);
    };
    await this.withClient(deleteCommand);
  }

  /**
   * Check if a file exists at the given path on the FTP server.
   * @param relPath Path to check.
   * @returns True if file exists, false otherwise.
   */
  async exists(relPath: string): Promise<boolean> {
    const existsCommand = async (client: Client) => {
      const remotePath = this.normalizeRemotePath(relPath);
      try {
        const list = await client.list(path.posix.dirname(remotePath));
        return list.some((f) => f.name === path.posix.basename(remotePath));
      } catch {
        return false;
      }
    };

    return this.withClient(existsCommand);
  }

  /**
   * Copy a file from src to dest on the FTP server.
   * @param src Source path.
   * @param dest Destination path.
   */
  async copy(src: string, dest: string): Promise<void> {
    const data = await this.get(src);
    await this.put(dest, data);
  }

  /**
   * Move a file from src to dest on the FTP server.
   * @param src Source path.
   * @param dest Destination path.
   */
  async move(src: string, dest: string): Promise<void> {
    const moveCommand = async (client: Client) => {
      const srcPath = this.normalizeRemotePath(src);
      const destPath = this.normalizeRemotePath(dest);
      const destDir = path.posix.dirname(destPath);
      if (destDir && destDir !== '.' && destDir !== '/') {
        const originalCwd = await client.pwd();
        await client.ensureDir(destDir);
        // Ensure subsequent rename uses paths relative to original root cwd
        await client.cd(originalCwd);
      }
      await client.rename(srcPath, destPath);
    };
    await this.withClient(moveCommand);
  }

  /**
   * Create a directory at the given path on the FTP server.
   * @param relPath Directory path.
   */
  async makeDirectory(relPath: string): Promise<void> {
    const remotePath = this.normalizeRemotePath(relPath);
    const makeDirectoryCommand = (client: Client) => client.ensureDir(remotePath);
    await this.withClient(makeDirectoryCommand);
  }

  /**
   * Delete a directory at the given path on the FTP server.
   * @param relPath Directory path.
   */
  async deleteDirectory(relPath: string): Promise<void> {
    const remotePath = this.normalizeRemotePath(relPath);
    const deleteDirectoryCommand = (client: Client) => client.removeDir(remotePath);
    await this.withClient(deleteDirectoryCommand);
  }

  /**
   * Get metadata for a file on the FTP server.
   * @param relPath Path of the file.
   * @returns File metadata.
   */
  async getMetadata(relPath: string): Promise<FileMetadata> {
    const getMetadataCommand = async (client: Client) => {
      const remotePath = this.normalizeRemotePath(relPath);
      const list = await client.list(path.posix.dirname(remotePath));
      const file = list.find((f) => f.name === path.posix.basename(remotePath));
      if (!file) throw new Error('File not found');
      return {
        path: remotePath,
        size: file.size,
        lastModified: file.modifiedAt,
        visibility: 'public',
      } satisfies FileMetadata;
    };
    return this.withClient(getMetadataCommand);
  }

  /**
   * List files in a directory on the FTP server, optionally recursively.
   * @param dir Directory path.
   * @param recursive Whether to list recursively.
   * @returns Array of file paths.
   */
  async listFiles(dir = '', recursive = true): Promise<string[]> {
    const listFilesCommand = async (client: Client) => {
      const results: string[] = [];
      async function walk(current: string) {
        const list = await client.list(current || '.');
        for (const entry of list) {
          const entryPath = path.posix.join(current || '.', entry.name);
          if (entry.isDirectory) {
            if (recursive) await walk(entryPath);
          } else {
            results.push(entryPath);
          }
        }
      }
      await walk(this.normalizeRemotePath(dir));
      return results;
    };
    return this.withClient(listFilesCommand);
  }

  /**
   * List directories in a directory on the FTP server, optionally recursively.
   * @param dir Directory path.
   * @param recursive Whether to list recursively.
   * @returns Array of directory paths.
   */
  async listDirectories(dir = '', recursive = true): Promise<string[]> {
    const listDirectoriesCommand = async (client: Client) => {
      const results: string[] = [];
      async function walk(current: string) {
        const list = await client.list(current || '.');
        for (const entry of list) {
          if (entry.isDirectory) {
            const entryPath = path.posix.join(current || '.', entry.name);
            results.push(entryPath);
            if (recursive) await walk(entryPath);
          }
        }
      }
      await walk(this.normalizeRemotePath(dir));
      return results;
    };
    return this.withClient(listDirectoriesCommand);
  }

  /**
   * Create a readable stream for a file on the FTP server.
   * @param relPath Path of the file.
   * @returns Readable stream.
   */
  createReadStream(relPath: string): Readable {
    const pass = new PassThrough();
    const createReadStreamCommand = async (client: Client) => {
      const remotePath = this.normalizeRemotePath(relPath);
      await client.downloadTo(pass, remotePath);
    };
    this.withClient(createReadStreamCommand).catch((err) => pass.emit('error', err));
    return pass;
  }

  /**
   * Prepend content to a file on the FTP server.
   * @param relPath Path of the file.
   * @param content Content to prepend.
   */
  async prepend(relPath: string, content: Buffer | string): Promise<void> {
    let existing: Buffer = Buffer.from('');
    try {
      existing = await this.get(relPath);
    } catch {}
    const newContent = Buffer.isBuffer(content)
      ? Buffer.concat([content, existing])
      : Buffer.from(content + existing.toString());
    await this.put(relPath, newContent);
  }

  /**
   * Append content to a file on the FTP server.
   * @param relPath Path of the file.
   * @param content Content to append.
   */
  async append(relPath: string, content: Buffer | string): Promise<void> {
    let existing: Buffer = Buffer.from('');
    try {
      existing = await this.get(relPath);
    } catch {}
    const newContent = Buffer.isBuffer(content)
      ? Buffer.concat([existing, content])
      : Buffer.from(existing.toString() + content);
    await this.put(relPath, newContent);
  }

  /**
   * Get a public URL for a file, if supported.
   * @param relPath Path of the file.
   * @returns Public URL or file path.
   */
  async url(relPath: string): Promise<string> {
    if (this.basePublicUrl) {
      const remotePath = this.normalizeRemotePath(relPath);
      return `${this.basePublicUrl}/${remotePath}`;
    }
    return relPath;
  }

  /**
   * Temporary URLs are not supported for FTP driver.
   * @param relPath File path.
   * @throws Error always.
   */
  async getTemporaryUrl(
    relPath: string,
    expiresIn?: number,
    options?: { ip?: string; deviceId?: string },
  ): Promise<string> {
    throw new Error('Temporary URLs are not supported for FTP driver');
  }

  /**
   * Store a file with expiration metadata in a central .ftp-expirations.json file.
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
      const metaPath = path.join(this.config.root, '.ftp-expirations.json');
      let meta: Record<string, number> = {};
      try {
        meta = JSON.parse(await fs.promises.readFile(metaPath, 'utf-8'));
      } catch {}
      meta[relPath] = expiresAt;
      await fs.promises.writeFile(metaPath, JSON.stringify(meta));
    }
  }

  /**
   * Delete all expired files (based on .ftp-expirations.json). Returns number of deleted files.
   * @returns Number of deleted files.
   */
  async deleteExpiredFiles(): Promise<number> {
    const metaPath = path.join(this.config.root, '.ftp-expirations.json');
    let meta: Record<string, number> = {};
    try {
      meta = JSON.parse(await fs.promises.readFile(metaPath, 'utf-8'));
    } catch {}
    let deleted = 0;
    const now = Date.now();
    for (const [file, expiresAt] of Object.entries(meta)) {
      if (now > expiresAt) {
        try {
          await this.delete(file);
          deleted++;
          delete meta[file];
        } catch {}
      }
    }
    await fs.promises.writeFile(metaPath, JSON.stringify(meta));
    return deleted;
  }

  /**
   * Store a file stream at the given path on the FTP server.
   * @param relPath Path to store the file at.
   * @param stream Readable stream of file content.
   * @param options Optional visibility settings.
   */
  async putStream(
    relPath: string,
    stream: Readable,
    _options?: { visibility?: 'public' | 'private' },
  ): Promise<void> {
    await this.withClient(async (client) => {
      const remotePath = this.normalizeRemotePath(relPath);
      const remoteDir = path.posix.dirname(remotePath);
      if (remoteDir && remoteDir !== '.' && remoteDir !== '/') {
        await client.ensureDir(remoteDir);
      }
      const fileName = path.posix.basename(remotePath);
      await client.uploadFrom(stream, fileName);
    });
  }
}
