import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { FileStorageService } from './file-storage.service';
import { StorageConfig } from '../types/storage-config.type';

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
  imports?: any[];
  inject?: any[];
  useExisting?: Type<any>;
  useClass?: Type<any>;
  useFactory?: (...args: any[]) => Promise<StorageConfig> | StorageConfig;
  providers?: Provider[];
}

@Module({})
export class FileStorageModule {
  static forRoot(config: StorageConfig): DynamicModule {
    return {
      module: FileStorageModule,
      providers: [{ provide: 'STORAGE_CONFIG', useValue: config }, FileStorageService],
      exports: [FileStorageService],
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
    return {
      module: FileStorageModule,
      imports: options.imports || [],
      providers: [...(options.providers || []), asyncProvider, FileStorageService],
      exports: [FileStorageService],
    };
  }

  static forRootGlobal(config: StorageConfig): DynamicModule {
    return {
      global: true,
      module: FileStorageModule,
      providers: [{ provide: 'STORAGE_CONFIG', useValue: config }, FileStorageService],
      exports: [FileStorageService],
    };
  }

  static forRootAsyncGlobal(options: FileStorageModuleAsyncOptions): DynamicModule {
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
    return {
      global: true,
      module: FileStorageModule,
      imports: options.imports || [],
      providers: [...(options.providers || []), asyncProvider, FileStorageService],
      exports: [FileStorageService],
    };
  }
}
