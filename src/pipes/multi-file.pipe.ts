import {
  PipeTransform,
  Injectable,
  BadRequestException,
  ArgumentMetadata,
} from '@nestjs/common';

/**
 * Pipe for applying multiple pipes to an array of uploaded files.
 */
@Injectable()
export class MultiFilePipe implements PipeTransform {
  /**
   * Create a new MultiFilePipe.
   * @param pipes Array of pipes to apply to each file.
   */
  constructor(private readonly pipes: PipeTransform[] = []) {}

  /**
   * Applies all pipes to each file in the array.
   * @param files Array of uploaded files.
   * @param metadata Argument metadata.
   * @returns The array of files if all are valid.
   * @throws BadRequestException if any file is invalid.
   */
  async transform(files: Express.Multer.File[], metadata: ArgumentMetadata) {
    if (!Array.isArray(files)) {
      throw new BadRequestException('Expected an array of files');
    }
    for (const file of files) {
      for (const pipe of this.pipes) {
        await pipe.transform(file, metadata);
      }
    }
    return files;
  }
}
