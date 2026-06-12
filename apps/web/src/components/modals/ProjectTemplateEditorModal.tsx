import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { cn } from "../../lib/cn";
import type { OrgProjectTemplate } from "../../lib/types";

export type MilestoneDraft = { title: string; offsetDays: string };
export type TaskDraft = { title: string; offsetDays: string };
export type MemberSlotDraft = { label: string; role: "manager" | "member" | "viewer" };

const selectClass =
  "w-full rounded-xl border border-sky-100/80 bg-white/70 px-3 py-2.5 text-sm text-navy-900 outline-none focus:border-primary-400";

export type ProjectTemplateFormValues = {
  name: string;
  description: string;
  milestones: MilestoneDraft[];
  tasks: TaskDraft[];
  memberSlots: MemberSlotDraft[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  editing: OrgProjectTemplate | null;
  values: ProjectTemplateFormValues;
  onChange: (values: ProjectTemplateFormValues) => void;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
};

export function ProjectTemplateEditorModal({
  open,
  onClose,
  editing,
  values,
  onChange,
  onSubmit,
  isPending,
}: Props) {
  const { name, description, milestones, tasks, memberSlots } = values;

  const updateMilestone = (index: number, patch: Partial<MilestoneDraft>) => {
    const next = [...milestones];
    next[index] = { ...next[index], ...patch };
    onChange({ ...values, milestones: next });
  };

  const updateTask = (index: number, patch: Partial<TaskDraft>) => {
    const next = [...tasks];
    next[index] = { ...next[index], ...patch };
    onChange({ ...values, tasks: next });
  };

  const updateMemberSlot = (index: number, patch: Partial<MemberSlotDraft>) => {
    const next = [...memberSlots];
    next[index] = { ...next[index], ...patch };
    onChange({ ...values, memberSlots: next });
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? "템플릿 수정" : "템플릿 추가"}>
      <form onSubmit={onSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <Input
          label="이름"
          value={name}
          onChange={(e) => onChange({ ...values, name: e.target.value })}
          required
          autoFocus
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-navy-700">설명</label>
          <textarea
            value={description}
            onChange={(e) => onChange({ ...values, description: e.target.value })}
            rows={2}
            placeholder="템플릿 용도·적용 상황"
            className={cn(selectClass, "resize-none py-3")}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-medium text-navy-700">마일스톤</label>
            <span className="text-xs text-navy-500">시작일 +N일</span>
          </div>
          {milestones.map((m, i) => (
            <div key={`m-${i}`} className="flex items-center gap-2">
              <Input
                placeholder="마일스톤 제목"
                value={m.title}
                onChange={(e) => updateMilestone(i, { title: e.target.value })}
                className="min-w-0 flex-1"
              />
              <Input
                type="number"
                placeholder="일"
                value={m.offsetDays}
                onChange={(e) => updateMilestone(i, { offsetDays: e.target.value })}
                className="w-20 shrink-0"
              />
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...values,
                    milestones: milestones.length <= 1 ? [{ title: "", offsetDays: "0" }] : milestones.filter((_, j) => j !== i),
                  })
                }
                className="shrink-0 rounded-lg px-2 py-2 text-xs text-navy-400 hover:bg-red-50 hover:text-red-600"
              >
                삭제
              </button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={() => onChange({ ...values, milestones: [...milestones, { title: "", offsetDays: "" }] })}
          >
            마일스톤 추가
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-medium text-navy-700">기본 업무</label>
            <span className="text-xs text-navy-500">생성 시 자동 추가</span>
          </div>
          {tasks.length === 0 ? (
            <p className="text-xs text-navy-500">기본 업무가 없습니다.</p>
          ) : (
            tasks.map((t, i) => (
              <div key={`t-${i}`} className="flex items-center gap-2">
                <Input
                  placeholder="업무 제목"
                  value={t.title}
                  onChange={(e) => updateTask(i, { title: e.target.value })}
                  className="min-w-0 flex-1"
                />
                <Input
                  type="number"
                  placeholder="일"
                  value={t.offsetDays}
                  onChange={(e) => updateTask(i, { offsetDays: e.target.value })}
                  className="w-20 shrink-0"
                />
                <button
                  type="button"
                  onClick={() => onChange({ ...values, tasks: tasks.filter((_, j) => j !== i) })}
                  className="shrink-0 rounded-lg px-2 py-2 text-xs text-navy-400 hover:bg-red-50 hover:text-red-600"
                >
                  삭제
                </button>
              </div>
            ))
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={() => onChange({ ...values, tasks: [...tasks, { title: "", offsetDays: "" }] })}
          >
            업무 추가
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-medium text-navy-700">권장 멤버 역할</label>
            <span className="text-xs text-navy-500">안내용</span>
          </div>
          {memberSlots.length === 0 ? (
            <p className="text-xs text-navy-500">권장 역할이 없습니다.</p>
          ) : (
            memberSlots.map((s, i) => (
              <div key={`s-${i}`} className="flex items-center gap-2">
                <Input
                  placeholder="역할 이름 (예: PM)"
                  value={s.label}
                  onChange={(e) => updateMemberSlot(i, { label: e.target.value })}
                  className="min-w-0 flex-1"
                />
                <select
                  value={s.role}
                  onChange={(e) =>
                    updateMemberSlot(i, { role: e.target.value as MemberSlotDraft["role"] })
                  }
                  className={cn(selectClass, "w-28 shrink-0")}
                >
                  <option value="manager">매니저</option>
                  <option value="member">멤버</option>
                  <option value="viewer">뷰어</option>
                </select>
                <button
                  type="button"
                  onClick={() => onChange({ ...values, memberSlots: memberSlots.filter((_, j) => j !== i) })}
                  className="shrink-0 rounded-lg px-2 py-2 text-xs text-navy-400 hover:bg-red-50 hover:text-red-600"
                >
                  삭제
                </button>
              </div>
            ))
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              onChange({ ...values, memberSlots: [...memberSlots, { label: "", role: "member" }] })
            }
          >
            역할 추가
          </Button>
        </div>

        <Button type="submit" fullWidth disabled={isPending || !name.trim()}>
          {isPending ? "저장 중..." : editing ? "변경 사항 저장" : "템플릿 저장"}
        </Button>
      </form>
    </Modal>
  );
}

export function templateToFormValues(template: OrgProjectTemplate): ProjectTemplateFormValues {
  return {
    name: template.name,
    description: template.description ?? "",
    milestones:
      template.milestones.length > 0
        ? template.milestones.map((m) => ({
            title: m.title,
            offsetDays: m.offsetDays != null ? String(m.offsetDays) : "",
          }))
        : [{ title: "", offsetDays: "0" }],
    tasks: (template.tasks ?? []).map((t) => ({
      title: t.title,
      offsetDays: t.offsetDays != null ? String(t.offsetDays) : "",
    })),
    memberSlots: (template.memberSlots ?? []).map((s) => ({
      label: s.label,
      role: s.role,
    })),
  };
}

export function emptyTemplateFormValues(): ProjectTemplateFormValues {
  return {
    name: "",
    description: "",
    milestones: [{ title: "", offsetDays: "0" }],
    tasks: [],
    memberSlots: [],
  };
}

export function formValuesToPayload(values: ProjectTemplateFormValues, isEdit: boolean) {
  return {
    name: values.name.trim(),
    description: isEdit ? values.description.trim() || null : values.description.trim() || undefined,
    milestones: values.milestones
      .filter((m) => m.title.trim())
      .map((m) => ({
        title: m.title.trim(),
        offsetDays: m.offsetDays.trim() !== "" ? Number(m.offsetDays) : undefined,
      })),
    tasks: values.tasks
      .filter((t) => t.title.trim())
      .map((t) => ({
        title: t.title.trim(),
        offsetDays: t.offsetDays.trim() !== "" ? Number(t.offsetDays) : undefined,
        status: "todo" as const,
      })),
    memberSlots: values.memberSlots
      .filter((s) => s.label.trim())
      .map((s) => ({ label: s.label.trim(), role: s.role })),
  };
}
