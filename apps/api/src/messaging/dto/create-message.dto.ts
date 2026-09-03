import { IsString, IsOptional, IsEnum, IsArray, MaxLength, ArrayNotEmpty } from 'class-validator';

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  FILE = 'FILE',
}

export class CreateMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;

  @IsEnum(MessageType)
  messageType: MessageType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayNotEmpty()
  mediaKeys?: string[];

  @IsOptional()
  @IsString()
  replyToMessageId?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
