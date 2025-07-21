import { ExecutionContext } from '@nestjs/common';
import { Response } from 'express';
import { FileStorageService } from '../lib/file-storage.service';

export function FileResponse(
  disk: string,
  getPath: (ctx: ExecutionContext) => string,
  download = false,
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    descriptor.value = async function (...args: any[]) {
      const ctx: ExecutionContext = args[args.length - 1];
      const req = ctx.switchToHttp().getRequest();
      const res: Response = ctx.switchToHttp().getResponse();
      const storage: FileStorageService =
        req.fileStorageService || req.app.get(FileStorageService);
      const path = getPath(ctx);
      const stream = storage.disk(disk).createReadStream(path);
      if (download) {
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${path.split('/').pop()}"`,
        );
      }
      stream.pipe(res);
    };
    return descriptor;
  };
}
