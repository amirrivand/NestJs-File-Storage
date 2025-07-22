import { Dropbox } from 'dropbox';
import fetch from 'node-fetch';
import { DropboxDiskConfig, StorageDriver, FileMetadata } from '../lib/file-storage.interface';
import { Readable, PassThrough } from 'stream';
import * as path from 'path';
import * as fs from 'fs';

function isFileMeta(meta: any): meta is { size: number; server_modified?: string } {
  return meta['.tag'] === 'file';
}

/**
 * Storage driver for Dropbox operations using the Dropbox SDK.
 * Implements file operations for Dropbox cloud storage.
 */
export class DropboxStorageDriver implements StorageDriver {
  private dbx: Dropbox;
  private basePublicUrl: string;

  /**
   * Create a new DropboxStorageDriver.
   * @param config Dropbox disk configuration.
   */
  constructor(private config: DropboxDiskConfig) {
    this.dbx = new Dropbox({ accessToken: config.accessToken, fetch });
    this.basePublicUrl = config.basePublicUrl || '';
  }

  /**
   * Store a file at the given path in Dropbox.
   * @param path Path to store the file at.
   * @param content File content as Buffer or string.
   */
  async put(path: string, content: Buffer | string): Promise<void> {
    await this.dbx.filesUpload({
      path: '/' + path,
      contents: content,
      mode: { '.tag': 'overwrite' },
    });
  }

  /**
   * Retrieve a file as a Buffer from Dropbox.
   * @param path Path of the file to retrieve.
   * @returns File content as Buffer.
   */
  async get(path: string): Promise<Buffer> {
    const res = await this.dbx.filesDownload({ path: '/' + path });
    // Dropbox SDK returns fileBinary on result for filesDownload
    // @ts-expect-error Dropbox SDK type is incomplete
    return Buffer.from(res.result.fileBinary);
  }

  /**
   * Delete a file at the given path from Dropbox.
   * @param path Path of the file to delete.
   */
  async delete(path: string): Promise<void> {
    await this.dbx.filesDeleteV2({ path: '/' + path });
  }

  /**
   * Check if a file exists at the given path in Dropbox.
   * @param path Path to check.
   * @returns True if file exists, false otherwise.
   */
  async exists(path: string): Promise<boolean> {
    try {
      await this.dbx.filesGetMetadata({ path: '/' + path });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Copy a file from src to dest in Dropbox.
   * @param src Source path.
   * @param dest Destination path.
   */
  async copy(src: string, dest: string): Promise<void> {
    await this.dbx.filesCopyV2({
      from_path: '/' + src,
      to_path: '/' + dest,
      allow_shared_folder: true,
      autorename: false,
      allow_ownership_transfer: false,
    });
  }

  /**
   * Move a file from src to dest in Dropbox.
   * @param src Source path.
   * @param dest Destination path.
   */
  async move(src: string, dest: string): Promise<void> {
    await this.dbx.filesMoveV2({
      from_path: '/' + src,
      to_path: '/' + dest,
      allow_shared_folder: true,
      autorename: false,
      allow_ownership_transfer: false,
    });
  }

  /**
   * Create a directory at the given path in Dropbox.
   * @param path Directory path.
   */
  async makeDirectory(path: string): Promise<void> {
    await this.dbx.filesCreateFolderV2({ path: '/' + path });
  }

  /**
   * Delete a directory at the given path in Dropbox.
   * @param path Directory path.
   */
  async deleteDirectory(path: string): Promise<void> {
    await this.dbx.filesDeleteV2({ path: '/' + path });
  }

  /**
   * Get metadata for a file in Dropbox.
   * @param path Path of the file.
   * @returns File metadata.
   */
  async getMetadata(path: string): Promise<FileMetadata> {
    const meta = (await this.dbx.filesGetMetadata({ path: '/' + path })).result;
    return {
      path,
      size: isFileMeta(meta) ? meta.size : 0,
      lastModified:
        isFileMeta(meta) && meta.server_modified ? new Date(meta.server_modified) : undefined,
      visibility: 'public',
    };
  }

  /**
   * List files in a directory in Dropbox, optionally recursively.
   * @param dir Directory path.
   * @param recursive Whether to list recursively.
   * @returns Array of file paths.
   */
  async listFiles(dir = '', recursive = true): Promise<string[]> {
    const res = await this.dbx.filesListFolder({ path: '/' + dir, recursive });
    return res.result.entries
      .filter((e) => e['.tag'] === 'file')
      .map((e) => e.path_display?.replace(/^\//, '') || '');
  }

  /**
   * List directories in a directory in Dropbox, optionally recursively.
   * @param dir Directory path.
   * @param recursive Whether to list recursively.
   * @returns Array of directory paths.
   */
  async listDirectories(dir = '', recursive = true): Promise<string[]> {
    const res = await this.dbx.filesListFolder({ path: '/' + dir, recursive });
    return res.result.entries
      .filter((e) => e['.tag'] === 'folder')
      .map((e) => e.path_display?.replace(/^\//, '') || '');
  }

  /**
   * Create a readable stream for a file in Dropbox.
   * @param path Path of the file.
   * @returns Readable stream.
   */
  createReadStream(path: string): Readable {
    const pass = new PassThrough();
    this.get(path)
      .then((buf) => {
        pass.end(buf);
      })
      .catch((err) => pass.emit('error', err));
    return pass;
  }

  /**
   * Prepend content to a file in Dropbox.
   * @param path Path of the file.
   * @param content Content to prepend.
   */
  async prepend(path: string, content: Buffer | string): Promise<void> {
    let existing: Buffer = Buffer.from('');
    try {
      existing = await this.get(path);
    } catch {}
    const newContent = Buffer.isBuffer(content)
      ? Buffer.concat([content, existing])
      : Buffer.from(content + existing.toString());
    await this.put(path, newContent);
  }

  /**
   * Append content to a file in Dropbox.
   * @param path Path of the file.
   * @param content Content to append.
   */
  async append(path: string, content: Buffer | string): Promise<void> {
    let existing: Buffer = Buffer.from('');
    try {
      existing = await this.get(path);
    } catch {}
    const newContent = Buffer.isBuffer(content)
      ? Buffer.concat([existing, content])
      : Buffer.from(existing.toString() + content);
    await this.put(path, newContent);
  }

  /**
   * Get a public URL for a file, if supported.
   * @param path Path of the file.
   * @returns Public URL or file path.
   */
  async url(path: string): Promise<string> {
    if (this.basePublicUrl) {
      return `${this.basePublicUrl}/${path}`;
    }
    // Dropbox does not provide direct public URLs by default
    // You may want to use shared links or basePublicUrl
    return path;
  }

  /**
   * Temporary URLs are not supported for Dropbox driver.
   * @param relPath File path.
   * @throws Error always.
   */
  async getTemporaryUrl(
    relPath: string,
    expiresIn?: number,
    options?: { ip?: string; deviceId?: string },
  ): Promise<string> {
    throw new Error('Temporary URLs are not supported for Dropbox driver');
  }

  /**
   * Store a file with expiration metadata in a central .dropbox-expirations.json file.
   * @param relPath Path to store the file at.
   * @param content File content as Buffer or string.
   * @param options Expiration and visibility options.
   */
  async putTimed(
    relPath: string,
    content: Buffer | string,
    options: { expiresAt?: Date; ttl?: number; visibility?: 'public' | 'private' },
  ): Promise<void> {
    await this.put(relPath, content);
    const expiresAt = options.expiresAt
      ? options.expiresAt.getTime()
      : options.ttl
        ? Date.now() + options.ttl * 1000
        : undefined;
    if (expiresAt) {
      const metaPath = path.join(this.config.basePublicUrl || '', '.dropbox-expirations.json');
      let meta: Record<string, number> = {};
      try {
        meta = JSON.parse(await fs.promises.readFile(metaPath, 'utf-8'));
      } catch {}
      meta[relPath] = expiresAt;
      await fs.promises.writeFile(metaPath, JSON.stringify(meta));
    }
  }

  /**
   * Delete all expired files (based on .dropbox-expirations.json). Returns number of deleted files.
   * @returns Number of deleted files.
   */
  async deleteExpiredFiles(): Promise<number> {
    const metaPath = path.join(this.config.basePublicUrl || '', '.dropbox-expirations.json');
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
   * Store a file stream at the given path in Dropbox.
   * @param path Path to store the file at.
   * @param stream Readable stream of file content.
   * @param options Optional visibility settings.
   */
  async putStream(
    path: string,
    stream: Readable,
    _options?: { visibility?: 'public' | 'private' },
  ): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    await this.put(path, Buffer.concat(chunks));
  }
}
