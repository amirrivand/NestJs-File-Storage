import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { createDiskProvider } from '../providers/dynamic-disk.provider';
import { StorageConfig } from '../types/storage-config.type';
import { FileStorageService } from './file-storage.service';

/**
 * Usage:
 * FileStorageModule.forRootAsync({
 *   imports: [ConfigModule],
 *   inject: [ConfigService],
 *   useFactory: async (configService: ConfigService) => ({
 *     default: 's3',
 *     disks: await configService.getDisksFromDb(),
 *   }),
 * })
 */
export interface FileStorageModuleAsyncOptions {
  isGlobal?: boolean;
  imports?: any[];
  inject?: any[];
  useExisting?: Type<any>;
  useClass?: Type<any>;
  useFactory?: (...args: any[]) => Promise<StorageConfig> | StorageConfig;
  providers?: Provider[];
}

@Module({})
export class FileStorageModule {
  static forRoot({ isGlobal, ...config }: StorageConfig & { isGlobal?: boolean }): DynamicModule {
    const diskProviders: Provider[] = Object.keys(config.disks).map((diskName) =>
      createDiskProvider(diskName, (storage: FileStorageService) => storage.disk(diskName)),
    );
    return {
      global: isGlobal ?? false,
      module: FileStorageModule,
      providers: [
        { provide: 'STORAGE_CONFIG', useValue: config },
        FileStorageService,
        ...diskProviders,
      ],
      exports: [FileStorageService, ...diskProviders],
    };
  }

  static forRootAsync(options: FileStorageModuleAsyncOptions): DynamicModule {
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
      useFactory: async (storage: FileStorageService, config: StorageConfig) => {
        return Object.keys(config.disks).map((diskName) =>
          createDiskProvider(diskName, (storage: FileStorageService) => storage.disk(diskName)),
        );
      },
      inject: [FileStorageService, 'STORAGE_CONFIG'],
    };
    return {
      global: options.isGlobal ?? false,
      module: FileStorageModule,
      imports: options.imports || [],
      providers: [
        ...(options.providers || []),
        asyncProvider,
        FileStorageService,
        diskProvidersFactory,
      ],
      exports: [FileStorageService, 'FILE_STORAGE_DISK_PROVIDERS'],
    };
  }
}
