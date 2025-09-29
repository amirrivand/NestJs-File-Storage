import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import { FileStorageService } from '../lib/file-storage.service';

/**
 * Pipe for storing uploaded files to a specified disk using FileStorageService.
 */
@Injectable()
export class FileToDiskPipe<T> implements PipeTransform {
  /**
   * Create a new FileToDiskPipe.
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
   * Stores the uploaded file to the specified disk.
   * @param file The uploaded file.
   * @param metadata Argument metadata (not used).
   * @returns The storage path of the file.
   */
  async transform(file: Express.Multer.File, metadata: ArgumentMetadata) {
    const path = file.originalname; // You may want to generate a unique name
    await this.storage.disk(this.disk).put(path, file.buffer, this.options);
    return path;
  }
}
