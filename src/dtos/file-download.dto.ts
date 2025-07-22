import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * DTO for downloading a file from storage.
 */
export class FileDownloadDto {
  /**
   * Path of the file to download.
   */
  @ApiProperty()
  path!: string;

  /**
   * Optional disk to use for download.
   */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  declare disk?: string;
}
