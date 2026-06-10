import type { Task } from "./types";

export function normalizeTaskGroupTitle(title: string): string {
  return title.trim();
}

export type TaskTitleGroup = {
  key: string;
  title: string;
  tasks: Task[];
};

export function groupTasksByTitle(tasks: Task[]): TaskTitleGroup[] {
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
