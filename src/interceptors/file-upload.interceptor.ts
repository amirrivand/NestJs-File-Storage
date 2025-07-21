import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import multer from 'multer';
import { Observable } from 'rxjs';
import { FileValidationRule } from '../decorators/upload-file.decorator';
import { FileStorageService } from '../lib/file-storage.service';

export interface FileUploadInterceptorOptions {
  fieldName: string;
  disk: string;
  maxCount?: number;
  rules?: FileValidationRule[];
  isArray?: boolean;
}

@Injectable()
export class FileUploadInterceptor implements NestInterceptor {
  private upload: ReturnType<typeof multer>;

  constructor(
    private readonly storage: FileStorageService,
    private readonly options: FileUploadInterceptorOptions,
  ) {
    this.upload = multer({ storage: multer.memoryStorage() });
  }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req: any = context.switchToHttp().getRequest();
    const uploadHandler = this.options.isArray
      ? this.upload.array(this.options.fieldName, this.options.maxCount)
      : this.upload.single(this.options.fieldName);

    await new Promise<void>((resolve, reject) => {
      uploadHandler(req, req.res, (err: any) => {
        if (err) return reject(new BadRequestException(err.message));
        resolve();
      });
    });

    let files: Express.Multer.File[] = [];
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
    const storedFiles = [];
    for (const file of files) {
      const storagePath = file.originalname; // You may want to generate a unique name
      await this.storage.disk(this.options.disk).put(storagePath, file.buffer);
      storedFiles.push({ ...file, storagePath });
    }

    if (this.options.isArray) {
      req['uploadedFiles'] = storedFiles;
    } else {
      req['uploadedFile'] = storedFiles[0];
    }

    return next.handle();
  }
}
