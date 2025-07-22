import { JWT } from 'google-auth-library';
import { drive_v3, google } from 'googleapis';
import * as path from 'path';
import { PassThrough, Readable } from 'stream';
import { GoogleDriveDiskConfig, StorageDriver, FileMetadata } from '../lib/file-storage.interface';
import * as fs from 'fs';

/**
 * Storage driver for Google Drive operations using the googleapis SDK.
 * Implements file operations for Google Drive cloud storage.
 */
export class GoogleDriveStorageDriver implements StorageDriver {
  private drive: drive_v3.Drive;
  private folderId: string;
  private basePublicUrl: string;

  /**
   * Create a new GoogleDriveStorageDriver.
   * @param config Google Drive disk configuration.
   */
  constructor(private config: GoogleDriveDiskConfig) {
    const auth = new JWT({
      email: config.client_email,
      key: config.private_key,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    this.drive = google.drive({ version: 'v3', auth });
    this.folderId = config.folderId;
    this.basePublicUrl = config.basePublicUrl || '';
  }

  private async findFileId(filePath: string): Promise<string | null> {
    const name = path.basename(filePath);
    const q = `name = '${name}' and '${this.folderId}' in parents and trashed = false`;
    const res = await this.drive.files.list({ q, fields: 'files(id, name)' });
    const file = res.data.files?.find((f) => f.name === name);
    return file?.id || null;
  }

  /**
   * Store a file at the given path in Google Drive.
   * @param filePath Path to store the file at.
   * @param content File content as Buffer or string.
   */
  async put(filePath: string, content: Buffer | string): Promise<void> {
    const fileId = await this.findFileId(filePath);
    const media = {
      body: Buffer.isBuffer(content)
        ? Readable.from(content)
        : Readable.from([content]),
    };
    if (fileId) {
      await this.drive.files.update({
        fileId,
        media,
      });
    } else {
      await this.drive.files.create({
        requestBody: {
          name: path.basename(filePath),
          parents: [this.folderId],
        },
        media,
        fields: 'id',
      });
    }
  }

  /**
   * Retrieve a file as a Buffer from Google Drive.
   * @param filePath Path of the file to retrieve.
   * @returns File content as Buffer.
   */
  async get(filePath: string): Promise<Buffer> {
    const fileId = await this.findFileId(filePath);
    if (!fileId) throw new Error('File not found');
    const res = await this.drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' },
    );
    return Buffer.from(res.data as ArrayBuffer);
  }

  /**
   * Delete a file at the given path from Google Drive.
   * @param filePath Path of the file to delete.
   */
  async delete(filePath: string): Promise<void> {
    const fileId = await this.findFileId(filePath);
    if (fileId) await this.drive.files.delete({ fileId });
  }

  /**
   * Check if a file exists at the given path in Google Drive.
   * @param filePath Path to check.
   * @returns True if file exists, false otherwise.
   */
  async exists(filePath: string): Promise<boolean> {
    return !!(await this.findFileId(filePath));
  }

  /**
   * Copy a file from src to dest in Google Drive.
   * @param src Source path.
   * @param dest Destination path.
   */
  async copy(src: string, dest: string): Promise<void> {
    const fileId = await this.findFileId(src);
    if (!fileId) throw new Error('Source file not found');
    await this.drive.files.copy({
      fileId,
      requestBody: {
        name: path.basename(dest),
        parents: [this.folderId],
      },
    });
  }

  /**
   * Move a file from src to dest in Google Drive.
   * @param src Source path.
   * @param dest Destination path.
   */
  async move(src: string, dest: string): Promise<void> {
    const fileId = await this.findFileId(src);
    if (!fileId) throw new Error('Source file not found');
    await this.drive.files.update({
      fileId,
      addParents: this.folderId,
      removeParents: this.folderId,
      requestBody: { name: path.basename(dest) },
    });
  }

  /**
   * Create a directory at the given path in Google Drive.
   * @param dirPath Directory path.
   */
  async makeDirectory(dirPath: string): Promise<void> {
    await this.drive.files.create({
      requestBody: {
        name: path.basename(dirPath),
        mimeType: 'application/vnd.google-apps.folder',
        parents: [this.folderId],
      },
      fields: 'id',
    });
  }

  /**
   * Delete a directory at the given path in Google Drive.
   * @param dirPath Directory path.
   */
  async deleteDirectory(dirPath: string): Promise<void> {
    // Google Drive does not support recursive delete natively; you must list and delete contents
    // For simplicity, just delete the folder (will move to trash)
    const q = `name = '${path.basename(dirPath)}' and '${this.folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const res = await this.drive.files.list({ q, fields: 'files(id)' });
    for (const folder of res.data.files || []) {
      await this.drive.files.delete({ fileId: folder.id! });
    }
  }

  /**
   * Get metadata for a file in Google Drive.
   * @param filePath Path of the file.
   * @returns File metadata.
   */
  async getMetadata(filePath: string): Promise<FileMetadata> {
    const fileId = await this.findFileId(filePath);
    if (!fileId) throw new Error('File not found');
    const res = await this.drive.files.get({
      fileId,
      fields: 'id, name, size, modifiedTime',
    });
    return {
      path: filePath,
      size: res.data.size ? Number(res.data.size) : 0,
      lastModified: res.data.modifiedTime
        ? new Date(res.data.modifiedTime)
        : undefined,
      visibility: 'public',
    };
  }

  /**
   * List files in a directory in Google Drive.
   * @returns Array of file names.
   */
  async listFiles(): Promise<string[]> {
    const q = `'${this.folderId}' in parents and trashed = false`;
    const res = await this.drive.files.list({
      q,
      fields: 'files(id, name, mimeType)',
    });
    return (res.data.files || [])
      .filter((f) => f.mimeType !== 'application/vnd.google-apps.folder')
      .map((f) => f.name!);
  }

  /**
   * List directories in a directory in Google Drive.
   * @returns Array of directory names.
   */
  async listDirectories(): Promise<string[]> {
    const q = `'${this.folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const res = await this.drive.files.list({ q, fields: 'files(id, name)' });
    return (res.data.files || []).map((f) => f.name!);
  }

  /**
   * Create a readable stream for a file in Google Drive.
   * @param filePath Path of the file.
   * @returns Readable stream.
   */
  createReadStream(filePath: string): Readable {
    const pass = new PassThrough();
    this.get(filePath)
      .then((buf) => {
        pass.end(buf);
      })
      .catch((err) => pass.emit('error', err));
    return pass;
  }

  /**
   * Prepend content to a file in Google Drive.
   * @param filePath Path of the file.
   * @param content Content to prepend.
   */
  async prepend(filePath: string, content: Buffer | string): Promise<void> {
    let existing: Buffer = Buffer.from('');
    try {
      existing = await this.get(filePath);
    } catch {}
    const newContent = Buffer.isBuffer(content)
      ? Buffer.concat([content, existing])
      : Buffer.from(content + existing.toString());
    await this.put(filePath, newContent);
  }

  /**
   * Append content to a file in Google Drive.
   * @param filePath Path of the file.
   * @param content Content to append.
   */
  async append(filePath: string, content: Buffer | string): Promise<void> {
    let existing: Buffer = Buffer.from('');
    try {
      existing = await this.get(filePath);
    } catch {}
    const newContent = Buffer.isBuffer(content)
      ? Buffer.concat([existing, content])
      : Buffer.from(existing.toString() + content);
    await this.put(filePath, newContent);
  }

  /**
   * Get a public URL for a file, if supported.
   * @param filePath Path of the file.
   * @returns Public URL or file path.
   */
  async url(filePath: string): Promise<string> {
    if (this.basePublicUrl) {
      return `${this.basePublicUrl}/${filePath}`;
    }
    // Google Drive does not provide direct public URLs by default
    return filePath;
  }

  /**
   * Temporary URLs are not supported for Google Drive driver.
   * @param relPath File path.
   * @throws Error always.
   */
  async getTemporaryUrl(
    relPath: string,
    expiresIn?: number,
    options?: { ip?: string; deviceId?: string }
  ): Promise<string> {
    throw new Error('Temporary URLs are not supported for Google Drive driver');
  }

  /**
   * Store a file with expiration metadata in a central .gdrive-expirations.json file.
   * @param relPath Path to store the file at.
   * @param content File content as Buffer or string.
   * @param options Expiration and visibility options.
   */
  async putTimed(
    relPath: string,
    content: Buffer | string,
    options: { expiresAt?: Date; ttl?: number; visibility?: 'public' | 'private' }
  ): Promise<void> {
    await this.put(relPath, content);
    const expiresAt = options.expiresAt
      ? options.expiresAt.getTime()
      : options.ttl
      ? Date.now() + options.ttl * 1000
      : undefined;
    if (expiresAt) {
      const metaPath = path.join(this.config.basePublicUrl || '', '.gdrive-expirations.json');
      let meta: Record<string, number> = {};
      try {
        meta = JSON.parse(await fs.promises.readFile(metaPath, 'utf-8'));
      } catch {}
      meta[relPath] = expiresAt;
      await fs.promises.writeFile(metaPath, JSON.stringify(meta));
    }
  }

  /**
   * Delete all expired files (based on .gdrive-expirations.json). Returns number of deleted files.
   * @returns Number of deleted files.
   */
  async deleteExpiredFiles(): Promise<number> {
    const metaPath = path.join(this.config.basePublicUrl || '', '.gdrive-expirations.json');
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
   * Store a file stream at the given path in Google Drive.
   * @param filePath Path to store the file at.
   * @param stream Readable stream of file content.
   * @param options Optional visibility settings.
   */
  async putStream(
    filePath: string,
    stream: Readable,
    _options?: { visibility?: 'public' | 'private' },
  ): Promise<void> {
    const fileId = await this.findFileId(filePath);
    const media = { body: stream };
    if (fileId) {
      await this.drive.files.update({ fileId, media });
    } else {
      await this.drive.files.create({
        requestBody: {
          name: path.basename(filePath),
          parents: [this.folderId],
        },
        media,
        fields: 'id',
      });
    }
  }
}
