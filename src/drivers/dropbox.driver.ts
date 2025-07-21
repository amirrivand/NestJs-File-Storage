import { Dropbox } from 'dropbox';
import fetch from 'node-fetch';
import { DropboxDiskConfig, StorageDriver, FileMetadata } from '../lib/file-storage.interface';
import { Readable, PassThrough } from 'stream';
import * as path from 'path';
import * as fs from 'fs';

function isFileMeta(meta: any): meta is { size: number; server_modified?: string } {
  return meta['.tag'] === 'file';
}

export class DropboxStorageDriver implements StorageDriver {
  private dbx: Dropbox;
  private basePublicUrl: string;

  constructor(private config: DropboxDiskConfig) {
    this.dbx = new Dropbox({ accessToken: config.accessToken, fetch });
    this.basePublicUrl = config.basePublicUrl || '';
  }

  async put(path: string, content: Buffer | string): Promise<void> {
    await this.dbx.filesUpload({
      path: '/' + path,
      contents: content,
      mode: { '.tag': 'overwrite' },
    });
  }

  async get(path: string): Promise<Buffer> {
    const res = await this.dbx.filesDownload({ path: '/' + path });
    // Dropbox SDK returns fileBinary on result for filesDownload
    // @ts-expect-error Dropbox SDK type is incomplete
    return Buffer.from(res.result.fileBinary);
  }

  async delete(path: string): Promise<void> {
    await this.dbx.filesDeleteV2({ path: '/' + path });
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.dbx.filesGetMetadata({ path: '/' + path });
      return true;
    } catch {
      return false;
    }
  }

  async copy(src: string, dest: string): Promise<void> {
    await this.dbx.filesCopyV2({
      from_path: '/' + src,
      to_path: '/' + dest,
      allow_shared_folder: true,
      autorename: false,
      allow_ownership_transfer: false,
    });
  }

  async move(src: string, dest: string): Promise<void> {
    await this.dbx.filesMoveV2({
      from_path: '/' + src,
      to_path: '/' + dest,
      allow_shared_folder: true,
      autorename: false,
      allow_ownership_transfer: false,
    });
  }

  async makeDirectory(path: string): Promise<void> {
    await this.dbx.filesCreateFolderV2({ path: '/' + path });
  }

  async deleteDirectory(path: string): Promise<void> {
    await this.dbx.filesDeleteV2({ path: '/' + path });
  }

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

  async listFiles(dir = '', recursive = true): Promise<string[]> {
    const res = await this.dbx.filesListFolder({ path: '/' + dir, recursive });
    return res.result.entries
      .filter((e) => e['.tag'] === 'file')
      .map((e) => e.path_display?.replace(/^\//, '') || '');
  }

  async listDirectories(dir = '', recursive = true): Promise<string[]> {
    const res = await this.dbx.filesListFolder({ path: '/' + dir, recursive });
    return res.result.entries
      .filter((e) => e['.tag'] === 'folder')
      .map((e) => e.path_display?.replace(/^\//, '') || '');
  }

  createReadStream(path: string): Readable {
    const pass = new PassThrough();
    this.get(path)
      .then((buf) => {
        pass.end(buf);
      })
      .catch((err) => pass.emit('error', err));
    return pass;
  }

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
}
