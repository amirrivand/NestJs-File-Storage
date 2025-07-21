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

export const FILE_UPLOAD_OPTIONS_KEY = 'fileUploadOptions';

export function UploadFile(
  fieldName: string,
  options: Omit<FileUploadInterceptorOptions, 'fieldName' | 'isArray'>,
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    SetMetadata(FILE_UPLOAD_OPTIONS_KEY, {
      ...options,
      fieldName,
      isArray: false,
    })(target, propertyKey, descriptor);
    UseInterceptors(FileUploadInterceptor)(target, propertyKey, descriptor);
    return descriptor;
  };
}

export const UploadedFile = createParamDecorator(
  (data, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return req.uploadedFile;
  },
);
