import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { FileStorageService } from '../lib/file-storage.service';
import multer from 'multer';

export interface FileUploadInterceptorOptions {
  fieldName: string;
  disk: string;
  maxCount?: number;
  validators?: Array<{ transform: (file: Express.Multer.File) => any }>;
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

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
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
    if (this.options.validators) {
      for (const file of files) {
        for (const validator of this.options.validators) {
          await validator.transform(file);
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
