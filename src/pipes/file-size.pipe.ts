import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

/**
 * Options for file size validation.
 */
export interface FileSizePipeOptions {
  minSize?: number; // in bytes
  maxSize?: number; // in bytes
}

/**
 * Pipe for validating the size of uploaded files.
 */
@Injectable()
export class FileSizePipe implements PipeTransform {
  /**
   * Create a new FileSizePipe.
   * @param options File size validation options.
   */
  constructor(private readonly options: FileSizePipeOptions) {}

  /**
   * Validates the size of the uploaded file.
   * @param file The uploaded file.
   * @returns The file if valid.
   * @throws BadRequestException if the file size is invalid.
   */
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
