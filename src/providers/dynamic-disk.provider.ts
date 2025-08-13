import { Provider } from '@nestjs/common';
import { FileStorageService } from '../lib/file-storage.service';

/**
 * Creates a NestJS provider for a specific file storage disk.
 * @param diskName The name of the disk.
 * @param factory Factory function to get the disk from FileStorageService.
 * @returns A provider object for NestJS DI.
 */
export function createDiskProvider<T>(
  diskName: string,
  factory: (storage: FileStorageService<T>) => any,
): Provider {
  return {
    provide: `FILE_STORAGE_DISK_${diskName.toUpperCase()}`,
    useFactory: factory,
    inject: [FileStorageService<T>],
  };
}
