import type { ReactNode } from "react";
import { PaginatedList } from "../ui/PaginatedList";
import type { Task, TaskStatus } from "../../lib/types";

type TaskPaginatedColumnProps = {
  tasks: Task[];
  resetKey: string;
  children: (visibleTasks: Task[]) => ReactNode;
};

/** 칸반 열·모바일 컬럼 공통 — 5개씩 페이지네이션 */
export function TaskPaginatedColumn({ tasks, resetKey, children }: TaskPaginatedColumnProps) {
  return (
    <PaginatedList items={tasks} resetKey={resetKey} variant="compact">
      {children}
    </PaginatedList>
  );
}

export type { TaskStatus };
