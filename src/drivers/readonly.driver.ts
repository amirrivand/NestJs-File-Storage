import { StorageDriver, FileMetadata } from '../lib/file-storage.interface';
import { Readable } from 'stream';

/**
 * Storage driver that wraps another driver and disables all write operations.
 * Only read operations are allowed; write operations throw errors.
 */
export class ReadOnlyStorageDriver implements StorageDriver {
  /**
   * Create a new ReadOnlyStorageDriver.
   * @param driver The underlying storage driver to wrap.
   */
  constructor(private driver: StorageDriver) {}

  /**
   * Throws an error for any write operation.
   * @throws Always throws an error indicating the disk is read-only.
   */
  private throwReadOnly() {
    throw new Error(
      'This disk is read-only. Write operations are not allowed.',
    );
  }

  /**
   * Attempt to store a file (not allowed).
   * @throws Always throws an error.
   */
  put(): Promise<void> {
    return Promise.reject(this.throwReadOnly());
  }
  /**
   * Attempt to delete a file (not allowed).
   * @throws Always throws an error.
   */
  delete(): Promise<void> {
    return Promise.reject(this.throwReadOnly());
  }
  /**
   * Attempt to copy a file (not allowed).
   * @throws Always throws an error.
   */
  copy(): Promise<void> {
    return Promise.reject(this.throwReadOnly());
  }
  /**
   * Attempt to move a file (not allowed).
   * @throws Always throws an error.
   */
  move(): Promise<void> {
    return Promise.reject(this.throwReadOnly());
  }
  /**
   * Attempt to append to a file (not allowed).
   * @throws Always throws an error.
   */
  append(): Promise<void> {
    return Promise.reject(this.throwReadOnly());
  }
  /**
   * Attempt to prepend to a file (not allowed).
   * @throws Always throws an error.
   */
  prepend(): Promise<void> {
    return Promise.reject(this.throwReadOnly());
  }
  /**
   * Attempt to make a directory (not allowed).
   * @throws Always throws an error.
   */
  makeDirectory(): Promise<void> {
    return Promise.reject(this.throwReadOnly());
  }
  /**
   * Attempt to delete a directory (not allowed).
   * @throws Always throws an error.
   */
  deleteDirectory(): Promise<void> {
    return Promise.reject(this.throwReadOnly());
  }
  /**
   * Attempt to set visibility (not allowed).
   * @throws Always throws an error.
   */
  setVisibility(): Promise<void> {
    return Promise.reject(this.throwReadOnly());
  }

  /**
   * Retrieve a file as a Buffer from the underlying driver.
   * @param path Path of the file to retrieve.
   * @returns File content as Buffer.
   */
  get(path: string): Promise<Buffer> {
    return this.driver.get(path);
  }
  /**
   * Check if a file exists using the underlying driver.
   * @param path Path to check.
   * @returns True if file exists, false otherwise.
   */
  exists(path: string): Promise<boolean> {
    return this.driver.exists(path);
  }
  /**
   * List files using the underlying driver.
   * @param dir Directory path.
   * @param recursive Whether to list recursively.
   * @returns Array of file paths.
   */
  listFiles(dir = '', recursive = true): Promise<string[]> {
    return this.driver.listFiles(dir, recursive);
  }
  /**
   * List directories using the underlying driver.
   * @param dir Directory path.
   * @param recursive Whether to list recursively.
   * @returns Array of directory paths.
   */
  listDirectories(dir = '', recursive = true): Promise<string[]> {
    return this.driver.listDirectories(dir, recursive);
  }
  /**
   * Get metadata for a file using the underlying driver.
   * @param path Path of the file.
   * @returns File metadata.
   */
  getMetadata(path: string): Promise<FileMetadata> {
    return this.driver.getMetadata?.(path) ?? Promise.resolve(undefined as any);
  }
  /**
   * Create a readable stream for a file using the underlying driver.
   * @param path Path of the file.
   * @returns Readable stream.
   */
  createReadStream(path: string): Readable {
    return this.driver.createReadStream(path);
  }
  /**
   * Get a public URL for a file using the underlying driver.
   * @param path Path of the file.
   * @returns Public URL or file path.
   */
  url(path: string): Promise<string> {
    return this.driver.url?.(path) ?? Promise.resolve(undefined as any);
  }
  /**
   * Get the visibility of a file using the underlying driver.
   * @param path Path of the file.
   * @returns Visibility setting.
   */
  getVisibility(
    path: string,
  ): Promise<'public' | 'private' | undefined> {
    return this.driver.getVisibility?.(path) ?? Promise.resolve(undefined);
  }
}
