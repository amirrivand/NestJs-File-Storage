import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { FileStorageService } from '../lib/file-storage.service';

@Injectable()
export class FileStorageInterceptor implements NestInterceptor {
  constructor(
    private readonly storage: FileStorageService,
    private readonly disk: string,
    private readonly options?: { visibility?: 'public' | 'private' },
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    if (request.file) {
      const path = request.file.originalname;
      await this.storage
        .disk(this.disk)
        .put(path, request.file.buffer, this.options);
      request.file.storagePath = path;
    }
    return next.handle();
  }
}
