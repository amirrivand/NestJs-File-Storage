import { FileMetadata, StorageDriver, ScopedDiskConfig } from '../lib/file-storage.interface';

/**
 * Storage driver that scopes all file operations to a given prefix.
 * Delegates actual operations to another storage driver.
 */
export class ScopedStorageDriver implements StorageDriver {
  private driver: StorageDriver;
  private prefix: string;

  /**
   * Create a new ScopedStorageDriver.
   * @param config Scoped disk configuration.
   * @param driver The underlying storage driver to delegate to.
   */
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

  /**
   * Store a file at the given path, scoped by prefix.
   * @param path Path to store the file at.
   * @param content File content as Buffer or string.
   * @param options Optional visibility settings.
   */
  put(path: string, content: Buffer | string, options?: { visibility?: 'public' | 'private' }) {
    return this.driver.put(this.scoped(path), content, options);
  }
  /**
   * Retrieve a file as a Buffer, scoped by prefix.
   * @param path Path of the file to retrieve.
   * @returns File content as Buffer.
   */
  get(path: string) {
    return this.driver.get(this.scoped(path));
  }
  /**
   * Delete a file at the given path, scoped by prefix.
   * @param path Path of the file to delete.
   */
  delete(path: string) {
    return this.driver.delete(this.scoped(path));
  }
  /**
   * Check if a file exists at the given path, scoped by prefix.
   * @param path Path to check.
   * @returns True if file exists, false otherwise.
   */
  exists(path: string) {
    return this.driver.exists(this.scoped(path));
  }
  /**
   * Copy a file from src to dest, both scoped by prefix.
   * @param src Source path.
   * @param dest Destination path.
   */
  copy(src: string, dest: string) {
    return this.driver.copy(this.scoped(src), this.scoped(dest));
  }
  /**
   * Move a file from src to dest, both scoped by prefix.
   * @param src Source path.
   * @param dest Destination path.
   */
  move(src: string, dest: string) {
    return this.driver.move(this.scoped(src), this.scoped(dest));
  }
  /**
   * Create a directory at the given path, scoped by prefix.
   * @param path Directory path.
   */
  makeDirectory(path: string): Promise<void> {
    return this.driver.makeDirectory?.(this.scoped(path)) ?? Promise.resolve();
  }
  /**
   * Delete a directory at the given path, scoped by prefix.
   * @param path Directory path.
   */
  deleteDirectory(path: string): Promise<void> {
    return this.driver.deleteDirectory?.(this.scoped(path)) ?? Promise.resolve();
  }
  /**
   * Get metadata for a file, scoped by prefix.
   * @param path Path of the file.
   * @returns File metadata.
   */
  getMetadata(path: string): Promise<FileMetadata> {
    return this.driver.getMetadata?.(this.scoped(path)) ?? Promise.resolve(undefined as any);
  }
  /**
   * List files in a directory, scoped by prefix.
   * @param dir Directory path.
   * @param recursive Whether to list recursively.
   * @returns Array of file paths.
   */
  listFiles(dir = '', recursive = true): Promise<string[]> {
    return this.driver.listFiles?.(this.scoped(dir), recursive) ?? Promise.resolve([]);
  }
  /**
   * List directories in a directory, scoped by prefix.
   * @param dir Directory path.
   * @param recursive Whether to list recursively.
   * @returns Array of directory paths.
   */
  listDirectories(dir = '', recursive = true): Promise<string[]> {
    return this.driver.listDirectories?.(this.scoped(dir), recursive) ?? Promise.resolve([]);
  }
  /**
   * Create a readable stream for a file, scoped by prefix.
   * @param path Path of the file.
   * @returns Readable stream.
   */
  createReadStream(path: string) {
    return this.driver.createReadStream(this.scoped(path));
  }
  /**
   * Prepend content to a file, scoped by prefix.
   * @param path Path of the file.
   * @param content Content to prepend.
   */
  prepend(path: string, content: Buffer | string) {
    return this.driver.prepend(this.scoped(path), content);
  }
  /**
   * Append content to a file, scoped by prefix.
   * @param path Path of the file.
   * @param content Content to append.
   */
  append(path: string, content: Buffer | string) {
    return this.driver.append(this.scoped(path), content);
  }
  /**
   * Get a public URL for a file, scoped by prefix.
   * @param path Path of the file.
   * @returns Public URL or file path.
   */
  url(path: string): Promise<string> {
    return this.driver.url?.(this.scoped(path)) ?? Promise.resolve(undefined as any);
  }
  /**
   * Set the visibility of a file, scoped by prefix.
   * @param path Path of the file.
   * @param visibility Visibility setting.
   */
  setVisibility(path: string, visibility: 'public' | 'private'): Promise<void> {
    return this.driver.setVisibility?.(this.scoped(path), visibility) ?? Promise.resolve();
  }
  /**
   * Get the visibility of a file, scoped by prefix.
   * @param path Path of the file.
   * @returns Visibility setting.
   */
  getVisibility(path: string): Promise<'public' | 'private' | undefined> {
    return this.driver.getVisibility?.(this.scoped(path)) ?? Promise.resolve(undefined);
  }
}
