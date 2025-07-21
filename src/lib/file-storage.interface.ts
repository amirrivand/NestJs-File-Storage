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
  get(path: string): Promise<Buffer>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  copy(src: string, dest: string): Promise<void>;
  move(src: string, dest: string): Promise<void>;
  url?(path: string): Promise<string>;
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

export interface StorageDiskConfig {
  driver: string;
  root?: string;
  [key: string]: any;
}

export interface StorageDisk {
  name: string;
  driver: StorageDriver;
  config: StorageDiskConfig;
}
