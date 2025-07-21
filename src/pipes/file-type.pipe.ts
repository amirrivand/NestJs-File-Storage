import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

export interface FileTypePipeOptions {
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
}

@Injectable()
export class FileTypePipe implements PipeTransform {
  constructor(private readonly options: FileTypePipeOptions) {}

  transform(file: Express.Multer.File) {
    if (
      this.options.allowedMimeTypes &&
      !this.options.allowedMimeTypes.includes(file.mimetype)
    ) {
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
