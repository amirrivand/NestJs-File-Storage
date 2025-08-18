import { Inject, Injectable } from '@nestjs/common';
import { BufferStorageDriver } from '../drivers/buffer.driver';
import { DropboxStorageDriver } from '../drivers/dropbox.driver';
import { FTPStorageDriver } from '../drivers/ftp.driver';
import { GoogleDriveStorageDriver } from '../drivers/google-drive.driver';
import { LocalStorageDriver } from '../drivers/local.driver';
import { S3StorageDriver } from '../drivers/s3.driver';
import { ScopedStorageDriver } from '../drivers/scoped.driver';
import { SFTPStorageDriver } from '../drivers/sftp.driver';
import { StorageConfig } from '../types/storage-config.type';
import {
  DiskObjectValidation,
  BufferDiskConfig,
  DropboxDiskConfig,
  FTPDiskConfig,
  GoogleDriveDiskConfig,
  LocalDiskConfig,
  S3DiskConfig,
  ScopedDiskConfig,
  SFTPDiskConfig,
  StorageDisk,
  StorageDiskConfig,
  StorageDriver,
} from './file-storage.interface';

const DRIVER_MAP = {
  buffer: BufferStorageDriver,
  local: LocalStorageDriver,
  s3: S3StorageDriver,
  ftp: FTPStorageDriver,
  sftp: SFTPStorageDriver,
  dropbox: DropboxStorageDriver,
  gdrive: GoogleDriveStorageDriver,
  scoped: ScopedStorageDriver,
};

/**
 * Service for managing file storage across multiple disks and drivers.
 * Provides convenience methods for file operations and disk management.
 */
@Injectable()
export class FileStorageService<T = any> {
  public readonly config?: StorageConfig<DiskObjectValidation<T>>;
  private disks: Map<string, StorageDisk> = new Map();
  private defaultDisk: string = 'default';

  /**
   * Create a new FileStorageService.
   * @param config Optional storage configuration.
   */
  constructor(@Inject('STORAGE_CONFIG') config?: StorageConfig<DiskObjectValidation<T>>) {
    this.config = config;
    if (config) {
      this.defaultDisk = config.default as string;
      for (const [name, diskConfig] of Object.entries(config.disks)) {
        let driverInstance: StorageDriver;
        if (!diskConfig) {
          throw new Error(`Disk config not found for disk: ${name}`);
        }
        switch ((diskConfig as StorageDiskConfig).driver) {
          case 'buffer':
            driverInstance = new BufferStorageDriver(diskConfig as BufferDiskConfig);
            break;
          case 'local':
            driverInstance = new LocalStorageDriver(diskConfig as LocalDiskConfig);
            break;
          case 's3':
            driverInstance = new S3StorageDriver(diskConfig as S3DiskConfig);
            break;
          case 'ftp':
            driverInstance = new FTPStorageDriver(diskConfig as FTPDiskConfig);
            break;
          case 'sftp':
            driverInstance = new SFTPStorageDriver(diskConfig as SFTPDiskConfig);
            break;
          case 'dropbox':
            driverInstance = new DropboxStorageDriver(diskConfig as DropboxDiskConfig);
            break;
          case 'gdrive':
            driverInstance = new GoogleDriveStorageDriver(diskConfig as GoogleDriveDiskConfig);
            break;
          case 'scoped':
            // برای scoped باید یک driver دیگر هم پاس داده شود، اینجا فرض می‌کنیم local به عنوان پیش‌فرض
            driverInstance = new ScopedStorageDriver(
              diskConfig as ScopedDiskConfig,
              new LocalStorageDriver({ driver: 'local', root: '' }),
            );
            break;
          default:
            throw new Error(`Unknown driver: ${(diskConfig as { driver: string }).driver}`);
        }
        this.disks.set(name, {
          name,
          driver: driverInstance,
          config: diskConfig as StorageDiskConfig,
        });
      }
    }
  }

  /**
   * Get the storage driver for a given disk name, or the default disk if not specified.
   * @param name Optional disk name.
   * @returns The storage driver instance.
   */
  disk(name?: string): StorageDriver {
    const diskName = name || this.defaultDisk;
    const disk = this.disks.get(diskName);
    if (!disk) throw new Error(`Disk not found: ${diskName}`);
    return disk.driver;
  }

  // Convenience methods for default disk
  /**
   * Store a file on the default disk.
   * @param path Path to store the file at.
   * @param content File content as Buffer or string.
   * @param options Optional visibility settings.
   */
  async put(
    path: string,
    content: Buffer | string,
    options?: { visibility?: 'public' | 'private' },
  ) {
    return this.disk().put(path, content, options);
  }
  /**
   * Retrieve a file from the default disk.
   * @param path Path of the file to retrieve.
   */
  async get(path: string) {
    return this.disk().get(path);
  }
  /**
   * Delete a file from the default disk.
   * @param path Path of the file to delete.
   */
  async delete(path: string) {
    return this.disk().delete(path);
  }
  /**
   * Check if a file exists on the default disk.
   * @param path Path to check.
   */
  async exists(path: string) {
    return this.disk().exists(path);
  }
  /**
   * Copy a file on the default disk.
   * @param src Source path.
   * @param dest Destination path.
   */
  async copy(src: string, dest: string) {
    return this.disk().copy(src, dest);
  }
  /**
   * Move a file on the default disk.
   * @param src Source path.
   * @param dest Destination path.
   */
  async move(src: string, dest: string) {
    return this.disk().move(src, dest);
  }
  /**
   * Create a directory on the default disk.
   * @param path Directory path.
   */
  async makeDirectory(path: string) {
    return this.disk().makeDirectory?.(path);
  }
  /**
   * Delete a directory on the default disk.
   * @param path Directory path.
   */
  async deleteDirectory(path: string) {
    return this.disk().deleteDirectory?.(path);
  }
  /**
   * Get metadata for a file on the default disk.
   * @param path Path of the file.
   */
  async getMetadata(path: string) {
    return this.disk().getMetadata?.(path);
  }
  /**
   * Get a public URL for a file on the default disk.
   * @param path Path of the file.
   */
  async url(path: string) {
    return this.disk().url?.(path);
  }

  /**
   * Get a temporary URL for a file on a given disk, if supported.
   * @param path Path of the file.
   * @param expiresIn Expiration in seconds.
   * @param options Additional options (IP/device).
   * @param disk Optional disk name.
   */
  async getTemporaryUrl(
    path: string,
    expiresIn?: number,
    options?: { ip?: string; deviceId?: string },
    disk?: string,
  ) {
    const driver = this.disk(disk);
    if (typeof driver.getTemporaryUrl === 'function') {
      return driver.getTemporaryUrl(path, expiresIn, options);
    }
    throw new Error('Temporary URL is not supported for this disk');
  }

  /**
   * Store a file with an expiration time on a given disk, if supported.
   * @param path Path to store the file at.
   * @param content File content as Buffer or string.
   * @param options Expiration and visibility options.
   * @param disk Optional disk name.
   */
  async putTimed(
    path: string,
    content: Buffer | string,
    options: { expiresAt?: Date; ttl?: number; visibility?: 'public' | 'private' } = {},
    disk?: string,
  ) {
    const driver = this.disk(disk);
    if (typeof driver.putTimed === 'function') {
      return driver.putTimed(path, content, options);
    }
    // Fallback: just put the file (no expiration)
    return driver.put(path, content, options);
  }

  /**
   * Delete all expired files on a given disk, if supported.
   * @param disk Optional disk name.
   * @returns Number of deleted files.
   */
  async deleteExpiredFiles(disk?: string): Promise<number> {
    const driver = this.disk(disk);
    if (typeof driver.deleteExpiredFiles === 'function') {
      return driver.deleteExpiredFiles();
    }
    // Fallback: do nothing
    return 0;
  }

  /**
   * Store a file stream on a given disk, if supported.
   * @param path Path to store the file at.
   * @param stream Readable stream of file content.
   * @param options Optional visibility settings.
   * @param disk Optional disk name.
   */
  async putStream(
    path: string,
    stream: import('stream').Readable,
    options?: { visibility?: 'public' | 'private' },
    disk?: string,
  ) {
    const driver = this.disk(disk);
    if (typeof (driver as any).putStream === 'function') {
      return (driver as any).putStream(path, stream, options);
    }
    // fallback: buffer the stream
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return driver.put(path, Buffer.concat(chunks), options);
  }
}
