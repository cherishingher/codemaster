import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator"
import { Type } from "class-transformer"
import { DiscussionPostType } from "./create-post.dto"

export enum DiscussionSortType {
  NEWEST = "newest",
  HOT = "hot",
  FEATURED = "featured",
  UNSOLVED = "unsolved",
}

export class QueryPostListDto {
  @IsOptional()
  @IsString()
  keyword?: string

  @IsOptional()
  @IsEnum(DiscussionPostType)
  postType?: DiscussionPostType

  @IsOptional()
  @IsString()
  problemId?: string

  @IsOptional()
  @IsString()
  contestId?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tagId?: number

  @IsOptional()
  @IsString()
  authorId?: string

  @IsOptional()
  @IsEnum(DiscussionSortType)
  sort: DiscussionSortType = DiscussionSortType.NEWEST

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 20
}

