import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * DTO for uploading a single file.
 */
export class FileUploadDto {
  /**
   * The file to upload (binary).
   */
  @ApiProperty({ type: 'string', format: 'binary' })
  file!: any;

  /**
   * Optional path to store the file at.
   */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  declare path?: string;

  /**
   * Optional disk to use for storage.
   */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  declare disk?: string;
}

/**
 * DTO for uploading multiple files.
 */
export class MultiFileUploadDto {
  /**
   * The files to upload (array of binary).
   */
  @ApiProperty({ type: 'array', items: { type: 'string', format: 'binary' } })
  files!: any[];

  /**
   * Optional path to store the files at.
   */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  declare path?: string;

  /**
   * Optional disk to use for storage.
   */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  declare disk?: string;
}
