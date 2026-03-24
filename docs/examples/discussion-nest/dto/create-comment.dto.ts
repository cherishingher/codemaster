import { IsOptional, IsString, Length, MaxLength } from "class-validator"

export class CreateCommentDto {
  @IsString()
  @Length(1, 10000)
  contentMarkdown!: string

  @IsOptional()
  @IsString()
  @MaxLength(26)
  parentCommentId?: string
}

