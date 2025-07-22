import {
  UseInterceptors,
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
  applyDecorators,
  Injectable,
  Type,
  mixin,
} from '@nestjs/common';
import {
  FileUploadInterceptor,
  FileUploadInterceptorOptions,
} from '../interceptors/file-upload.interceptor';
import { FileStorageService } from '../lib/file-storage.service';

export const FILE_UPLOAD_OPTIONS_KEY = 'fileUploadOptions';

/**
 * Mixin to create a FileUploadInterceptor with custom options.
 * @param options File upload interceptor options.
 * @returns A NestJS interceptor type.
 */
export function FileUploadInterceptorMixin(
  options: FileUploadInterceptorOptions,
): Type<FileUploadInterceptor> {
  @Injectable()
  class MixinInterceptor extends FileUploadInterceptor {
    constructor(storage: FileStorageService) {
      super(storage, options);
    }
  }
  return mixin(MixinInterceptor);
}

/**
 * Decorator for uploading a single file. Applies file upload options and interceptor.
 * @param fieldName The field name for the file input.
 * @param options Additional upload options (except fieldName and isArray).
 * @returns A decorator to use on controller methods.
 */
export function UploadFile(
  fieldName: string,
  options: Omit<FileUploadInterceptorOptions, 'fieldName' | 'isArray'>,
) {
  const opts = { ...options, fieldName, isArray: false };
  return applyDecorators(
    SetMetadata(FILE_UPLOAD_OPTIONS_KEY, opts),
    UseInterceptors(FileUploadInterceptorMixin(opts)),
  );
}

export const UploadedFile = createParamDecorator((data, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return req.uploadedFile;
});

/**
 * Flexible rule type for file validation.
 * - 'type': Restrict allowed MIME types and extensions.
 * - 'size': Restrict file size.
 * - 'custom': Custom validation logic.
 */
export type FileValidationRule =
  | { type: 'type'; allowedMimeTypes: string[]; allowedExtensions?: string[] }
  | { type: 'size'; maxSize: number; minSize?: number; whenMimeType?: string | string[] }
  | {
      type: 'custom';
      validate: (file: Express.Multer.File) => boolean | Promise<boolean>;
      message: string;
    };
