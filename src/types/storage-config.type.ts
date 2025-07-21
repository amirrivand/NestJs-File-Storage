import { StorageDiskConfig } from '../lib/file-storage.interface';

export type StorageConfig = {
  default: string;
  disks: Record<string, StorageDiskConfig>;
};
