import { Inject, Injectable } from '@nestjs/common';
import { DropboxStorageDriver } from '../drivers/dropbox.driver';
import { FTPStorageDriver } from '../drivers/ftp.driver';
import { GoogleDriveStorageDriver } from '../drivers/google-drive.driver';
import { LocalStorageDriver } from '../drivers/local.driver';
import { S3StorageDriver } from '../drivers/s3.driver';
import { SFTPStorageDriver } from '../drivers/sftp.driver';
import { StorageConfig } from '../types/storage-config.type';
import { StorageDisk, StorageDriver } from './file-storage.interface';
import { ScopedStorageDriver } from '../drivers/scoped.driver';

const DRIVER_MAP = {
  local: LocalStorageDriver,
  s3: S3StorageDriver,
  ftp: FTPStorageDriver,
  sftp: SFTPStorageDriver,
  dropbox: DropboxStorageDriver,
  gdrive: GoogleDriveStorageDriver,
  scoped: ScopedStorageDriver,
};

@Injectable()
export class FileStorageService {
  public readonly config?: StorageConfig;
  private disks: Map<string, StorageDisk> = new Map();
  private defaultDisk: string = 'default';

  constructor(@Inject('STORAGE_CONFIG') config?: StorageConfig) {
    this.config = config;
    if (config) {
      this.defaultDisk = config.default;
      for (const [name, diskConfig] of Object.entries(config.disks)) {
        let driverInstance: StorageDriver;
        switch (diskConfig.driver) {
          case 'local':
            driverInstance = new LocalStorageDriver(diskConfig);
            break;
          case 's3':
            driverInstance = new S3StorageDriver(diskConfig);
            break;
          case 'ftp':
            driverInstance = new FTPStorageDriver(diskConfig);
            break;
          case 'sftp':
            driverInstance = new SFTPStorageDriver(diskConfig);
            break;
          case 'dropbox':
            driverInstance = new DropboxStorageDriver(diskConfig);
            break;
          case 'gdrive':
            driverInstance = new GoogleDriveStorageDriver(diskConfig);
            break;
          case 'scoped':
            // برای scoped باید یک driver دیگر هم پاس داده شود، اینجا فرض می‌کنیم local به عنوان پیش‌فرض
            driverInstance = new ScopedStorageDriver(
              diskConfig,
              new LocalStorageDriver({ driver: 'local', root: '' }),
            );
            break;
          default:
            throw new Error(`Unknown driver: ${(diskConfig as { driver: string }).driver}`);
        }
        this.disks.set(name, {
          name,
          driver: driverInstance,
          config: diskConfig,
        });
      }
    }
  }

  disk(name?: string): StorageDriver {
    const diskName = name || this.defaultDisk;
    const disk = this.disks.get(diskName);
    if (!disk) throw new Error(`Disk not found: ${diskName}`);
    return disk.driver;
  }

  // Convenience methods for default disk
  async put(
    path: string,
    content: Buffer | string,
    options?: { visibility?: 'public' | 'private' },
  ) {
    return this.disk().put(path, content, options);
  }
  async get(path: string) {
    return this.disk().get(path);
  }
  async delete(path: string) {
    return this.disk().delete(path);
  }
  async exists(path: string) {
    return this.disk().exists(path);
  }
  async copy(src: string, dest: string) {
    return this.disk().copy(src, dest);
  }
  async move(src: string, dest: string) {
    return this.disk().move(src, dest);
  }
  async makeDirectory(path: string) {
    return this.disk().makeDirectory?.(path);
  }
  async deleteDirectory(path: string) {
    return this.disk().deleteDirectory?.(path);
  }
  async getMetadata(path: string) {
    return this.disk().getMetadata?.(path);
  }
  async url(path: string) {
    return this.disk().url?.(path);
  }

  async getTemporaryUrl(path: string, expiresIn?: number, options?: { ip?: string; deviceId?: string }, disk?: string) {
    const driver = this.disk(disk);
    if (typeof driver.getTemporaryUrl === 'function') {
      return driver.getTemporaryUrl(path, expiresIn, options);
    }
    throw new Error('Temporary URL is not supported for this disk');
  }
}
