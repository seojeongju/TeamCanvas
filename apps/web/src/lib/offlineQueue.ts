import { api } from "./api";
import { IDB_STORES, idbDelete, idbGetAll, idbSet } from "./idb";

export type OfflineQueueItem =
  | {
      id: string;
      type: "createTask";
      orgId: string;
      payload: Parameters<typeof api.createTask>[1];
      createdAt: number;
    }
  | {
      id: string;
      type: "createEvent";
      orgId: string;
      payload: Parameters<typeof api.createEvent>[1];
      createdAt: number;
    };

const QUEUE_KEY_PREFIX = "q:";

export async function enqueueOfflineMutation(item: OfflineQueueItem): Promise<void> {
  await idbSet(`${QUEUE_KEY_PREFIX}${item.id}`, item, IDB_STORES.QUEUE_STORE);
}

export async function getOfflineQueue(): Promise<OfflineQueueItem[]> {
  const items = await idbGetAll<OfflineQueueItem>(IDB_STORES.QUEUE_STORE);
  return items.sort((a, b) => a.createdAt - b.createdAt);
}

export async function removeOfflineQueueItem(id: string): Promise<void> {
  await idbDelete(`${QUEUE_KEY_PREFIX}${id}`, IDB_STORES.QUEUE_STORE);
}

/** 온라인 복귀 시 대기 중인 생성 요청 전송 */
export async function flushOfflineQueue(): Promise<number> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return 0;

  const queue = await getOfflineQueue();
  let flushed = 0;

  for (const item of queue) {
    try {
      if (item.type === "createTask") {
        await api.createTask(item.orgId, item.payload);
      } else {
        await api.createEvent(item.orgId, item.payload);
      }
      await removeOfflineQueueItem(item.id);
      flushed += 1;
    } catch {
      break;
    }
  }

  return flushed;
}

export function newOfflineId(): string {
  return `offline-${crypto.randomUUID()}`;
}
