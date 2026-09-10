/** D1 쿼리당 bind 최대 100개 — IN 절용으로 여유를 둔다. */
export const D1_IN_CHUNK_SIZE = 90;

export function chunkIds<T>(ids: T[], size = D1_IN_CHUNK_SIZE): T[][] {
  if (ids.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}
