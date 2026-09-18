"use client";

import { useEffect, useState } from "react";
import {
  Eye,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";

export type EmailTemplate = {
  id: number;
  name: string;
  subject: string;
  body: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type Mode = "add" | "view" | "edit";

type Props = {
  open: boolean;
  mode: Mode;
  template?: EmailTemplate | null;
  onClose: () => void;
  onSaved: (template: EmailTemplate) => void;
  onDeleted: (id: number) => void;
};

export default function EmailTemplateModal({
  open,
  mode,
  template,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const [currentMode, setCurrentMode] =
    useState<Mode>(mode);

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] =
    useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    setCurrentMode(mode);
    setError("");

    setName(template?.name || "");
    setSubject(template?.subject || "");
    setBody(template?.body || "");
  }, [open, mode, template]);

  if (!open) {
    return null;
  }

  const readOnly =
    currentMode === "view";

  async function handleSave() {
    if (!name.trim()) {
      setError("Template name is required.");
      return;
    }

    if (!subject.trim()) {
      setError("Subject is required.");
      return;
    }

    if (!body.trim()) {
      setError("Message is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const isEdit =
        currentMode === "edit" &&
        template;

      const response = await fetch(
        "/api/email-outreach/templates",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            isEdit
              ? {
                  id: template.id,
                  name,
                  subject,
                  body,
                }
              : {
                  name,
                  subject,
                  body,
                }
          ),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Failed to save template."
        );
      }

      onSaved(data.template);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!template) return;

    const confirmed = window.confirm(
      `Delete "${template.name}"?`
    );

    if (!confirmed) return;

    try {
      setDeleting(true);
      setError("");

      const response = await fetch(
        `/api/email-outreach/templates?id=${template.id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Failed to delete template."
        );
      }

      onDeleted(template.id);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete template."
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">
              {currentMode === "add" &&
                "Create Email Template"}

              {currentMode === "view" &&
                "View Email Template"}

              {currentMode === "edit" &&
                "Edit Email Template"}
            </h2>

            <p className="mt-1 text-[11px] text-slate-500">
              Manage your reusable outreach message.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-900 hover:text-slate-200"
          >
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-5">
          {/* Template Name */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-slate-400">
              Template Name
            </label>

            <input
              value={name}
              onChange={(e) =>
                setName(e.target.value)
              }
              disabled={readOnly}
              placeholder="e.g. UCT Industrial IoT Pitch"
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500/50 disabled:cursor-default disabled:opacity-80"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-slate-400">
              Subject
            </label>

            <input
              value={subject}
              onChange={(e) =>
                setSubject(e.target.value)
              }
              disabled={readOnly}
              placeholder="Email subject"
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500/50 disabled:cursor-default disabled:opacity-80"
            />
          </div>

          {/* Message */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-slate-400">
              Message
            </label>

            <textarea
              value={body}
              onChange={(e) =>
                setBody(e.target.value)
              }
              disabled={readOnly}
              rows={9}
              placeholder="Write your email message..."
              className="w-full resize-none rounded-lg border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs leading-5 text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500/50 disabled:cursor-default disabled:opacity-80"
            />
          </div>

          {/* Variables */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Available Variables
            </p>

            <div className="flex flex-wrap gap-2">
              {[
                "{{company_name}}",
                "{{email}}",
                "{{website}}",
                "{{location}}",
              ].map((variable) => (
                <code
                  key={variable}
                  className="rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-[10px] text-blue-400"
                >
                  {variable}
                </code>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-[11px] text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 px-5 py-4">
          <div>
            {currentMode !== "add" &&
              template && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-medium text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
                >
                  <Trash2 size={14} />

                  {deleting
                    ? "Deleting..."
                    : "Delete"}
                </button>
              )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-800 px-3 py-2 text-[11px] font-medium text-slate-400 transition hover:bg-slate-900 hover:text-white"
            >
              Close
            </button>

            {currentMode === "view" && (
              <button
                type="button"
                onClick={() =>
                  setCurrentMode("edit")
                }
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-medium text-white transition hover:bg-blue-500"
              >
                <Pencil size={13} />
                Edit
              </button>
            )}

            {currentMode === "edit" && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
              >
                <Pencil size={13} />
                {saving
                  ? "Saving..."
                  : "Save Changes"}
              </button>
            )}

            {currentMode === "add" && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
              >
                <Plus size={13} />

                {saving
                  ? "Creating..."
                  : "Create Template"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}