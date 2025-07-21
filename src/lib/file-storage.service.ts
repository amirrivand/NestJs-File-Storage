import { Inject, Injectable } from '@nestjs/common';
import { DropboxStorageDriver } from '../drivers/dropbox.driver';
import { FTPStorageDriver } from '../drivers/ftp.driver';
import { GoogleDriveStorageDriver } from '../drivers/google-drive.driver';
import { LocalStorageDriver } from '../drivers/local.driver';
import { S3StorageDriver } from '../drivers/s3.driver';
import { SFTPStorageDriver } from '../drivers/sftp.driver';
import { StorageConfig } from '../types/storage-config.type';
import { StorageDisk, StorageDriver } from './file-storage.interface';

const DRIVER_MAP: Record<string, any> = {
  local: LocalStorageDriver,
  s3: S3StorageDriver,
  ftp: FTPStorageDriver,
  sftp: SFTPStorageDriver,
  dropbox: DropboxStorageDriver,
  gdrive: GoogleDriveStorageDriver,
};

@Injectable()
export class FileStorageService {
  private disks: Map<string, StorageDisk> = new Map();
  private defaultDisk: string = 'default';

  constructor(@Inject('STORAGE_CONFIG') config?: StorageConfig) {
    if (config) {
      this.defaultDisk = config.default;
      for (const [name, diskConfig] of Object.entries(config.disks)) {
        const DriverClass = DRIVER_MAP[diskConfig.driver];
        if (!DriverClass) throw new Error(`Unknown driver: ${diskConfig.driver}`);
        this.disks.set(name, {
          name,
          driver: new DriverClass(diskConfig),
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
}
