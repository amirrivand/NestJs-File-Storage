import {
  UseInterceptors,
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import {
  FileUploadInterceptor,
  FileUploadInterceptorOptions,
} from '../interceptors/file-upload.interceptor';

export const FILES_UPLOAD_OPTIONS_KEY = 'filesUploadOptions';

export function UploadFiles(
  fieldName: string,
  options: Omit<FileUploadInterceptorOptions, 'fieldName' | 'isArray'>,
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    SetMetadata(FILES_UPLOAD_OPTIONS_KEY, {
      ...options,
      fieldName,
      isArray: true,
    })(target, propertyKey, descriptor);
    UseInterceptors(FileUploadInterceptor)(target, propertyKey, descriptor);
    return descriptor;
  };
}

export const UploadedFiles = createParamDecorator((data, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return req.uploadedFiles;
});
