import { StorageDiskConfig } from '../lib/file-storage.interface';

/**
 * Type for generating filenames for uploaded files.
 * Used to customize file naming logic.
 */
export type FilenameGenerator = (file: Express.Multer.File, context: any) => Promise<string> | string;

/**
 * Type for file storage configuration, including disks and default disk.
 * Supports generic disk configuration types.
 */
export type StorageConfig<
  TDisks extends Record<string, StorageDiskConfig> = Record<string, StorageDiskConfig>,
> = {
  default: keyof TDisks;
  disks: TDisks;
  filenameGenerator?: FilenameGenerator;
};
