import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { createDiskProvider } from '../providers/dynamic-disk.provider';
import { StorageConfig } from '../types/storage-config.type';
import { DiskObjectValidation } from './file-storage.interface';
import { FileStorageService } from './file-storage.service';

/**
 * Options for asynchronously configuring the FileStorageModule.
 */
export interface FileStorageModuleAsyncOptions<T> {
  isGlobal?: boolean;
  imports?: any[];
  inject?: any[];
  useExisting?: Type<any>;
  useClass?: Type<any>;
  useFactory?: (
    ...args: any[]
  ) => Promise<StorageConfig<DiskObjectValidation<T>>> | StorageConfig<DiskObjectValidation<T>>;
  providers?: Provider[];
}

/**
 * NestJS module for file storage integration.
 * Provides static methods for synchronous and asynchronous configuration.
 */
@Module({})
export class FileStorageModule {
  /**
   * Configure the module synchronously with a static config object.
   * @param config Storage configuration and optional global flag.
   * @returns A dynamic module for NestJS.
   */
  static forRoot<T>({
    isGlobal,
    ...config
  }: StorageConfig<DiskObjectValidation<T>> & { isGlobal?: boolean }): DynamicModule {
    const diskProviders: Provider[] = Object.keys(config.disks).map((diskName) =>
      createDiskProvider(diskName, (storage: FileStorageService<T>) => storage.disk(diskName)),
    );
    return {
      global: isGlobal ?? false,
      module: FileStorageModule,
      providers: [
        { provide: 'STORAGE_CONFIG', useValue: config },
        FileStorageService<T>,
        ...diskProviders,
      ],
      exports: [FileStorageService<T>, ...diskProviders],
    };
  }

  /**
   * Configure the module asynchronously using a factory or class.
   * @param options Async configuration options.
   * @returns A dynamic module for NestJS.
   */
  static forRootAsync<T>(options: FileStorageModuleAsyncOptions<T>): DynamicModule {
    const asyncProvider: Provider = options.useFactory
      ? {
          provide: 'STORAGE_CONFIG',
          useFactory: options.useFactory,
          inject: options.inject || [],
        }
      : {
          provide: 'STORAGE_CONFIG',
          useClass: options.useClass as Type<any>,
        };
    // Provider داینامیک دیسک‌ها بعد از resolve شدن config ساخته می‌شود
    const diskProvidersFactory: Provider = {
      provide: 'FILE_STORAGE_DISK_PROVIDERS',
      useFactory: async (
        storage: FileStorageService<T>,
        config: StorageConfig<DiskObjectValidation<T>>,
      ) => {
        return Object.keys(config.disks).map((diskName) =>
          createDiskProvider(diskName, (storage: FileStorageService<T>) => storage.disk(diskName)),
        );
      },
      inject: [FileStorageService<T>, 'STORAGE_CONFIG'],
    };
    return {
      global: options.isGlobal ?? false,
      module: FileStorageModule,
      imports: options.imports || [],
      providers: [
        ...(options.providers || []),
        asyncProvider,
        FileStorageService<T>,
        diskProvidersFactory,
      ],
      exports: [FileStorageService<T>, 'FILE_STORAGE_DISK_PROVIDERS'],
    };
  }
}
