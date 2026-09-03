import { IsString, IsNotEmpty } from 'class-validator';

export class ModerateContentDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}
