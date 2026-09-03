import { IsString, IsInt, Min, Max } from 'class-validator';

export class RequestMediaUploadDto {
  @IsString()
  mimeType: string;

  @IsInt()
  @Min(1, { message: 'fileSize must not be less than 1' })
  @Max(50 * 1024 * 1024)
  fileSize: number;
}
