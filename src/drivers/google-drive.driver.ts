import { JWT } from 'google-auth-library';
import { drive_v3, google } from 'googleapis';
import * as path from 'path';
import { PassThrough, Readable } from 'stream';
import { GoogleDriveDiskConfig, StorageDriver, FileMetadata } from '../lib/file-storage.interface';

export class GoogleDriveStorageDriver implements StorageDriver {
  private drive: drive_v3.Drive;
  private folderId: string;
  private basePublicUrl: string;

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

  async get(filePath: string): Promise<Buffer> {
    const fileId = await this.findFileId(filePath);
    if (!fileId) throw new Error('File not found');
    const res = await this.drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' },
    );
    return Buffer.from(res.data as ArrayBuffer);
  }

  async delete(filePath: string): Promise<void> {
    const fileId = await this.findFileId(filePath);
    if (fileId) await this.drive.files.delete({ fileId });
  }

  async exists(filePath: string): Promise<boolean> {
    return !!(await this.findFileId(filePath));
  }

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

  async deleteDirectory(dirPath: string): Promise<void> {
    // Google Drive does not support recursive delete natively; you must list and delete contents
    // For simplicity, just delete the folder (will move to trash)
    const q = `name = '${path.basename(dirPath)}' and '${this.folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const res = await this.drive.files.list({ q, fields: 'files(id)' });
    for (const folder of res.data.files || []) {
      await this.drive.files.delete({ fileId: folder.id! });
    }
  }

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

  async listDirectories(): Promise<string[]> {
    const q = `'${this.folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const res = await this.drive.files.list({ q, fields: 'files(id, name)' });
    return (res.data.files || []).map((f) => f.name!);
  }

  createReadStream(filePath: string): Readable {
    const pass = new PassThrough();
    this.get(filePath)
      .then((buf) => {
        pass.end(buf);
      })
      .catch((err) => pass.emit('error', err));
    return pass;
  }

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

  async url(filePath: string): Promise<string> {
    if (this.basePublicUrl) {
      return `${this.basePublicUrl}/${filePath}`;
    }
    // Google Drive does not provide direct public URLs by default
    return filePath;
  }

  /**
   * Temporary URLs are not supported for Google Drive driver.
   */
  async getTemporaryUrl(
    relPath: string,
    expiresIn?: number,
    options?: { ip?: string; deviceId?: string }
  ): Promise<string> {
    throw new Error('Temporary URLs are not supported for Google Drive driver');
  }
}
