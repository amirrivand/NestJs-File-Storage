import { Provider } from '@nestjs/common';
import { FileStorageService } from '../lib/file-storage.service';

export function createDiskProvider(
  diskName: string,
  factory: (storage: FileStorageService) => any,
): Provider {
  return {
    provide: `FILE_STORAGE_DISK_${diskName.toUpperCase()}`,
    useFactory: factory,
    inject: [FileStorageService],
  };
}
