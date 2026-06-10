export type EventForRecipients = {
  creator_id: string;
  visibility: string;
  team_id: string | null;
};

/** 일정 댓글 알림 수신자: 작성자, 참석자, (팀 공유 시) 팀 멤버, (조직 공유 시) 이전 댓글 작성자 */
export async function resolveEventCommentRecipients(
  db: D1Database,
  eventId: string,
  event: EventForRecipients,
): Promise<Set<string>> {
  const recipients = new Set<string>();
  recipients.add(event.creator_id);

  const { results: attendeeRows } = await db
    .prepare("SELECT user_id FROM event_attendees WHERE event_id = ?")
    .bind(eventId)
    .all();
  for (const row of attendeeRows ?? []) {
    recipients.add((row as { user_id: string }).user_id);
  }

  if (event.visibility === "team" && event.team_id) {
    const { results: teamRows } = await db
      .prepare("SELECT user_id FROM team_members WHERE team_id = ?")
      .bind(event.team_id)
      .all();
    for (const row of teamRows ?? []) {
      recipients.add((row as { user_id: string }).user_id);
    }
  }

  if (event.visibility === "org") {
    const { results: commenterRows } = await db
      .prepare("SELECT DISTINCT user_id FROM event_comments WHERE event_id = ?")
      .bind(eventId)
      .all();
    for (const row of commenterRows ?? []) {
      recipients.add((row as { user_id: string }).user_id);
    }
  }

  return recipients;
}
