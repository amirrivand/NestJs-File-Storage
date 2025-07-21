import SftpClient from 'ssh2-sftp-client';
import { StorageDriver, FileMetadata, StorageDiskConfig } from '../lib/file-storage.interface';
import { Readable, PassThrough } from 'stream';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export class SFTPStorageDriver implements StorageDriver {
  private basePublicUrl: string;

  constructor(private config: StorageDiskConfig) {
    this.basePublicUrl = config.basePublicUrl || '';
  }

  private async withClient<T>(fn: (client: SftpClient) => Promise<T>): Promise<T> {
    const client = new SftpClient();
    try {
      await client.connect({
        host: this.config.host,
        port: this.config.port,
        username: this.config.username,
        password: this.config.password,
        privateKey: this.config.privateKey,
        passphrase: this.config.passphrase,
      });
      return await fn(client);
    } finally {
      client.end();
    }
  }

  private async getTempFilePath(): Promise<string> {
    return path.join(os.tmpdir(), `sftp-tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  }

  async put(
    relPath: string,
    content: Buffer | string,
    _options?: { visibility?: 'public' | 'private' },
  ): Promise<void> {
    const tempFile = await this.getTempFilePath();
    await fs.promises.writeFile(tempFile, content);
    try {
      await this.withClient(async (client) => {
        await client.fastPut(tempFile, relPath);
      });
    } finally {
      await fs.promises.unlink(tempFile).catch(() => {});
    }
  }

  async get(relPath: string): Promise<Buffer> {
    const tempFile = await this.getTempFilePath();
    try {
      await this.withClient(async (client) => {
        await client.fastGet(relPath, tempFile);
      });
      return await fs.promises.readFile(tempFile);
    } finally {
      await fs.promises.unlink(tempFile).catch(() => {});
    }
  }

  async delete(relPath: string): Promise<void> {
    await this.withClient((client) => client.delete(relPath));
  }

  async exists(relPath: string): Promise<boolean> {
    return this.withClient(async (client) => {
      try {
        await client.stat(relPath);
        return true;
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
    await this.withClient((client) => client.mkdir(relPath, true));
  }

  async deleteDirectory(relPath: string): Promise<void> {
    await this.withClient((client) => client.rmdir(relPath, true));
  }

  async getMetadata(relPath: string): Promise<FileMetadata> {
    return this.withClient(async (client) => {
      const stat = await client.stat(relPath);
      return {
        path: relPath,
        size: stat.size,
        lastModified: stat.modifyTime ? new Date(stat.modifyTime) : undefined,
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
          if (entry.type === 'd') {
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
          if (entry.type === 'd') {
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
      const sftpStream = await client.get(relPath);
      if (sftpStream instanceof Buffer) {
        pass.end(sftpStream);
      } else if (sftpStream && typeof (sftpStream as any).pipe === 'function') {
        (sftpStream as unknown as NodeJS.ReadableStream).pipe(pass);
      } else {
        pass.emit('error', new Error('Invalid stream type from SFTP get'));
      }
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
