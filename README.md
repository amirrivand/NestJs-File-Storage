# @amirrivand/nestjs-file-storage

> **A powerful, multi-driver file storage solution for NestJS, inspired by Laravel Flysystem.**

[![npm version](https://img.shields.io/npm/v/@amirrivand/nestjs-file-storage.svg?style=flat-square)](https://www.npmjs.com/package/@amirrivand/nestjs-file-storage)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![NestJS](https://img.shields.io/badge/nestjs-ready-brightgreen.svg)](https://nestjs.com/)

---

## 🚀 Features

- **Multi-driver**: Local, S3, FTP, SFTP, Dropbox, Google Drive, Buffer (in-memory)
- **Unified API**: Consistent, extensible, and type-safe
- **Advanced Operations**: Upload, download, streaming, metadata, visibility, URLs, temp URLs, prepend/append, copy/move
- **Stream Support**: Upload files directly from streams with `putStream` method
- **Timed/Expiring Files**: Upload files with automatic expiration using `putTimed` and `deleteExpiredFiles`
- **Scoped & Read-Only Disks**: Restrict access or scope to subfolders
- **NestJS-Native**: Decorators, pipes, guards, interceptors, DTOs, async module registration
- **Internal Upload Solution**: Seamless file handling in controllers
- **Validation**: File type, size, and multi-file validation pipes
- **Async/Dynamic Disks**: Register disks at runtime from config/db
- **Flexible Filename Generation**: Global and per-upload filename generator support
- **Visibility Management**: Set and get file visibility (public/private) across drivers

---

## 📦 Installation

```sh
yarn add @amirrivand/nestjs-file-storage
```

---

## ☁️ Cloud Storage Preparation

<details>
<summary><strong>Google Drive Preparation</strong></summary>

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (or select an existing one).
3. Navigate to <strong>APIs & Services &rarr; Library</strong> and enable the <strong>Google Drive API</strong>.
4. Go to <strong>APIs & Services &rarr; Credentials</strong>.
5. Click <strong>Create Credentials</strong> &rarr; <strong>OAuth client ID</strong> or <strong>Service account</strong> (recommended for server-side):
   - For <strong>Service account</strong>:
     - Create a new service account and download the JSON key file.
     - Share the target Google Drive folder with the service account email.
   - For <strong>OAuth client ID</strong>:
     - Set up consent screen and download the client ID/secret.
6. Store the credentials securely and provide them in your disk config (see below).
7. (Optional) Set folder permissions as needed for your use case.

</details>

<details>
<summary><strong>Dropbox Preparation</strong></summary>

1. Go to the [Dropbox App Console](https://www.dropbox.com/developers/apps).
2. Click <strong>Create App</strong>.
3. Choose <strong>Scoped access</strong> and select <strong>Full dropbox</strong> or <strong>App folder</strong> access as needed.
4. Name your app and create it.
5. Under <strong>Permissions</strong>, enable the required scopes (e.g., files.content.write, files.content.read).
6. Go to <strong>Settings</strong> and generate an <strong>Access Token</strong> (for development) or set up OAuth 2.0 for production.
7. Copy the <strong>App key</strong>, <strong>App secret</strong>, and <strong>Access token</strong> as needed for your disk config.
8. (Optional) Set up webhook or additional permissions as required.

</details>

---

## 📚 Table of Contents

- [Quick Start](#-quick-start)
- [Configuration](#-configuration)
- [Async Module Registration](#-async-module-registration)
- [Usage Examples](#-usage-examples)
- [Filename Generation](#-filename-generation)
- [Stream Support](#-stream-support)
- [Injecting a Specific Disk](#-injecting-a-specific-disk)
- [Advanced Patterns](#-advanced-patterns)
- [NestJS Integration](#-nestjs-integration)
- [Drivers](#-drivers)
- [Validation](#-validation)
- [Temporary/Signed URLs](#-temporarysigned-urls)
- [Timed/Expiring Uploads](#-timedexpiring-uploads)
- [Types](#-types)
- [License](#-license)

---

## ⚡ Quick Start

```ts
import { FileStorageModule } from '@amirrivand/nestjs-file-storage';

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
import { FilenameGenerator } from '@amirrivand/nestjs-file-storage';

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
import { UploadFile, UploadedFile, FileTypePipe, StoredFile } from '@amirrivand/nestjs-file-storage';

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
import { UploadFiles, UploadedFiles, FileSizePipe, StoredFile } from '@amirrivand/nestjs-file-storage';

@Post('multi-upload')
@UploadFiles('files', { disk: 's3', validators: [new FileSizePipe({ maxSize: 5 * 1024 * 1024 })] })
async uploadMany(@UploadedFiles() files: StoredFile[]) {
  // files is an array of StoredFile
  return files;
}
```

### File Download/Streaming

```ts
import { FileResponse } from '@amirrivand/nestjs-file-storage';

@Get('download/:path')
@FileResponse('local', ctx => ctx.switchToHttp().getRequest().params.path, true)
async download() {}
```

### Per-upload filenameGenerator (Override)

```ts
import { Controller, Post } from '@nestjs/common';
import { UploadFile, UploadedFile, StoredFile } from '@amirrivand/nestjs-file-storage';

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

## 🌊 Stream Support

The library supports uploading files directly from streams using the `putStream` method. This is useful for handling large files or when you want to avoid loading the entire file into memory.

### Usage

```ts
import { FileStorageService } from '@amirrivand/nestjs-file-storage';
import { createReadStream } from 'fs';

// Upload from file stream
const stream = createReadStream('./large-file.zip');
await fileStorageService.putStream('uploads/large-file.zip', stream, {
  visibility: 'public',
  ContentType: 'application/zip'
}, 's3');

// Upload from HTTP request stream
@Post('upload-stream')
async uploadStream(@Req() req: Request) {
  const stream = req;
  await fileStorageService.putStream('uploads/from-stream.txt', stream, {
    visibility: 'private'
  }, 'local');
}
```

### Driver Support

| Driver | Stream Support | Notes |
|--------|----------------|-------|
| Local | ✅ | Full support |
| S3 | ✅ | Full support with AWS SDK |
| FTP | ⚠️ | Limited support |
| SFTP | ⚠️ | Limited support |
| Dropbox | ⚠️ | Limited support |
| Google Drive | ⚠️ | Limited support |
| Buffer | ✅ | Full support |

For drivers with limited stream support, the library automatically falls back to buffering the stream content.

---

## 🧲 Injecting a Specific Disk

You can inject a specific disk instance directly into your providers or controllers using the `@InjectDisk()` decorator. This is useful when you want to work with a specific disk (e.g., 'local', 's3') and need direct access to the `FileStorageService` for that disk.

```ts
import { Controller } from '@nestjs/common';
import { StorageDriver } from '@amirrivand/nestjs-file-storage';
import { InjectDisk } from '@amirrivand/nestjs-file-storage';

@Controller('files')
export class FileController {
  constructor(
    @InjectDisk('local')
    private readonly localDisk: StorageDriver,
  ) {}

  // ... your endpoints using this.fileStorageService
}
```

- The string passed to `@InjectDisk('local')` should match the disk name defined in your `FileStorageModule` configuration.
- The injected value is the disk's `StorageDriver` (e.g., Local, S3). Use its methods like `put`, `get`, `delete`, etc.
 - If you register the module with `forRootAsync`, you must also list that disk in the module option `injectables` so the provider token is available (see below).

---

## 🔄 Async Module Registration

When configuring the module asynchronously, you can expose specific disks for injection via the `injectables` option. This makes tokens like `FILE_STORAGE_DISK_LOCAL` available so `@InjectDisk('local')` works.

```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FileStorageModule } from '@amirrivand/nestjs-file-storage';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    FileStorageModule.forRootAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        default: 'local',
        disks: {
          local: { driver: 'local', root: config.get<string>('FS_ROOT')! },
          s3: {
            driver: 's3',
            accessKeyId: config.get<string>('AWS_ACCESS_KEY_ID')!,
            secretAccessKey: config.get<string>('AWS_SECRET_ACCESS_KEY')!,
            region: config.get<string>('AWS_REGION')!,
            bucket: config.get<string>('AWS_BUCKET')!,
          },
        },
      }),
      // List disks you want to inject via @InjectDisk('...')
      injectables: ['local', 's3'],
    }),
  ],
})
export class AppModule {}
```

Notes:
- `injectables` should contain the exact disk keys you plan to inject with `@InjectDisk('...')`.
- If you do not need to inject disks directly, you can omit `injectables` and just use `FileStorageService` with `storage.disk('name')`.

Type-safety tip:
- `injectables` is typed as `(keyof DiskObjectValidation<T>)[]` based on your config generic `T`, so disk names are validated at compile time when you use generics.

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

- **Decorators**: `@UploadFile`, `@UploadFiles`, `@FileResponse`, `@InjectDisk`
- **Pipes**: `FileTypePipe`, `FileSizePipe`, `MultiFilePipe`, `FileToDiskPipe`
- **Guards**: `FilePermissionGuard`
- **Interceptors**: `FileUploadInterceptor`, `FileStorageInterceptor`
- **DTOs**: `FileUploadDto`, `FileDownloadDto`
- **Async Providers**: `createDiskProvider`

### FileToDiskPipe

The `FileToDiskPipe` allows you to store uploaded files directly to a specific disk using the `FileStorageService`.

```ts
import { FileToDiskPipe } from '@amirrivand/nestjs-file-storage';

@Post('upload-to-disk')
async uploadFile(
  @Body('file', new FileToDiskPipe(fileStorageService, 's3', { visibility: 'public' }))
  storagePath: string
) {
  return { message: 'File uploaded', path: storagePath };
}
```

### FileStorageInterceptor

The `FileStorageInterceptor` automatically stores uploaded files and attaches the storage path to the request.

```ts
import { FileStorageInterceptor } from '@amirrivand/nestjs-file-storage';

@Post('upload-with-interceptor')
@UseInterceptors(new FileStorageInterceptor(fileStorageService, 'local'))
async uploadWithInterceptor(@Req() req: Request) {
  // req.file.storagePath contains the storage path
  return { path: req.file.storagePath };
}
```

---

## 🌐 Drivers

- **Local**: File system storage with metadata support
- **S3**: AWS S3 and S3-compatible services (MinIO, etc.) with object tagging and ACL management
- **FTP**: Traditional FTP server support
- **SFTP**: Secure FTP with SSH key authentication
- **Dropbox**: Cloud storage via Dropbox API
- **Google Drive**: Google Drive integration with service account authentication
- **Buffer**: In-memory storage for testing and temporary files
- **Scoped**: Restrict disk access to specific subdirectories
- **ReadOnly**: Enforce read-only access to prevent modifications

### S3 Driver Features

The S3 driver includes advanced features:

- **Object Tagging**: Automatic expiration tags for timed uploads
- **ACL Management**: Set and get object visibility (public/private)
- **Signed URLs**: Generate temporary URLs with expiration
- **Stream Support**: Direct stream uploads without buffering
- **Metadata**: Full file metadata including size, content type, and last modified
- **Bulk Operations**: Efficient listing and deletion of files

```ts
// S3-specific operations
await s3Driver.setVisibility('file.txt', 'public');
const visibility = await s3Driver.getVisibility('file.txt');

// Object tagging for expiration
await s3Driver.putTimed('temp-file.txt', content, { ttl: 3600 });
await s3Driver.deleteExpiredFiles(); // Removes all expired files
```

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

## ⏳ Timed/Expiring Uploads

You can upload files with an expiration time using the `putTimed` method. After the specified time, the file will be automatically deleted by calling `deleteExpiredFiles` (which you can schedule as a cron job or call manually).

### Usage

```ts
// Upload a file that expires in 1 hour
await fileStorageService.putTimed(
  'myfile.txt',
  buffer,
  { ttl: 3600 } // or { expiresAt: new Date(Date.now() + 3600 * 1000) }
);

// Remove all expired files (should be called periodically)
const deletedCount = await fileStorageService.deleteExpiredFiles();
```

### Options
- `ttl`: Time to live in seconds
- `expiresAt`: Absolute expiration date/time (Date object)
- `visibility`: (optional) 'public' or 'private'

### Driver Support Table
| Driver        | Expiry Metadata Location         | Auto-Delete Support | Notes |
|--------------|----------------------------------|--------------------|-------|
| Local        | `.meta.json` sidecar file        | Yes                | Full metadata support |
| S3           | S3 object tag (`expiresAt`)      | Yes                | Uses AWS object tagging |
| Buffer       | In-memory metadata               | Yes                | Perfect for testing |
| FTP          | `.ftp-expirations.json` in root  | Yes                | JSON metadata file |
| SFTP         | `.sftp-expirations.json` in root | Yes                | JSON metadata file |
| Dropbox      | `.dropbox-expirations.json`      | Yes                | JSON metadata file |
| Google Drive | `.gdrive-expirations.json`       | Yes                | JSON metadata file |

### Example: Local
```ts
await fileStorageService.putTimed('foo.txt', Buffer.from('data'), { ttl: 600 }, 'local');
// ...
await fileStorageService.deleteExpiredFiles('local');
```

### Example: S3
```ts
await fileStorageService.putTimed('foo.txt', Buffer.from('data'), { expiresAt: new Date(Date.now() + 3600 * 1000) }, 's3');
// ...
await fileStorageService.deleteExpiredFiles('s3');
```

### Example: Buffer (Testing)
```ts
await fileStorageService.putTimed('foo.txt', Buffer.from('data'), { ttl: 60 }, 'buffer');
// ...
await fileStorageService.deleteExpiredFiles('buffer');
```

### Example: FTP/SFTP/Dropbox/Google Drive
```ts
await fileStorageService.putTimed('foo.txt', Buffer.from('data'), { ttl: 1800 }, 'ftp');
// ...
await fileStorageService.deleteExpiredFiles('ftp');
```

### Notes
- For drivers with central metadata files, ensure the application has read/write access to the root directory.
- You should schedule `deleteExpiredFiles` to run periodically (e.g., with a cron job) to ensure expired files are cleaned up.
- If you use both `ttl` and `expiresAt`, `expiresAt` takes precedence.

---

## 🏷️ Types

- **StoredFile**: The type returned by `@UploadedFile()` and each item in `@UploadedFiles()`. Extends `Express.Multer.File` with a `storagePath` property.
- **FilenameGenerator**: `(file: Express.Multer.File, context: ExecutionContext) => Promise<string> | string;`

---

## 📄 License

MIT
