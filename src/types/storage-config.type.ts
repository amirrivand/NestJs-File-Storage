import { StorageDiskConfig } from '../lib/file-storage.interface';

export type FilenameGenerator = (file: Express.Multer.File, context: any) => Promise<string> | string;

// disks: کلید نام دیسک و مقدار کانفیگ تایپ‌شده بر اساس نوع درایور
export type StorageConfig<
  TDisks extends Record<string, StorageDiskConfig> = Record<string, StorageDiskConfig>,
> = {
  default: keyof TDisks;
  disks: TDisks;
  filenameGenerator?: FilenameGenerator;
};
