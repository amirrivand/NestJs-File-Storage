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
  /**
   * Names of disks to expose as injectable providers when using forRootAsync.
   * Required for @InjectDisk('name') to work in async registration, because
   * disk provider tokens must be declared at module definition time.
   */
  injectables?: (keyof DiskObjectValidation<T>)[];
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
    // Build explicit per-disk providers based on the declared diskNames.
    // In async registration we cannot compute provider tokens from the resolved
    // config at compile time, so we rely on the caller to provide diskNames.
    const diskProviders: Provider[] = (options.injectables || []).map((diskName) =>
      createDiskProvider<T>(diskName as string, (storage: FileStorageService<T>) =>
        storage.disk(diskName as string),
      ),
    );
    return {
      global: options.isGlobal ?? false,
      module: FileStorageModule,
      imports: options.imports || [],
      providers: [
        ...(options.providers || []),
        asyncProvider,
        FileStorageService<T>,
        ...diskProviders,
      ],
      exports: [FileStorageService<T>, ...diskProviders],
    };
  }
}
