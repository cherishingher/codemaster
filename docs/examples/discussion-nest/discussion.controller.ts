import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common"
import { CreateCommentDto } from "./dto/create-comment.dto"
import { CreatePostDto } from "./dto/create-post.dto"
import { QueryPostListDto } from "./dto/query-post-list.dto"
import { UpdatePostDto } from "./dto/update-post.dto"
import { DiscussionService } from "./discussion.service"

@Controller("discussions")
export class DiscussionController {
  constructor(private readonly discussionService: DiscussionService) {}

  @Post("posts")
  createPost(@Body() dto: CreatePostDto) {
    return this.discussionService.createPost(
      { id: "mock-user-id", roles: ["user"] },
      dto,
    )
  }

  @Patch("posts/:id")
  updatePost(@Param("id") id: string, @Body() dto: UpdatePostDto) {
    return this.discussionService.updatePost(
      { id: "mock-user-id", roles: ["user"] },
      id,
      dto,
    )
  }

  @Get("posts/:id")
  getPostDetail(@Param("id") id: string) {
    return this.discussionService.getPostDetail(id)
  }

  @Get("posts")
  listPosts(@Query() query: QueryPostListDto) {
    return this.discussionService.listPosts(query)
  }

  @Post("posts/:id/comments")
  createComment(@Param("id") postId: string, @Body() dto: CreateCommentDto) {
    return this.discussionService.createComment(
      { id: "mock-user-id", roles: ["user"] },
      postId,
      dto,
    )
  }

  @Post("posts/:id/best-comment")
  setBestComment(
    @Param("id") postId: string,
    @Body("commentId") commentId: string,
  ) {
    return this.discussionService.setBestComment(
      { id: "mock-user-id", roles: ["user"] },
      postId,
      commentId,
    )
  }

  @Post("admin/posts/:id/audit")
  auditPost(
    @Param("id") postId: string,
    @Body() body: { auditStatus: "approved" | "rejected"; reason?: string },
  ) {
    return this.discussionService.auditPost(
      { id: "mock-admin-id", roles: ["admin"] },
      postId,
      body.auditStatus,
      body.reason,
    )
  }
}

