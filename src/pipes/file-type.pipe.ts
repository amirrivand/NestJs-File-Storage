import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

/**
 * Options for file type validation.
 */
export interface FileTypePipeOptions {
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
}

/**
 * Pipe for validating the type and extension of uploaded files.
 */
@Injectable()
export class FileTypePipe implements PipeTransform {
  /**
   * Create a new FileTypePipe.
   * @param options File type validation options.
   */
  constructor(private readonly options: FileTypePipeOptions) {}

  /**
   * Validates the type and extension of the uploaded file.
   * @param file The uploaded file.
   * @returns The file if valid.
   * @throws BadRequestException if the file type or extension is invalid.
   */
  transform(file: Express.Multer.File) {
    if (this.options.allowedMimeTypes && !this.options.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(`Invalid file type: ${file.mimetype}`);
    }
    if (this.options.allowedExtensions) {
      const ext = file.originalname.split('.').pop()?.toLowerCase();
      if (!ext || !this.options.allowedExtensions.includes(ext)) {
        throw new BadRequestException(`Invalid file extension: .${ext}`);
      }
    }
    return file;
  }
}
