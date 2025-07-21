import { Readable } from 'stream';

export interface FileMetadata {
  path: string;
  size: number;
  mimeType?: string;
  lastModified?: Date;
  visibility?: 'public' | 'private';
}

export interface StorageDriver {
  put(
    path: string,
    content: Buffer | string,
    options?: { visibility?: 'public' | 'private' },
  ): Promise<void>;
  putTimed?(
    path: string,
    content: Buffer | string,
    options: { expiresAt?: Date; ttl?: number; visibility?: 'public' | 'private' },
  ): Promise<void>;
  deleteExpiredFiles?(): Promise<number>;
  get(path: string): Promise<Buffer>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  copy(src: string, dest: string): Promise<void>;
  move(src: string, dest: string): Promise<void>;
  url?(path: string): Promise<string>;
  getTemporaryUrl?(
    path: string,
    expiresIn?: number,
    options?: { ip?: string; deviceId?: string },
  ): Promise<string>;
  getMetadata?(path: string): Promise<FileMetadata>;
  makeDirectory?(path: string): Promise<void>;
  deleteDirectory?(path: string): Promise<void>;
  setVisibility?(path: string, visibility: 'public' | 'private'): Promise<void>;
  getVisibility?(path: string): Promise<'public' | 'private' | undefined>;
  createReadStream(path: string): Readable;
  prepend(path: string, content: Buffer | string): Promise<void>;
  append(path: string, content: Buffer | string): Promise<void>;
  listFiles(dir?: string, recursive?: boolean): Promise<string[]>;
  listDirectories(dir?: string, recursive?: boolean): Promise<string[]>;
}

// Local driver config
export interface LocalDiskConfig {
  driver: 'local';
  root: string;
  basePublicUrl?: string;
}

// S3 driver config
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

// Dropbox driver config
export interface DropboxDiskConfig {
  driver: 'dropbox';
  accessToken: string;
  basePublicUrl?: string;
}

// FTP driver config
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

// SFTP driver config
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

// Google Drive driver config
export interface GoogleDriveDiskConfig {
  driver: 'gdrive';
  client_email: string;
  private_key: string;
  folderId: string;
  basePublicUrl?: string;
}

// Scoped driver config
export interface ScopedDiskConfig {
  driver: 'scoped';
  prefix: string;
}

export type StorageDiskConfig =
  | LocalDiskConfig
  | S3DiskConfig
  | DropboxDiskConfig
  | FTPDiskConfig
  | SFTPDiskConfig
  | GoogleDriveDiskConfig
  | ScopedDiskConfig;

export interface StorageDisk {
  name: string;
  driver: StorageDriver;
  config: StorageDiskConfig;
}
