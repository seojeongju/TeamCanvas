import { useEffect, useState, type ReactNode } from "react";
import { ListPagination } from "../tasks/ListPagination";
import {
  LIST_PAGE_SIZE,
  clampPage,
  pageCount,
  paginateItems,
} from "../../lib/listPagination";

type PaginatedListProps<T> = {
  items: T[];
  resetKey?: string | number;
  pageSize?: number;
  variant?: "default" | "compact";
  children: (visibleItems: T[]) => ReactNode;
};

export function PaginatedList<T>({
  items,
  resetKey,
  pageSize = LIST_PAGE_SIZE,
  variant = "default",
  children,
}: PaginatedListProps<T>) {
  const [page, setPage] = useState(0);
  const totalPages = pageCount(items.length, pageSize);
  const safePage = clampPage(page, totalPages);
  const visibleItems = paginateItems(items, safePage, pageSize);

  useEffect(() => {
    setPage(0);
  }, [resetKey, items.length]);

  return (
    <>
      {children(visibleItems)}
      <ListPagination
        page={safePage}
        totalPages={totalPages}
        totalItems={items.length}
        pageSize={pageSize}
        onPageChange={setPage}
        variant={variant}
      />
    </>
  );
}
