import {
  UseInterceptors,
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
  applyDecorators,
} from '@nestjs/common';
import { FileUploadInterceptorOptions } from '../interceptors/file-upload.interceptor';
import { FileUploadInterceptorMixin, FileValidationRule } from './upload-file.decorator';

export const FILES_UPLOAD_OPTIONS_KEY = 'filesUploadOptions';

export function UploadFiles(
  fieldName: string,
  options: Omit<FileUploadInterceptorOptions, 'fieldName' | 'isArray'>,
) {
  const opts = { ...options, fieldName, isArray: true };
  return applyDecorators(
    SetMetadata(FILES_UPLOAD_OPTIONS_KEY, opts),
    UseInterceptors(FileUploadInterceptorMixin(opts)),
  );
}

export const UploadedFiles = createParamDecorator((data, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return req.uploadedFiles;
});
