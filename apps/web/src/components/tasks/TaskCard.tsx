import { useRef, useState } from "react";

import { Calendar, ChevronRight, Eye, Paperclip, Pencil } from "lucide-react";

import { GlassCard } from "../ui/GlassCard";

import { cn } from "../../lib/cn";

import {
  taskStatusLabel,
  taskWorkTone,
  workToneAccentClass,
  workToneBadgeClass,
  workToneCardClass,
  workToneTitleClass,
} from "../../lib/statusVisuals";

import {

  advanceStatus,

  getDueClass,

  getInitials,

  getPriorityClass,

  getPriorityLabel,

  regressStatus,

} from "../../lib/taskUtils";

import type { Task, TaskStatus } from "../../lib/types";



interface TaskCardProps {

  task: Task;

  onOpen: (task: Task) => void;

  onEdit: (task: Task) => void;

  onStatusChange: (task: Task, status: TaskStatus) => void;

  canWrite?: boolean;

  compact?: boolean;

  inFolder?: boolean;

}



const SWIPE_THRESHOLD = 72;

export function TaskCard({

  task,

  onOpen,

  onEdit,

  onStatusChange,

  canWrite = true,

  compact,

  inFolder,

}: TaskCardProps) {

  const startX = useRef(0);

  const [offsetX, setOffsetX] = useState(0);

  const [swiping, setSwiping] = useState(false);

  const workTone = taskWorkTone(task);



  const handleTouchStart = (e: React.TouchEvent) => {

    startX.current = e.touches[0].clientX;

    setSwiping(true);

  };



  const handleTouchMove = (e: React.TouchEvent) => {

    if (!swiping) return;

    setOffsetX(e.touches[0].clientX - startX.current);

  };



  const handleTouchEnd = () => {

    if (offsetX > SWIPE_THRESHOLD && task.status !== "done") {

      onStatusChange(task, advanceStatus(task.status));

    } else if (offsetX < -SWIPE_THRESHOLD && task.status !== "todo") {

      onStatusChange(task, regressStatus(task.status));

    }

    setOffsetX(0);

    setSwiping(false);

  };



  return (

    <div className={cn("relative overflow-hidden rounded-2xl", inFolder && "rounded-xl")}>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-4 text-xs font-medium">

        <span className={cn("text-emerald-600", offsetX > 20 ? "opacity-100" : "opacity-0")}>

          {task.status === "todo" ? "진행 →" : "완료 →"}

        </span>

        <span className={cn("text-sky-600", offsetX < -20 ? "opacity-100" : "opacity-0")}>

          ← 되돌리기

        </span>

      </div>



      <GlassCard className={cn("relative overflow-hidden p-0 transition-transform", compact && "shadow-sm", workToneCardClass(workTone))}>

        <div

          className="flex"

          style={{ transform: swiping ? `translateX(${offsetX}px)` : undefined }}

          onTouchStart={handleTouchStart}

          onTouchMove={handleTouchMove}

          onTouchEnd={handleTouchEnd}

          onTouchCancel={handleTouchEnd}

        >

          <div className={cn("w-1 shrink-0", workToneAccentClass(workTone))} aria-hidden />



          <div className={cn("min-w-0 flex-1", compact ? "p-3" : "p-3.5")}>

            <button

              type="button"

              onClick={() => onOpen(task)}

              className="w-full text-left"

            >

              <div className="flex items-start gap-2">

                <div className="min-w-0 flex-1">

                  <div className="flex flex-wrap items-center gap-1.5">

                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                        workToneBadgeClass(workTone),
                      )}
                    >
                      {taskStatusLabel(task.status)}
                    </span>

                    <span

                      className={cn(

                        "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",

                        getPriorityClass(task.priority),

                      )}

                    >

                      {getPriorityLabel(task.priority)}

                    </span>

                    {task.teamName && (

                      <span className="truncate rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-navy-500">

                        {task.teamName}

                      </span>

                    )}

                    {(task.attachmentCount ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-0.5 rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-navy-500">
                        <Paperclip className="h-3 w-3" />
                        {task.attachmentCount}
                      </span>
                    )}

                  </div>



                  <p

                    className={cn(

                      "mt-1.5 font-semibold leading-snug",

                      compact ? "text-sm" : "text-[15px]",

                      workToneTitleClass(workTone),

                    )}

                  >

                    {task.title}

                  </p>



                  {task.labels && task.labels.length > 0 && (

                    <div className="mt-1.5 flex flex-wrap gap-1">

                      {task.labels.map((label) => (

                        <span

                          key={label.id}

                          className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white"

                          style={{ backgroundColor: label.color }}

                        >

                          {label.name}

                        </span>

                      ))}

                    </div>

                  )}

                </div>



                <ChevronRight

                  className="mt-0.5 h-4 w-4 shrink-0 text-navy-300"

                  strokeWidth={2}

                  aria-hidden

                />

              </div>



              <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-sky-50 pt-2.5">

                <div className="flex min-w-0 items-center gap-2">

                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-400/15 text-[9px] font-bold text-primary-600">

                    {getInitials(task.assignee)}

                  </span>

                  <span className="truncate text-xs text-navy-600">{task.assignee}</span>

                </div>

                {task.due && (

                  <span

                    className={cn(

                      "inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium",

                      getDueClass(task),

                    )}

                  >

                    <Calendar className="h-3 w-3 opacity-70" strokeWidth={2} />

                    {task.due}

                  </span>

                )}

              </div>

            </button>



            <div className="mt-2 flex gap-2">

              <button

                type="button"

                onClick={() => onOpen(task)}

                className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-sky-100/70 py-2 text-xs font-medium text-navy-700 transition hover:bg-sky-100"

              >

                <Eye className="h-3.5 w-3.5" />

                상세보기

              </button>

              {canWrite && (

                <button

                  type="button"

                  onClick={() => onEdit(task)}

                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-primary-400/10 py-2 text-xs font-medium text-primary-600 transition hover:bg-primary-400/20"

                >

                  <Pencil className="h-3.5 w-3.5" />

                  수정

                </button>

              )}

            </div>

          </div>

        </div>

      </GlassCard>

    </div>

  );

}

