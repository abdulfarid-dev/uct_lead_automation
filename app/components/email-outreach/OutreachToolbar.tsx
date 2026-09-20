"use client";

import { useRef } from "react";
import {
  CalendarDays,
  ChevronDown,
  Clock3,
  Eye,
  Mail,
  RefreshCw,
  Search,
  Send,
} from "lucide-react";

type Template = {
  id: number;
  name: string;
  subject: string;
  isActive: boolean;
  sender?: {
    id?: number | string | null;
    name?: string;
    email?: string;
  } | null;
};

type Props = {
  activeTab: string;
  search: string;
  onSearchChange: (value: string) => void;
  templates: Template[];
  selectedTemplateId: number | "";
  onTemplateChange: (id: number | "") => void;
  onViewTemplate: () => void;
  senderEmail: string;
  scheduleDate: string;
  scheduleTime: string;
  today: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  onSendNow: () => void;
  onSchedule: () => void;
  processing: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  selectedCount: number;
};

export default function OutreachToolbar(props: Props) {
  const selectedTemplate =
    props.templates.find(
      (template) => template.id === props.selectedTemplateId
    ) ?? null;

  const dateInputRef = useRef<HTMLInputElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);

  function openPicker(
    inputRef: React.RefObject<HTMLInputElement | null>
  ) {
    const input = inputRef.current;

    if (!input) return;

    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
        return;
      } catch {
        // Fall back to focusing the native input.
      }
    }

    input.focus();
  }

  // The Brevo template is the source of truth for the sender.
  // senderEmail remains as a fallback so existing functionality is preserved
  // while templates are loading or when older template data has no sender.
  const templateSenderEmail = selectedTemplate?.sender?.email?.trim() || "";
  const resolvedSenderEmail =
    templateSenderEmail || props.senderEmail || "No sender selected";

  const templateSenderName = selectedTemplate?.sender?.name?.trim() || "";

  return (
    <div className="space-y-2.5 px-4 py-3 sm:px-5">
      {props.activeTab === "pending" && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/35 p-3">
          <div className="grid gap-2.5 xl:grid-cols-[1.25fr_1fr_1fr_1fr_auto]">
            <div>
              <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                Brevo Template
              </label>

              <div className="flex gap-1.5">
                <div className="relative min-w-0 flex-1">
                  <select
                    value={props.selectedTemplateId}
                    onChange={(e) =>
                      props.onTemplateChange(
                        e.target.value ? Number(e.target.value) : ""
                      )
                    }
                    className="h-9 w-full appearance-none rounded-md border border-slate-800 bg-slate-950 px-2.5 pr-7 text-[11px] text-slate-200 outline-none focus:border-blue-500/50"
                  >
                    <option value="">Select template</option>

                    {props.templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        #{template.id} — {template.name}
                      </option>
                    ))}
                  </select>

                  <ChevronDown
                    size={12}
                    className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-600"
                  />
                </div>

                <button
                  type="button"
                  onClick={props.onViewTemplate}
                  disabled={!props.selectedTemplateId}
                  title="View template in Brevo"
                  className="h-9 rounded-md border border-slate-800 px-2 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-40"
                >
                  <Eye size={13} />
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                Send From
              </label>

              <div
                className="flex h-9 items-center rounded-md border border-slate-800 bg-slate-950 px-2.5 text-[11px] text-slate-300"
                title={
                  templateSenderName
                    ? `${templateSenderName} <${resolvedSenderEmail}>`
                    : resolvedSenderEmail
                }
              >
                <Mail
                  size={12}
                  className="mr-1.5 shrink-0 text-slate-600"
                />

                <span className="truncate">{resolvedSenderEmail}</span>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                Date
              </label>

              <div className="relative">
                <input
                  ref={dateInputRef}
                  type="date"
                  min={props.today}
                  value={props.scheduleDate}
                  onChange={(e) => props.onDateChange(e.target.value)}
                  className="h-9 w-full cursor-pointer rounded-md border border-slate-800 bg-slate-950 px-2.5 pr-9 text-[11px] text-slate-200 outline-none focus:border-blue-500/50"
                />

                <button
                  type="button"
                  aria-label="Open date picker"
                  title="Select date"
                  onClick={() => openPicker(dateInputRef)}
                  className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-r-md text-slate-500 hover:bg-slate-900 hover:text-slate-200"
                >
                  <CalendarDays size={13} />
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                Time
              </label>

              <div className="relative">
                <input
                  ref={timeInputRef}
                  type="time"
                  value={props.scheduleTime}
                  onChange={(e) => props.onTimeChange(e.target.value)}
                  className="h-9 w-full cursor-pointer rounded-md border border-slate-800 bg-slate-950 px-2.5 pr-9 text-[11px] text-slate-200 outline-none focus:border-blue-500/50"
                />

                <button
                  type="button"
                  aria-label="Open time picker"
                  title="Select time"
                  onClick={() => openPicker(timeInputRef)}
                  className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-r-md text-slate-500 hover:bg-slate-900 hover:text-slate-200"
                >
                  <Clock3 size={13} />
                </button>
              </div>
            </div>

            <div className="flex items-end gap-1.5">
              <button
                type="button"
                onClick={props.onSendNow}
                disabled={props.processing || !props.selectedCount}
                className="flex h-9 items-center justify-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 text-[11px] font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-40"
              >
                <Send size={12} />
                Send Now
              </button>

              <button
                type="button"
                onClick={props.onSchedule}
                disabled={props.processing || !props.selectedCount}
                className="flex h-9 items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 text-[11px] font-medium text-white hover:bg-blue-500 disabled:opacity-40"
              >
                <CalendarDays size={12} />
                Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="relative min-w-0 max-w-sm flex-1">
          <Search
            size={13}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600"
          />

          <input
            value={props.search}
            onChange={(e) => props.onSearchChange(e.target.value)}
            placeholder="Search sector, website, email, location..."
            className="h-8 w-full rounded-md border border-slate-800 bg-slate-900/45 pl-8 pr-2.5 text-[11px] text-white outline-none placeholder:text-slate-600 focus:border-blue-500/50"
          />
        </div>

        <div className="flex items-center gap-2">
          {props.selectedCount > 0 && (
            <span className="text-[10px] text-slate-600">
              <span className="text-blue-400">{props.selectedCount}</span>{" "}
              selected
            </span>
          )}

          <button
            type="button"
            onClick={props.onRefresh}
            disabled={props.refreshing}
            title="Refresh"
            className="rounded-md border border-slate-800 p-1.5 text-slate-500 hover:bg-slate-900 hover:text-slate-200 disabled:opacity-40"
          >
            <RefreshCw
              size={13}
              className={props.refreshing ? "animate-spin" : ""}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
