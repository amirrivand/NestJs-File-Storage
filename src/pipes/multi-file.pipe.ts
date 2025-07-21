import {
  PipeTransform,
  Injectable,
  BadRequestException,
  ArgumentMetadata,
} from '@nestjs/common';

@Injectable()
export class MultiFilePipe implements PipeTransform {
  constructor(private readonly pipes: PipeTransform[] = []) {}

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
