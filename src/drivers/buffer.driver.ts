import { StorageDriver, FileMetadata } from '../lib/file-storage.interface';
import { Readable } from 'stream';

interface BufferFile {
  content: Buffer;
  metadata: FileMetadata;
}

export interface BufferDiskConfig {
  driver: 'buffer';
}

export class BufferStorageDriver implements StorageDriver {
  private files: Map<string, BufferFile> = new Map();

  constructor(private config: BufferDiskConfig) {}

  async put(path: string, content: Buffer | string, options?: { visibility?: 'public' | 'private' }): Promise<void> {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    this.files.set(path, {
      content: buffer,
      metadata: {
        path,
        size: buffer.length,
        mimeType: undefined,
        lastModified: new Date(),
        visibility: options?.visibility || 'private',
      },
    });
  }

  async get(path: string): Promise<Buffer> {
    const file = this.files.get(path);
    if (!file) throw new Error(`File not found: ${path}`);
    return file.content;
  }

  async delete(path: string): Promise<void> {
    this.files.delete(path);
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  async copy(src: string, dest: string): Promise<void> {
    const file = this.files.get(src);
    if (!file) throw new Error(`File not found: ${src}`);
    this.files.set(dest, {
      content: Buffer.from(file.content),
      metadata: { ...file.metadata, path: dest, lastModified: new Date() },
    });
  }

  async move(src: string, dest: string): Promise<void> {
    await this.copy(src, dest);
    await this.delete(src);
  }

  createReadStream(path: string): Readable {
    const file = this.files.get(path);
    if (!file) throw new Error(`File not found: ${path}`);
    const stream = new Readable();
    stream.push(file.content);
    stream.push(null);
    return stream;
  }

  async prepend(path: string, content: Buffer | string): Promise<void> {
    const file = this.files.get(path);
    const prependBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    if (file) {
      const newContent = Buffer.concat([prependBuffer, file.content]);
      file.content = newContent;
      file.metadata.size = newContent.length;
      file.metadata.lastModified = new Date();
    } else {
      this.files.set(path, {
        content: prependBuffer,
        metadata: {
          path,
          size: prependBuffer.length,
          lastModified: new Date(),
          visibility: 'private',
        },
      });
    }
  }

  async append(path: string, content: Buffer | string): Promise<void> {
    const file = this.files.get(path);
    const appendBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    if (file) {
      const newContent = Buffer.concat([file.content, appendBuffer]);
      file.content = newContent;
      file.metadata.size = newContent.length;
      file.metadata.lastModified = new Date();
    } else {
      this.files.set(path, {
        content: appendBuffer,
        metadata: {
          path,
          size: appendBuffer.length,
          lastModified: new Date(),
          visibility: 'private',
        },
      });
    }
  }

  async listFiles(dir = '', recursive = true): Promise<string[]> {
    // Only flat structure for buffer driver
    return Array.from(this.files.keys()).filter((key) => key.startsWith(dir));
  }

  async listDirectories(dir = '', recursive = true): Promise<string[]> {
    // Not applicable for buffer driver, return empty
    return [];
  }

  async getMetadata(path: string): Promise<FileMetadata> {
    const file = this.files.get(path);
    if (!file) throw new Error(`File not found: ${path}`);
    return file.metadata;
  }

  async setVisibility(path: string, visibility: 'public' | 'private'): Promise<void> {
    const file = this.files.get(path);
    if (!file) throw new Error(`File not found: ${path}`);
    file.metadata.visibility = visibility;
  }

  async getVisibility(path: string): Promise<'public' | 'private' | undefined> {
    const file = this.files.get(path);
    return file?.metadata.visibility;
  }

  async makeDirectory(path: string): Promise<void> {
    // No-op for buffer driver
  }

  async deleteDirectory(path: string): Promise<void> {
    // Remove all files with prefix
    for (const key of Array.from(this.files.keys())) {
      if (key.startsWith(path)) this.files.delete(key);
    }
  }

  // No URL support for buffer driver
  async url(path: string): Promise<string> {
    throw new Error('Buffer driver does not support URLs');
  }

  async getTemporaryUrl(path: string): Promise<string> {
    throw new Error('Buffer driver does not support temporary URLs');
  }
} 