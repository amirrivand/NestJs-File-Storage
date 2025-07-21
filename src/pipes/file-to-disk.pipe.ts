import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import { FileStorageService } from '../lib/file-storage.service';

@Injectable()
export class FileToDiskPipe implements PipeTransform {
  constructor(
    private readonly storage: FileStorageService,
    private readonly disk: string,
    private readonly options?: { visibility?: 'public' | 'private' },
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async transform(file: Express.Multer.File, metadata: ArgumentMetadata) {
    const path = file.originalname; // You may want to generate a unique name
    await this.storage.disk(this.disk).put(path, file.buffer, this.options);
    return path;
  }
}
