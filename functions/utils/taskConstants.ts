export const TASK_STATUSES = ["todo", "doing", "on_hold", "done"] as const;

export type TaskStatusValue = (typeof TASK_STATUSES)[number];

export function isValidTaskStatus(status: string): status is TaskStatusValue {
  return (TASK_STATUSES as readonly string[]).includes(status);
}
