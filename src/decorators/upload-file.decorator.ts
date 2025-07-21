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
 * @param uploadPath Optional. String or function (file, ctx) => string. If provided, will be joined with disk root for final upload path.
 * Example:
 *   uploadPath: 'avatars'
 *   uploadPath: (file, ctx) => `users/${ctx.switchToHttp().getRequest().user.id}/uploads`
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

// Flexible rule type for file validation
export type FileValidationRule =
  | { type: 'type'; allowedMimeTypes: string[]; allowedExtensions?: string[] }
  | { type: 'size'; maxSize: number; minSize?: number; whenMimeType?: string | string[] }
  | {
      type: 'custom';
      validate: (file: Express.Multer.File) => boolean | Promise<boolean>;
      message: string;
    };
