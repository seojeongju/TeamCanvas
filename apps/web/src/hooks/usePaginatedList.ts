import { useEffect, useMemo, useState } from "react";
import {
  LIST_PAGE_SIZE,
  clampPage,
  pageCount,
  paginateItems,
} from "../lib/listPagination";

export function usePaginatedList<T>(items: T[], resetKey?: string | number, pageSize = LIST_PAGE_SIZE) {
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [resetKey, items.length]);

  const totalPages = pageCount(items.length, pageSize);
  const safePage = clampPage(page, totalPages);
  const visible = useMemo(
    () => paginateItems(items, safePage, pageSize),
    [items, safePage, pageSize],
  );

  return {
    page: safePage,
    setPage,
    totalPages,
    totalItems: items.length,
    pageSize,
    visible,
  };
}
