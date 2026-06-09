export type OrgMemberRef = { id: string; name: string };

/** 댓글 본문에서 @이름 패턴을 파싱해 멤버 ID 목록 반환 */
export function parseMentionedUserIds(body: string, members: OrgMemberRef[]): string[] {
  const mentioned = new Set<string>();
  const pattern = /@([^\s@]+)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(body)) !== null) {
    const token = match[1].trim();
    if (!token) continue;

    const byName = members.find(
      (m) => m.name === token || m.name.replace(/\s+/g, "") === token.replace(/\s+/g, ""),
    );
    if (byName) mentioned.add(byName.id);

    const byId = members.find((m) => m.id === token || m.id.startsWith(token));
    if (byId) mentioned.add(byId.id);
  }

  return [...mentioned];
}
