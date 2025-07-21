# @nestjs/fs

> **A powerful, multi-driver file storage solution for NestJS, inspired by Laravel Flysystem.**

[![npm version](https://img.shields.io/npm/v/@nestjs/fs.svg?style=flat-square)](https://www.npmjs.com/package/@nestjs/fs)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![NestJS](https://img.shields.io/badge/nestjs-ready-brightgreen.svg)](https://nestjs.com/)

---

## 🚀 Features

- **Multi-driver**: Local, S3, FTP, SFTP, Dropbox, Google Drive
- **Unified API**: Consistent, extensible, and type-safe
- **Advanced Operations**: Upload, download, streaming, metadata, visibility, URLs, temp URLs, prepend/append, copy/move
- **Scoped & Read-Only Disks**: Restrict access or scope to subfolders
- **NestJS-Native**: Decorators, pipes, guards, interceptors, DTOs, async module registration
- **Internal Upload Solution**: Seamless file handling in controllers
- **Validation**: File type, size, and multi-file validation pipes
- **Async/Dynamic Disks**: Register disks at runtime from config/db

---

## 📦 Installation

```sh
npm install @nestjs/fs
# or
yarn add @nestjs/fs
```

---

## 📚 Table of Contents

- [Quick Start](#-quick-start)
- [Configuration](#-configuration)
- [Usage Examples](#-usage-examples)
- [Advanced Patterns](#-advanced-patterns)
- [NestJS Integration](#-nestjs-integration)
- [Drivers](#-drivers)
- [Validation](#-validation)
- [Types](#-types)
- [License](#-license)

---

## ⚡ Quick Start

```ts
import { FileStorageModule } from '@nestjs/fs';

@Module({
  imports: [
    FileStorageModule.forRoot({
      default: 'local',
      disks: {
        local: { driver: 'local', root: './uploads' },
        s3: { driver: 's3' /* ... */ },
        // ...
      },
    }),
  ],
})
export class AppModule {}
```

---

## ⚙️ Configuration

```ts
FileStorageModule.forRoot({
  default: 'local',
  disks: {
    local: { driver: 'local', root: './uploads' },
    s3: {
      driver: 's3',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
      bucket: process.env.AWS_BUCKET,
      endpoint: process.env.AWS_ENDPOINT,
      cdnBaseUrl: process.env.AWS_URL,
    },
    // ftp, sftp, dropbox, gdrive, ...
  },
});
```

---

## 📝 Usage Examples

### Single File Upload

```ts
import { Controller, Post } from '@nestjs/common';
import { UploadFile, UploadedFile, FileTypePipe, StoredFile } from '@nestjs/fs';

@Controller('files')
export class FileController {
  @Post('upload')
  @UploadFile('file', {
    disk: 'local',
    validators: [new FileTypePipe({ allowedMimeTypes: ['image/png'] })],
  })
  async upload(@UploadedFile() file: StoredFile) {
    // file.storagePath, file.mimetype, file.size, etc.
    return file;
  }
}
```

### Multiple File Upload

```ts
import { UploadFiles, UploadedFiles, FileSizePipe, StoredFile } from '@nestjs/fs';

@Post('multi-upload')
@UploadFiles('files', { disk: 's3', validators: [new FileSizePipe({ maxSize: 5 * 1024 * 1024 })] })
async uploadMany(@UploadedFiles() files: StoredFile[]) {
  // files is an array of StoredFile
  return files;
}
```

### File Download/Streaming

```ts
import { FileResponse } from '@nestjs/fs';

@Get('download/:path')
@FileResponse('local', ctx => ctx.switchToHttp().getRequest().params.path, true)
async download() {}
```

---

## 🧲 Injecting a Specific Disk

You can inject a specific disk instance directly into your providers or controllers using the `@InjectDisk()` decorator. This is useful when you want to work with a specific disk (e.g., 'local', 's3') and need direct access to the `FileStorageService` for that disk.

```ts
import { Controller } from '@nestjs/common';
import { FileStorageService } from '@nestjs/fs';
import { InjectDisk } from '@nestjs/fs';

@Controller('files')
export class FileController {
  constructor(
    @InjectDisk('local')
    private readonly fileStorageService: FileStorageService,
  ) {}

  // ... your endpoints using this.fileStorageService
}
```

- The string passed to `@InjectDisk('local')` should match the disk name defined in your `FileStorageModule` configuration.
- This allows you to use all methods of `FileStorageService` for the specified disk.

---

## 🧩 Advanced Patterns

- **Async Module Registration**: `FileStorageModule.forRootAsync({ ... })`
- **Scoped Disks**: Restrict a disk to a subfolder
- **Read-Only Disks**: Enforce read-only access
- **Custom Drivers**: Easily add your own
- **Guards & Policies**: Use `FilePermissionGuard` and `@FilePermissionPolicy()`
- **Validation**: Use `FileTypePipe`, `FileSizePipe`, `MultiFilePipe`

---

## 🛠️ NestJS Integration

- **Decorators**: `@UploadFile`, `@UploadFiles`, `@FileResponse`, etc.
- **Pipes**: `FileTypePipe`, `FileSizePipe`, `MultiFilePipe`
- **Guards**: `FilePermissionGuard`
- **Interceptors**: `FileUploadInterceptor`, `FileStorageInterceptor`
- **DTOs**: `FileUploadDto`, `FileDownloadDto`
- **Async Providers**: `createDiskProvider`

---

## 🌐 Drivers

- Local
- S3 (AWS, MinIO, etc.)
- FTP
- SFTP
- Dropbox
- Google Drive

---

## 🛡️ Validation

- **FileTypePipe**: Restrict by mimetype/extension
- **FileSizePipe**: Restrict by size
- **MultiFilePipe**: Validate arrays of files

---

## 🏷️ Types

- **StoredFile**: The type returned by `@UploadedFile()` and each item in `@UploadedFiles()`. Extends `Express.Multer.File` with a `storagePath` property.

---

## 📄 License

MIT
