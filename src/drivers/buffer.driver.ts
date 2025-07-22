import { StorageDriver, FileMetadata } from '../lib/file-storage.interface';
import { Readable } from 'stream';

interface BufferFile {
  content: Buffer;
  metadata: FileMetadata;
}

/**
 * Configuration for the in-memory buffer storage driver.
 */
export interface BufferDiskConfig {
  driver: 'buffer';
}

/**
 * Storage driver for in-memory buffer operations.
 * Useful for testing or ephemeral storage.
 */
export class BufferStorageDriver implements StorageDriver {
  private files: Map<string, BufferFile> = new Map();

  /**
   * Create a new BufferStorageDriver.
   * @param config Buffer disk configuration.
   */
  constructor(private config: BufferDiskConfig) {}

  /**
   * Store a file at the given path in memory.
   * @param path Path to store the file at.
   * @param content File content as Buffer or string.
   * @param options Optional visibility settings.
   */
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

  /**
   * Retrieve a file as a Buffer from memory.
   * @param path Path of the file to retrieve.
   * @returns File content as Buffer.
   */
  async get(path: string): Promise<Buffer> {
    const file = this.files.get(path);
    if (!file) throw new Error(`File not found: ${path}`);
    return file.content;
  }

  /**
   * Delete a file at the given path from memory.
   * @param path Path of the file to delete.
   */
  async delete(path: string): Promise<void> {
    this.files.delete(path);
  }

  /**
   * Check if a file exists at the given path in memory.
   * @param path Path to check.
   * @returns True if file exists, false otherwise.
   */
  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  /**
   * Copy a file from src to dest in memory.
   * @param src Source path.
   * @param dest Destination path.
   */
  async copy(src: string, dest: string): Promise<void> {
    const file = this.files.get(src);
    if (!file) throw new Error(`File not found: ${src}`);
    this.files.set(dest, {
      content: Buffer.from(file.content),
      metadata: { ...file.metadata, path: dest, lastModified: new Date() },
    });
  }

  /**
   * Move a file from src to dest in memory.
   * @param src Source path.
   * @param dest Destination path.
   */
  async move(src: string, dest: string): Promise<void> {
    await this.copy(src, dest);
    await this.delete(src);
  }

  /**
   * Create a readable stream for a file in memory.
   * @param path Path of the file.
   * @returns Readable stream.
   */
  createReadStream(path: string): Readable {
    const file = this.files.get(path);
    if (!file) throw new Error(`File not found: ${path}`);
    const stream = new Readable();
    stream.push(file.content);
    stream.push(null);
    return stream;
  }

  /**
   * Prepend content to a file in memory.
   * @param path Path of the file.
   * @param content Content to prepend.
   */
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

  /**
   * Append content to a file in memory.
   * @param path Path of the file.
   * @param content Content to append.
   */
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

  /**
   * List files in memory (flat structure).
   * @param dir Directory path prefix.
   * @param recursive Whether to list recursively (not applicable).
   * @returns Array of file paths.
   */
  async listFiles(dir = '', recursive = true): Promise<string[]> {
    // Only flat structure for buffer driver
    return Array.from(this.files.keys()).filter((key) => key.startsWith(dir));
  }

  /**
   * List directories in memory (not applicable, returns empty array).
   * @param dir Directory path prefix.
   * @param recursive Whether to list recursively.
   * @returns Empty array.
   */
  async listDirectories(dir = '', recursive = true): Promise<string[]> {
    // Not applicable for buffer driver, return empty
    return [];
  }

  /**
   * Get metadata for a file in memory.
   * @param path Path of the file.
   * @returns File metadata.
   */
  async getMetadata(path: string): Promise<FileMetadata> {
    const file = this.files.get(path);
    if (!file) throw new Error(`File not found: ${path}`);
    return file.metadata;
  }

  /**
   * Set the visibility of a file in memory.
   * @param path Path of the file.
   * @param visibility Visibility setting.
   */
  async setVisibility(path: string, visibility: 'public' | 'private'): Promise<void> {
    const file = this.files.get(path);
    if (!file) throw new Error(`File not found: ${path}`);
    file.metadata.visibility = visibility;
  }

  /**
   * Get the visibility of a file in memory.
   * @param path Path of the file.
   * @returns Visibility setting.
   */
  async getVisibility(path: string): Promise<'public' | 'private' | undefined> {
    const file = this.files.get(path);
    return file?.metadata.visibility;
  }

  /**
   * Make a directory in memory (no-op).
   * @param path Directory path.
   */
  async makeDirectory(path: string): Promise<void> {
    // No-op for buffer driver
  }

  /**
   * Delete a directory in memory (removes all files with prefix).
   * @param path Directory path prefix.
   */
  async deleteDirectory(path: string): Promise<void> {
    // Remove all files with prefix
    for (const key of Array.from(this.files.keys())) {
      if (key.startsWith(path)) this.files.delete(key);
    }
  }

  /**
   * Get a public URL for a file (not supported).
   * @param path Path of the file.
   * @throws Error always.
   */
  async url(path: string): Promise<string> {
    throw new Error('Buffer driver does not support URLs');
  }

  /**
   * Get a temporary URL for a file (not supported).
   * @param path Path of the file.
   * @throws Error always.
   */
  async getTemporaryUrl(path: string): Promise<string> {
    throw new Error('Buffer driver does not support temporary URLs');
  }
} 