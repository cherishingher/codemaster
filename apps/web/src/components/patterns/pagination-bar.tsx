import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PaginationItem, PaginationRange } from "@/lib/pagination";
import { cn } from "@/lib/utils";

type PaginationBarProps = {
  range: PaginationRange;
  currentPage: number;
  totalPages: number;
  items: PaginationItem[];
  loading?: boolean;
  pageNoun: string;
  pageInput: string;
  canJumpToPage: boolean;
  onPageInputChange: (value: string) => void;
  onPageInputSubmit: () => void;
  onPageChange: (page: number) => void;
};

export function PaginationBar({
  range,
  currentPage,
  totalPages,
  items,
  loading = false,
  pageNoun,
  pageInput,
  canJumpToPage,
  onPageInputChange,
  onPageInputSubmit,
  onPageChange,
}: PaginationBarProps) {
  return (
    <section className="surface-panel rounded-[1.75rem] px-4 py-4 md:px-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="text-sm text-muted-foreground">
          当前显示第 {range.from}-{range.to} {pageNoun}，共 {range.total} {pageNoun} · 第 {currentPage} / {totalPages} 页
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onPageChange(1)}
            disabled={currentPage <= 1 || loading}
          >
            首页
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
            disabled={currentPage <= 1 || loading}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            上一页
          </Button>
          <div className="flex flex-wrap items-center gap-1">
            {items.map((item) =>
              item.type === "ellipsis" ? (
                <span key={item.key} className="px-2 text-sm text-muted-foreground">
                  ...
                </span>
              ) : (
                <Button
                  key={item.page}
                  type="button"
                  size="sm"
                  variant={item.page === currentPage ? "default" : "outline"}
                  className={cn(
                    "min-w-9",
                    item.page === currentPage && "font-semibold ring-2 ring-primary/35 shadow-sm",
                  )}
                  onClick={() => onPageChange(item.page)}
                >
                  {item.page}
                </Button>
              ),
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || loading || totalPages <= 1}
          >
            下一页
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage >= totalPages || loading || totalPages <= 1}
          >
            末页
          </Button>
          <div className="ml-0 flex items-center gap-2 md:ml-2">
            <span className="text-sm text-muted-foreground">跳转到</span>
            <Input
              inputMode="numeric"
              pattern="[0-9]*"
              value={pageInput}
              onChange={(event) => onPageInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onPageInputSubmit();
                }
              }}
              onBlur={onPageInputSubmit}
              className="h-10 w-20"
              aria-label="输入页码跳转"
            />
            <Button type="button" variant="outline" onClick={onPageInputSubmit} disabled={!canJumpToPage}>
              跳转
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
