import { IsArray, IsEnum, IsOptional, IsString, Length, MaxLength } from "class-validator"

export enum DiscussionPostType {
  PROBLEM_DISCUSSION = "problem_discussion",
  SOLUTION = "solution",
  CONTEST_DISCUSSION = "contest_discussion",
  QUESTION = "question",
  EXPERIENCE = "experience",
  FEEDBACK = "feedback",
  ANNOUNCEMENT = "announcement",
  GENERAL = "general",
}

export class CreatePostDto {
  @IsEnum(DiscussionPostType)
  postType!: DiscussionPostType

  @IsString()
  @Length(2, 160)
  title!: string

  @IsString()
  @Length(2, 50000)
  contentMarkdown!: string

  @IsOptional()
  @IsString()
  @MaxLength(26)
  problemId?: string

  @IsOptional()
  @IsString()
  @MaxLength(26)
  contestId?: string

  @IsOptional()
  @IsArray()
  tagIds?: number[]
}

