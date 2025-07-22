import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import multer from 'multer';
import { createReadStream, unlink } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { Observable } from 'rxjs';
import { StoredFile } from 'src/types/stored-file.type';
import { FileValidationRule } from '../decorators/upload-file.decorator';
import { FileStorageService } from '../lib/file-storage.service';

const unlinkAsync = promisify(unlink);

export interface FileUploadInterceptorOptions {
  fieldName: string;
  disk: string;
  maxCount?: number;
  rules?: FileValidationRule[];
  isArray?: boolean;
  filenameGenerator?: (
    file: Express.Multer.File,
    context: ExecutionContext,
  ) => Promise<string> | string;
  uploadPath?:
    | string
    | ((file: Express.Multer.File, context: ExecutionContext) => string | Promise<string>);
}

@Injectable()
export class FileUploadInterceptor implements NestInterceptor {
  private upload: ReturnType<typeof multer>;

  constructor(
    private readonly storage: FileStorageService,
    private readonly options: FileUploadInterceptorOptions,
  ) {
    this.upload = multer({
      storage: multer.diskStorage({
        destination: (req, file, cb) => {
          cb(null, os.tmpdir()); // Use system temp dir or make configurable
        },
        filename: (req, file, cb) => {
          cb(null, `${Date.now()}-${file.originalname}`);
        },
      }),
    });
  }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req: Request = context.switchToHttp().getRequest();
    const res: Response = context.switchToHttp().getResponse();
    const uploadHandler = this.options.isArray
      ? this.upload.array(this.options.fieldName, this.options.maxCount)
      : this.upload.single(this.options.fieldName);

    // Track temp file paths for cleanup
    let tempFilePaths: string[] = [];
    let files: Express.Multer.File[] = [];
    try {
      await new Promise<void>((resolve, reject) => {
        uploadHandler(req, res, (err: any) => {
          if (err) return reject(new BadRequestException(err.message));
          resolve();
        });
      });

      if (this.options.isArray) {
        if (Array.isArray(req.files)) {
          files = req.files as Express.Multer.File[];
        } else if (req.files && typeof req.files === 'object') {
          files = Object.values(req.files).flat() as Express.Multer.File[];
        }
      } else if (req.file) {
        files = [req.file];
      }
      if (!files || files.length === 0) {
        throw new BadRequestException('No file uploaded');
      }
      tempFilePaths = files.map((f) => f.path);

      // Validation
      if (this.options.rules) {
        for (const file of files) {
          for (const rule of this.options.rules) {
            if (rule.type === 'type') {
              if (!rule.allowedMimeTypes.includes(file.mimetype)) {
                throw new BadRequestException('Invalid file type');
              }
              if (rule.allowedExtensions) {
                const ext = file.originalname.split('.').pop()?.toLowerCase();
                if (!ext || !rule.allowedExtensions.map((e) => e.toLowerCase()).includes(ext)) {
                  throw new BadRequestException('Invalid file extension');
                }
              }
            } else if (rule.type === 'size') {
              const matchMime =
                !rule.whenMimeType ||
                (Array.isArray(rule.whenMimeType)
                  ? rule.whenMimeType.includes(file.mimetype)
                  : rule.whenMimeType === file.mimetype);
              if (matchMime) {
                if (file.size > rule.maxSize) {
                  throw new BadRequestException(`File too large (max ${rule.maxSize} bytes)`);
                }
                if (rule.minSize && file.size < rule.minSize) {
                  throw new BadRequestException(`File too small (min ${rule.minSize} bytes)`);
                }
              }
            } else if (rule.type === 'custom') {
              const valid = await rule.validate(file);
              if (!valid) throw new BadRequestException(rule.message);
            }
          }
        }
      }

      // Store files
      const storedFiles: StoredFile[] = [];
      for (const file of files) {
        // 0. Determine disk root path
        const diskRoot = (this.storage.config?.disks[this.options.disk] as any)?.root || false;
        // 1. Determine upload directory
        let uploadDir = '';
        if (this.options.uploadPath) {
          if (typeof this.options.uploadPath === 'function') {
            uploadDir = await this.options.uploadPath(file, context);
          } else {
            uploadDir = this.options.uploadPath;
          }
        }
        // 2. Generate filename
        let filename: string;
        if (this.options.filenameGenerator) {
          filename = await this.options.filenameGenerator(file, context);
        } else if (this.storage.config?.filenameGenerator) {
          filename = await this.storage.config.filenameGenerator(file, context);
        } else {
          filename = file.originalname;
        }
        // 4. Build final storage path
        let candidate = filename;
        let storagePath = join(...[diskRoot, uploadDir, candidate].filter(Boolean));
        const ext = filename.includes('.') ? '.' + filename.split('.').pop() : '';
        const base = ext ? filename.slice(0, -ext.length) : filename;

        const disk = this.storage.disk(this.options.disk);

        if (!disk) {
          throw new UnprocessableEntityException(`Disk ${this.options.disk} not found`);
        }

        let counter = 1;
        while (await disk.exists(storagePath)) {
          candidate = `${base}(${counter})${ext}`;
          storagePath = join(...[diskRoot, uploadDir, candidate].filter(Boolean));
          counter++;
        }
        filename = candidate;

        // Use stream for upload
        const fileStream = createReadStream(file.path);
        if (typeof disk.putStream === 'function') {
          await disk.putStream(storagePath, fileStream);
        } else {
          // fallback: read file as buffer
          const chunks: Buffer[] = [];
          for await (const chunk of fileStream) {
            chunks.push(chunk);
          }
          await disk.put(storagePath, Buffer.concat(chunks));
        }
        await unlinkAsync(file.path); // Clean up temp file after successful upload
        // Remove from tempFilePaths so we don't try to delete again in finally
        tempFilePaths = tempFilePaths.filter((p) => p !== file.path);
        storedFiles.push({
          buffer: file.buffer,
          fieldname: file.fieldname,
          originalname: file.originalname,
          encoding: file.encoding,
          mimetype: file.mimetype,
          disk: this.options.disk,
          storagePath,
          filename,
          size: file.size,
          stream: file.stream,
        });
      }

      if (this.options.isArray) {
        req['uploadedFiles'] = storedFiles;
      } else {
        req['uploadedFile'] = storedFiles[0];
      }

      return next.handle();
    } finally {
      // Clean up any remaining temp files (on error or after upload)
      for (const path of tempFilePaths) {
        try {
          await unlinkAsync(path);
        } catch (e) {
          // ignore error if file already deleted or doesn't exist
        }
      }
    }
  }
}
