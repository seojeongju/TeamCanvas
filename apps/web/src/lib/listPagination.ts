/** 모바일 중심 리스트·칸반 열 기본 페이지 크기 */
export const LIST_PAGE_SIZE = 5;

export function paginateItems<T>(items: T[], page: number, pageSize = LIST_PAGE_SIZE): T[] {
  const start = page * pageSize;
  return items.slice(start, start + pageSize);
}

export function pageCount(length: number, pageSize = LIST_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(length / pageSize));
}

export function clampPage(page: number, totalPages: number): number {
  return Math.max(0, Math.min(page, totalPages - 1));
}
