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

/**
 * Decorator for uploading multiple files. Applies file upload options and interceptor.
 * @param fieldName The field name for the files input.
 * @param options Additional upload options (except fieldName and isArray).
 * @returns A decorator to use on controller methods.
 */
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

/**
 * Parameter decorator to access the uploaded files from the request.
 * @param data Not used.
 * @param ctx Execution context.
 * @returns The uploaded files from the request.
 */
export const UploadedFiles = createParamDecorator((data, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return req.uploadedFiles;
});
