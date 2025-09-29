import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { FileStorageService } from '../lib/file-storage.service';

/**
 * Interceptor for storing uploaded files using the FileStorageService.
 * Stores the file on the specified disk and attaches the storage path to the request.
 */
@Injectable()
export class FileStorageInterceptor<T> implements NestInterceptor {
  /**
   * Create a new FileStorageInterceptor.
   * @param storage The file storage service.
   * @param disk The disk to use for storage.
   * @param options Optional visibility settings.
   */
  constructor(
    private readonly storage: FileStorageService<T>,
    private readonly disk: string,
    private readonly options?: { visibility?: 'public' | 'private'; ContentType?: string },
  ) {}

  /**
   * Intercepts requests and stores uploaded files on the specified disk.
   * @param context The execution context.
   * @param next The call handler.
   * @returns An observable for the next handler.
   */
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    if (request.file) {
      const path = request.file.originalname;
      await this.storage.disk(this.disk).put(path, request.file.buffer, this.options);
      request.file.storagePath = path;
    }
    return next.handle();
  }
}
