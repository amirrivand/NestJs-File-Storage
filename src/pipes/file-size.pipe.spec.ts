import 'reflect-metadata';
import { FileSizePipe } from './file-size.pipe';
import { BadRequestException } from '@nestjs/common';

describe('FileSizePipe', () => {
  it('should pass file within size limits', () => {
    const pipe = new FileSizePipe({ minSize: 10, maxSize: 100 });
    const file = { size: 50 } as any;
    expect(pipe.transform(file)).toBe(file);
  });

  it('should throw if file is too small', () => {
    const pipe = new FileSizePipe({ minSize: 10 });
    const file = { size: 5 } as any;
    expect(() => pipe.transform(file)).toThrow(BadRequestException);
  });

  it('should throw if file is too large', () => {
    const pipe = new FileSizePipe({ maxSize: 10 });
    const file = { size: 20 } as any;
    expect(() => pipe.transform(file)).toThrow(BadRequestException);
  });
});