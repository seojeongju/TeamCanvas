import { useEffect, useState, type ReactNode } from "react";
import { TASK_LIST_PAGE_SIZE, pageCount, paginateItems } from "../../lib/taskGroup";
import { ListPagination } from "./ListPagination";
import type { Task, TaskStatus } from "../../lib/types";

type TaskPaginatedColumnProps = {
  tasks: Task[];
  resetKey: string;
  children: (visibleTasks: Task[]) => ReactNode;
};

/** 칸반 열·모바일 컬럼 공통 — 프로젝트 5개씩 페이지네이션 */
export function TaskPaginatedColumn({ tasks, resetKey, children }: TaskPaginatedColumnProps) {
  const [page, setPage] = useState(0);
  const totalPages = pageCount(tasks.length);
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const visibleTasks = paginateItems(tasks, safePage);

  useEffect(() => {
    setPage(0);
  }, [resetKey, tasks.length]);

  return (
    <>
      {children(visibleTasks)}
      <ListPagination
        page={safePage}
        totalPages={totalPages}
        totalItems={tasks.length}
        pageSize={TASK_LIST_PAGE_SIZE}
        onPageChange={setPage}
      />
    </>
  );
}

export type { TaskStatus };
