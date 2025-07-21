import { Client } from 'basic-ftp';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PassThrough, Readable } from 'stream';
import {
  FileMetadata,
  StorageDiskConfig,
  StorageDriver,
} from '../lib/file-storage.interface';

export class FTPStorageDriver implements StorageDriver {
  private basePublicUrl: string;

  constructor(private config: StorageDiskConfig) {
    this.basePublicUrl = config.basePublicUrl || '';
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
      });
      return await fn(client);
    } finally {
      client.close();
    }
  }

  private async getTempFilePath(): Promise<string> {
    return path.join(
      os.tmpdir(),
      `ftp-tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
  }

  async put(
    relPath: string,
    content: Buffer | string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options?: { visibility?: 'public' | 'private' },
  ): Promise<void> {
    const tempFile = await this.getTempFilePath();
    await fs.promises.writeFile(tempFile, content);
    try {
      await this.withClient(async (client) => {
        await client.uploadFrom(tempFile, relPath);
      });
    } finally {
      await fs.promises.unlink(tempFile).catch(() => {});
    }
  }

  async get(relPath: string): Promise<Buffer> {
    const tempFile = await this.getTempFilePath();
    try {
      await this.withClient(async (client) => {
        await client.downloadTo(tempFile, relPath);
      });
      return await fs.promises.readFile(tempFile);
    } finally {
      await fs.promises.unlink(tempFile).catch(() => {});
    }
  }

  async delete(relPath: string): Promise<void> {
    await this.withClient((client) => client.remove(relPath));
  }

  async exists(relPath: string): Promise<boolean> {
    return this.withClient(async (client) => {
      try {
        const list = await client.list(path.dirname(relPath));
        return list.some((f) => f.name === path.basename(relPath));
      } catch {
        return false;
      }
    });
  }

  async copy(src: string, dest: string): Promise<void> {
    const data = await this.get(src);
    await this.put(dest, data);
  }

  async move(src: string, dest: string): Promise<void> {
    await this.withClient((client) => client.rename(src, dest));
  }

  async makeDirectory(relPath: string): Promise<void> {
    await this.withClient((client) => client.ensureDir(relPath));
  }

  async deleteDirectory(relPath: string): Promise<void> {
    await this.withClient((client) => client.removeDir(relPath));
  }

  async getMetadata(relPath: string): Promise<FileMetadata> {
    return this.withClient(async (client) => {
      const list = await client.list(path.dirname(relPath));
      const file = list.find((f) => f.name === path.basename(relPath));
      if (!file) throw new Error('File not found');
      return {
        path: relPath,
        size: file.size,
        lastModified: file.modifiedAt,
        visibility: 'public',
      };
    });
  }

  async listFiles(dir = '', recursive = true): Promise<string[]> {
    return this.withClient(async (client) => {
      const results: string[] = [];
      async function walk(current: string) {
        const list = await client.list(current);
        for (const entry of list) {
          const entryPath = path.posix.join(current, entry.name);
          if (entry.isDirectory) {
            if (recursive) await walk(entryPath);
          } else {
            results.push(entryPath);
          }
        }
      }
      await walk(dir);
      return results;
    });
  }

  async listDirectories(dir = '', recursive = true): Promise<string[]> {
    return this.withClient(async (client) => {
      const results: string[] = [];
      async function walk(current: string) {
        const list = await client.list(current);
        for (const entry of list) {
          if (entry.isDirectory) {
            const entryPath = path.posix.join(current, entry.name);
            results.push(entryPath);
            if (recursive) await walk(entryPath);
          }
        }
      }
      await walk(dir);
      return results;
    });
  }

  createReadStream(relPath: string): Readable {
    const pass = new PassThrough();
    this.withClient(async (client) => {
      await client.downloadTo(pass, relPath);
    }).catch((err) => pass.emit('error', err));
    return pass;
  }

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

  async url(relPath: string): Promise<string> {
    if (this.basePublicUrl) {
      return `${this.basePublicUrl}/${relPath}`;
    }
    return relPath;
  }
}
