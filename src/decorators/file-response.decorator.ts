import { ExecutionContext } from '@nestjs/common';
import { Response } from 'express';
import { FileStorageService } from '../lib/file-storage.service';

/**
 * Decorator to send a file as a response from a controller method.
 * @param disk The disk name to use for file retrieval.
 * @param getPath Function to extract the file path from the execution context.
 * @param download Whether to force file download (Content-Disposition: attachment).
 * @returns A method decorator that pipes the file stream to the response.
 */
export function FileResponse<T>(
  disk: string,
  getPath: (ctx: ExecutionContext) => string,
  download = false,
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    descriptor.value = async function (...args: any[]) {
      const ctx: ExecutionContext = args[args.length - 1];
      const req = ctx.switchToHttp().getRequest();
      const res: Response = ctx.switchToHttp().getResponse();
      const storage: FileStorageService<T> =
        req.fileStorageService || req.app.get(FileStorageService<T>);
      const path = getPath(ctx);
      const stream = storage.disk(disk).createReadStream(path);
      if (download) {
        res.setHeader('Content-Disposition', `attachment; filename="${path.split('/').pop()}"`);
      }
      stream.pipe(res);
    };
    return descriptor;
  };
}
