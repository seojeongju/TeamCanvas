import type { Task } from "./types";

export const TASK_LIST_PAGE_SIZE = 5;

export function normalizeTaskGroupTitle(title: string): string {
  return title.trim();
}

export type TaskFolderGroupData = {
  key: string;
  title: string;
  tasks: Task[];
  /** 라벨 폴더 등 사용자 지정 강조색 */
  accentColor?: string;
};

/** @deprecated TaskFolderGroupData 사용 */
export type TaskTitleGroup = TaskFolderGroupData;

export function groupTasksByTitle(tasks: Task[]): TaskFolderGroupData[] {
  const map = new Map<string, Task[]>();

  for (const task of tasks) {
    const key = normalizeTaskGroupTitle(task.title);
    const list = map.get(key) ?? [];
    list.push(task);
    map.set(key, list);
  }

  return Array.from(map.entries()).map(([key, items]) => ({
    key,
    title: items[0].title,
    tasks: items,
  }));
}

const UNLABELED_KEY = "__unlabeled__";

/** 완료 프로젝트 — 라벨별 폴더 (복수 라벨이면 각 라벨 폴더에 포함) */
export function groupTasksByLabel(tasks: Task[]): TaskFolderGroupData[] {
  const map = new Map<string, { title: string; accentColor: string; tasks: Task[] }>();

  for (const task of tasks) {
    const labels = task.labels ?? [];
    if (labels.length === 0) {
      const entry = map.get(UNLABELED_KEY) ?? {
        title: "라벨 없음",
        accentColor: "#94A3B8",
        tasks: [],
      };
      entry.tasks.push(task);
      map.set(UNLABELED_KEY, entry);
      continue;
    }

    for (const label of labels) {
      const entry = map.get(label.id) ?? {
        title: label.name,
        accentColor: label.color,
        tasks: [],
      };
      if (!entry.tasks.some((t) => t.id === task.id)) {
        entry.tasks.push(task);
      }
      map.set(label.id, entry);
    }
  }

  return Array.from(map.entries())
    .map(([key, entry]) => ({
      key,
      title: entry.title,
      accentColor: entry.accentColor,
      tasks: entry.tasks,
    }))
    .sort((a, b) => {
      if (a.key === UNLABELED_KEY) return 1;
      if (b.key === UNLABELED_KEY) return -1;
      return a.title.localeCompare(b.title, "ko");
    });
}

export function paginateItems<T>(items: T[], page: number, pageSize = TASK_LIST_PAGE_SIZE): T[] {
  const start = page * pageSize;
  return items.slice(start, start + pageSize);
}

export function pageCount(length: number, pageSize = TASK_LIST_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(length / pageSize));
}
