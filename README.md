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
- **Flexible Filename Generation**: Global and per-upload filename generator support

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
- [Filename Generation](#-filename-generation)
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
import { FilenameGenerator } from '@nestjs/fs';

const myGlobalFilenameGenerator: FilenameGenerator = (file, context) => {
  // Example: Add timestamp to filename
  const ext = file.originalname.split('.').pop();
  return `${Date.now()}-${file.fieldname}.${ext}`;
};

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
  filenameGenerator: myGlobalFilenameGenerator, // 👈 Add global filename generator
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

### Per-upload filenameGenerator (Override)

```ts
import { Controller, Post } from '@nestjs/common';
import { UploadFile, UploadedFile, StoredFile } from '@nestjs/fs';

@Controller('files')
export class FileController {
  @Post('upload-custom')
  @UploadFile('file', {
    disk: 'local',
    filenameGenerator: (file, ctx) => {
      // Example: Add userId from token to filename
      const userId = ctx.switchToHttp().getRequest().user?.id ?? 'anon';
      const ext = file.originalname.split('.').pop();
      return `${userId}-${Date.now()}.${ext}`;
    },
  })
  async upload(@UploadedFile() file: StoredFile) {
    return file;
  }
}
```

---

## 🏷️ Filename Generation

### Priority

- If `filenameGenerator` is set in the decorator (per-upload), it will be used.
- Otherwise, the global `filenameGenerator` from the module config will be used (if set).
- If neither is set, the default logic is used: the original filename, with a counter if a file with the same name exists.

### API

```ts
type FilenameGenerator = (file: Express.Multer.File, context: ExecutionContext) => Promise<string> | string;
```

- You can set this function globally in the module config as `filenameGenerator`.
- Or override it per-upload in the decorator options.

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
- **Flexible FileValidationRule**: Use the `rules` option in upload decorators for advanced validation

### FileValidationRule (rules)

You can use the `rules` property in upload decorators to define flexible validation logic for uploaded files. Rules can be combined as an array.

#### Type Rule
```ts
@UploadFile('file', {
  disk: 'local',
  rules: [
    { type: 'type', allowedMimeTypes: ['image/png', 'image/jpeg'], allowedExtensions: ['png', 'jpg', 'jpeg'] },
  ],
})
```

#### Size Rule
```ts
@UploadFile('file', {
  disk: 'local',
  rules: [
    { type: 'size', maxSize: 5 * 1024 * 1024, minSize: 1024 }, // 1KB - 5MB
  ],
})
```

#### Custom Rule
```ts
@UploadFile('file', {
  disk: 'local',
  rules: [
    {
      type: 'custom',
      validate: async (file) => file.originalname.startsWith('invoice_'),
      message: 'Filename must start with invoice_.'
    },
  ],
})
```

**Rule Types:**
- `type`: Restrict by MIME type and/or file extension
- `size`: Restrict by file size (min/max, optionally per MIME type)
- `custom`: Provide any async/sync validation logic

You can use these rules in both `@UploadFile` and `@UploadFiles` decorators.

---

## 🔗 Temporary/Signed URLs

You can generate temporary (signed) URLs for files using the `getTemporaryUrl` method on the `FileStorageService` or directly on the driver. This allows you to share a file for a limited time, optionally restricted to a specific IP or device (if supported).

### Usage

```ts
// Inject FileStorageService
const url = await fileStorageService.getTemporaryUrl(
  'path/to/file.txt',
  600, // expires in 600 seconds (10 minutes)
  { ip: '1.2.3.4', deviceId: 'abc123' }, // optional, only for local
  'local' // disk name (optional, default is default disk)
);
```

### Options
- `expiresIn`: Expiration time in seconds (default: 3600)
- `ip`: (Optional, only for local) Restrict link to a specific IP
- `deviceId`: (Optional, only for local) Restrict link to a specific device (must be sent as `x-device-id` header)

### Driver Support
- **Local**: Supported. Generates a signed URL with a token, validates expiration, IP, and device if provided.
- **S3**: Supported. Generates a signed URL with expiration. IP/device restriction is NOT supported (throws error if used).
- **FTP, SFTP, Dropbox, Google Drive**: Not supported. Throws an error if called.

### Example: S3
```ts
const url = await fileStorageService.getTemporaryUrl('myfile.txt', 900, undefined, 's3');
// url is a signed AWS S3 URL valid for 15 minutes
```

### Example: Local
```ts
const url = await fileStorageService.getTemporaryUrl('myfile.txt', 600, { ip: '1.2.3.4' }, 'local');
// url is something like http://localhost:3000/files/temp?token=...
// You need to implement a route to serve this (see below)
```

### Serving Local Temp Links
For local driver, you must implement an endpoint (e.g., `/files/temp?token=...`) that:
- Validates the token using `LocalStorageDriver.validateTempToken(token, req)`
- Streams the file if valid, or returns 404/403 if invalid/expired

Example (NestJS):
```ts
@Get('files/temp')
async serveTemp(@Query('token') token: string, @Req() req: Request, @Res() res: Response) {
  const relPath = LocalStorageDriver.validateTempToken(token, req);
  if (!relPath) return res.status(403).send('Invalid or expired link');
  const stream = fileStorageService.disk('local').createReadStream(relPath);
  stream.pipe(res);
}
```

---

## 🏷️ Types

- **StoredFile**: The type returned by `@UploadedFile()` and each item in `@UploadedFiles()`. Extends `Express.Multer.File` with a `storagePath` property.
- **FilenameGenerator**: `(file: Express.Multer.File, context: ExecutionContext) => Promise<string> | string;`

---

## 📄 License

MIT
