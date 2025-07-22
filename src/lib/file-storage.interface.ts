import { Readable } from 'stream';

/**
 * Metadata information for a file in storage.
 */
export interface FileMetadata {
  path: string;
  size: number;
  mimeType?: string;
  lastModified?: Date;
  visibility?: 'public' | 'private';
}

/**
 * Interface for a storage driver. Implementations provide methods for file operations on various backends.
 */
export interface StorageDriver {
  /**
   * Store a file at the given path.
   * @param path Path to store the file at.
   * @param content File content as Buffer or string.
   * @param options Optional visibility settings.
   */
  put(
    path: string,
    content: Buffer | string,
    options?: { visibility?: 'public' | 'private' },
  ): Promise<void>;
  /**
   * Store a file stream at the given path.
   * @param path Path to store the file at.
   * @param stream Readable stream of file content.
   * @param options Optional visibility settings.
   */
  putStream?(
    path: string,
    stream: import('stream').Readable,
    options?: { visibility?: 'public' | 'private' },
  ): Promise<void>;
  /**
   * Store a file with an expiration time.
   * @param path Path to store the file at.
   * @param content File content as Buffer or string.
   * @param options Expiration and visibility options.
   */
  putTimed?(
    path: string,
    content: Buffer | string,
    options: { expiresAt?: Date; ttl?: number; visibility?: 'public' | 'private' },
  ): Promise<void>;
  /**
   * Delete all expired files. Returns the number of deleted files.
   */
  deleteExpiredFiles?(): Promise<number>;
  /**
   * Retrieve a file as a Buffer.
   * @param path Path of the file to retrieve.
   */
  get(path: string): Promise<Buffer>;
  /**
   * Delete a file at the given path.
   * @param path Path of the file to delete.
   */
  delete(path: string): Promise<void>;
  /**
   * Check if a file exists at the given path.
   * @param path Path to check.
   */
  exists(path: string): Promise<boolean>;
  /**
   * Copy a file from src to dest.
   * @param src Source path.
   * @param dest Destination path.
   */
  copy(src: string, dest: string): Promise<void>;
  /**
   * Move a file from src to dest.
   * @param src Source path.
   * @param dest Destination path.
   */
  move(src: string, dest: string): Promise<void>;
  /**
   * Get a public URL for a file, if supported.
   * @param path Path of the file.
   */
  url?(path: string): Promise<string>;
  /**
   * Get a temporary URL for a file, if supported.
   * @param path Path of the file.
   * @param expiresIn Expiration in seconds.
   * @param options Additional options (IP/device).
   */
  getTemporaryUrl?(
    path: string,
    expiresIn?: number,
    options?: { ip?: string; deviceId?: string },
  ): Promise<string>;
  /**
   * Get metadata for a file, if supported.
   * @param path Path of the file.
   */
  getMetadata?(path: string): Promise<FileMetadata>;
  /**
   * Create a directory at the given path, if supported.
   * @param path Directory path.
   */
  makeDirectory?(path: string): Promise<void>;
  /**
   * Delete a directory at the given path, if supported.
   * @param path Directory path.
   */
  deleteDirectory?(path: string): Promise<void>;
  /**
   * Set the visibility of a file, if supported.
   * @param path Path of the file.
   * @param visibility Visibility setting.
   */
  setVisibility?(path: string, visibility: 'public' | 'private'): Promise<void>;
  /**
   * Get the visibility of a file, if supported.
   * @param path Path of the file.
   */
  getVisibility?(path: string): Promise<'public' | 'private' | undefined>;
  /**
   * Create a readable stream for a file.
   * @param path Path of the file.
   */
  createReadStream(path: string): Readable;
  /**
   * Prepend content to a file.
   * @param path Path of the file.
   * @param content Content to prepend.
   */
  prepend(path: string, content: Buffer | string): Promise<void>;
  /**
   * Append content to a file.
   * @param path Path of the file.
   * @param content Content to append.
   */
  append(path: string, content: Buffer | string): Promise<void>;
  /**
   * List files in a directory.
   * @param dir Directory path.
   * @param recursive Whether to list recursively.
   */
  listFiles(dir?: string, recursive?: boolean): Promise<string[]>;
  /**
   * List directories in a directory.
   * @param dir Directory path.
   * @param recursive Whether to list recursively.
   */
  listDirectories(dir?: string, recursive?: boolean): Promise<string[]>;
}

/**
 * Configuration for a local disk storage driver.
 */
export interface LocalDiskConfig {
  driver: 'local';
  root: string;
  basePublicUrl?: string;
}

/**
 * Configuration for an S3 disk storage driver.
 */
export interface S3DiskConfig {
  driver: 's3';
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
  bucket: string;
  endpoint?: string;
  cdnBaseUrl?: string;
  apiVersion?: string;
}

/**
 * Configuration for a Dropbox disk storage driver.
 */
export interface DropboxDiskConfig {
  driver: 'dropbox';
  accessToken: string;
  basePublicUrl?: string;
}

/**
 * Configuration for an FTP disk storage driver.
 */
export interface FTPDiskConfig {
  driver: 'ftp';
  host: string;
  user: string;
  password: string;
  port?: number;
  secure?: boolean;
  basePublicUrl?: string;
  root: string;
}

/**
 * Configuration for an SFTP disk storage driver.
 */
export interface SFTPDiskConfig {
  driver: 'sftp';
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  basePublicUrl?: string;
  root: string;
}

/**
 * Configuration for a Google Drive disk storage driver.
 */
export interface GoogleDriveDiskConfig {
  driver: 'gdrive';
  client_email: string;
  private_key: string;
  folderId: string;
  basePublicUrl?: string;
}

/**
 * Configuration for a scoped disk storage driver.
 */
export interface ScopedDiskConfig {
  driver: 'scoped';
  prefix: string;
}

export interface BufferDiskConfig {
  driver: 'buffer';
}

export type StorageDiskConfig =
  | LocalDiskConfig
  | S3DiskConfig
  | DropboxDiskConfig
  | FTPDiskConfig
  | SFTPDiskConfig
  | GoogleDriveDiskConfig
  | ScopedDiskConfig
  | BufferDiskConfig;

/**
 * Represents a storage disk with its name, driver, and configuration.
 */
export interface StorageDisk {
  name: string;
  driver: StorageDriver;
  config: StorageDiskConfig;
}
