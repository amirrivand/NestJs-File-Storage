import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class FileDownloadDto {
  @ApiProperty()
  path!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  declare disk?: string;
}
