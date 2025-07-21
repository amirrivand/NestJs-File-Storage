import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

export interface FileSizePipeOptions {
  minSize?: number; // in bytes
  maxSize?: number; // in bytes
}

@Injectable()
export class FileSizePipe implements PipeTransform {
  constructor(private readonly options: FileSizePipeOptions) {}

  transform(file: Express.Multer.File) {
    if (this.options.minSize && file.size < this.options.minSize) {
      throw new BadRequestException(
        `File is too small. Minimum size is ${this.options.minSize} bytes.`,
      );
    }
    if (this.options.maxSize && file.size > this.options.maxSize) {
      throw new BadRequestException(
        `File is too large. Maximum size is ${this.options.maxSize} bytes.`,
      );
    }
    return file;
  }
}
