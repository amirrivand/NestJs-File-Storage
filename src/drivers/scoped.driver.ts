import { FileMetadata, StorageDriver, ScopedDiskConfig } from '../lib/file-storage.interface';

export class ScopedStorageDriver implements StorageDriver {
  private driver: StorageDriver;
  private prefix: string;

  constructor(
    private config: ScopedDiskConfig,
    driver: StorageDriver,
  ) {
    this.driver = driver;
    this.prefix = config.prefix || '';
  }

  private scoped(path: string): string {
    return this.prefix ? `${this.prefix.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}` : path;
  }

  put(path: string, content: Buffer | string, options?: { visibility?: 'public' | 'private' }) {
    return this.driver.put(this.scoped(path), content, options);
  }
  get(path: string) {
    return this.driver.get(this.scoped(path));
  }
  delete(path: string) {
    return this.driver.delete(this.scoped(path));
  }
  exists(path: string) {
    return this.driver.exists(this.scoped(path));
  }
  copy(src: string, dest: string) {
    return this.driver.copy(this.scoped(src), this.scoped(dest));
  }
  move(src: string, dest: string) {
    return this.driver.move(this.scoped(src), this.scoped(dest));
  }
  makeDirectory(path: string): Promise<void> {
    return this.driver.makeDirectory?.(this.scoped(path)) ?? Promise.resolve();
  }
  deleteDirectory(path: string): Promise<void> {
    return this.driver.deleteDirectory?.(this.scoped(path)) ?? Promise.resolve();
  }
  getMetadata(path: string): Promise<FileMetadata> {
    return this.driver.getMetadata?.(this.scoped(path)) ?? Promise.resolve(undefined as any);
  }
  listFiles(dir = '', recursive = true): Promise<string[]> {
    return this.driver.listFiles?.(this.scoped(dir), recursive) ?? Promise.resolve([]);
  }
  listDirectories(dir = '', recursive = true): Promise<string[]> {
    return this.driver.listDirectories?.(this.scoped(dir), recursive) ?? Promise.resolve([]);
  }
  createReadStream(path: string) {
    return this.driver.createReadStream(this.scoped(path));
  }
  prepend(path: string, content: Buffer | string) {
    return this.driver.prepend(this.scoped(path), content);
  }
  append(path: string, content: Buffer | string) {
    return this.driver.append(this.scoped(path), content);
  }
  url(path: string): Promise<string> {
    return this.driver.url?.(this.scoped(path)) ?? Promise.resolve(undefined as any);
  }
  setVisibility(path: string, visibility: 'public' | 'private'): Promise<void> {
    return this.driver.setVisibility?.(this.scoped(path), visibility) ?? Promise.resolve();
  }
  getVisibility(path: string): Promise<'public' | 'private' | undefined> {
    return this.driver.getVisibility?.(this.scoped(path)) ?? Promise.resolve(undefined);
  }
}
