import { StorageDriver, FileMetadata } from '../lib/file-storage.interface';
import { Readable } from 'stream';

export class ReadOnlyStorageDriver implements StorageDriver {
  constructor(private driver: StorageDriver) {}

  private throwReadOnly() {
    throw new Error(
      'This disk is read-only. Write operations are not allowed.',
    );
  }

  put(): Promise<void> {
    return Promise.reject(this.throwReadOnly());
  }
  delete(): Promise<void> {
    return Promise.reject(this.throwReadOnly());
  }
  copy(): Promise<void> {
    return Promise.reject(this.throwReadOnly());
  }
  move(): Promise<void> {
    return Promise.reject(this.throwReadOnly());
  }
  append(): Promise<void> {
    return Promise.reject(this.throwReadOnly());
  }
  prepend(): Promise<void> {
    return Promise.reject(this.throwReadOnly());
  }
  makeDirectory(): Promise<void> {
    return Promise.reject(this.throwReadOnly());
  }
  deleteDirectory(): Promise<void> {
    return Promise.reject(this.throwReadOnly());
  }
  setVisibility(): Promise<void> {
    return Promise.reject(this.throwReadOnly());
  }

  get(path: string): Promise<Buffer> {
    return this.driver.get(path);
  }
  exists(path: string): Promise<boolean> {
    return this.driver.exists(path);
  }
  listFiles(dir = '', recursive = true): Promise<string[]> {
    return this.driver.listFiles(dir, recursive);
  }
  listDirectories(dir = '', recursive = true): Promise<string[]> {
    return this.driver.listDirectories(dir, recursive);
  }
  getMetadata(path: string): Promise<FileMetadata> {
    return this.driver.getMetadata?.(path) ?? Promise.resolve(undefined as any);
  }
  createReadStream(path: string): Readable {
    return this.driver.createReadStream(path);
  }
  url(path: string): Promise<string> {
    return this.driver.url?.(path) ?? Promise.resolve(undefined as any);
  }
  getVisibility(
    path: string,
  ): Promise<'public' | 'private' | undefined> {
    return this.driver.getVisibility?.(path) ?? Promise.resolve(undefined);
  }
}
