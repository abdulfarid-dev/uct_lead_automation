"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  X,
} from "lucide-react";

import EmailTemplateModal, {
  EmailTemplate,
} from "./EmailTemplateModal";

type Tab =
  | "pending"
  | "scheduled"
  | "sent"
  | "failed";

type Lead = {
  id: number;
  sector: string;
  website: string;
  location: string | null;
  phone: string | null;
  email: string | null;
  verificationStatus: string;
  emailStatus: string;
  emailScheduledAt: string | null;
  emailSentAt: string | null;
  emailError: string | null;
};

const FIXED_SENDER_EMAIL = "farid995576@gmail.com";

const tabs: {
  id: Tab;
  label: string;
}[] = [
  {
    id: "pending",
    label: "Ready to Send",
  },
  {
    id: "scheduled",
    label: "Scheduled",
  },
  {
    id: "sent",
    label: "Sent",
  },
  {
    id: "failed",
    label: "Failed",
  },
];

export default function EmailOutreachPage() {
  const [activeTab, setActiveTab] =
    useState<Tab>("pending");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [templates, setTemplates] =
    useState<EmailTemplate[]>([]);

  const [selectedIds, setSelectedIds] =
    useState<number[]>([]);

  const [selectedTemplateId, setSelectedTemplateId] =
    useState<number | "">("");

  const [senderConfigured, setSenderConfigured] = useState(false);

  const [search, setSearch] = useState("");

  const [scheduleDate, setScheduleDate] =
    useState("");

  const [scheduleTime, setScheduleTime] =
    useState("");
      const today = new Date().toISOString().split("T")[0];

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);

  const [processing, setProcessing] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] = useState("");

  const [
    templateModalOpen,
    setTemplateModalOpen,
  ] = useState(false);

  const [
    templateModalMode,
    setTemplateModalMode,
  ] = useState<"add" | "view" | "edit">("add");

  const [
    selectedTemplate,
    setSelectedTemplate,
  ] = useState<EmailTemplate | null>(null);

  /*
  |--------------------------------------------------------------------------
  | Fetch Leads
  |--------------------------------------------------------------------------
  */

  async function fetchLeads(
    status: Tab = activeTab,
    showLoader = true
  ) {
    try {
      if (showLoader) {
        setRefreshing(true);
      }

      const response = await fetch(
        `/api/email-outreach?status=${status}`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Failed to load leads."
        );
      }

      setLeads(data.leads || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load leads."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Fetch Templates
  |--------------------------------------------------------------------------
  */

  async function fetchTemplates() {
    try {
      const response = await fetch(
        "/api/email-outreach/templates",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Failed to load templates."
        );
      }

      setTemplates(data.templates || []);

      if (
        data.templates?.length &&
        !selectedTemplateId
      ) {
        setSelectedTemplateId(
          data.templates[0].id
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load templates."
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Fixed Sender
  |--------------------------------------------------------------------------
  */

  async function checkSender() {
    try {
      const response = await fetch(
        "/api/email-outreach?resource=senders",
        { cache: "no-store" }
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to verify sender.");
      }

      const exists = (data.senders || []).some(
        (sender: { email: string; isActive: boolean }) =>
          sender.isActive &&
          sender.email.toLowerCase() === FIXED_SENDER_EMAIL.toLowerCase()
      );

      setSenderConfigured(exists);
      if (!exists) {
        setError(`Sender ${FIXED_SENDER_EMAIL} is not configured in EmailSender.`);
      }
    } catch (err) {
      setSenderConfigured(false);
      setError(err instanceof Error ? err.message : "Failed to verify sender.");
    }
  }

  useEffect(() => {
    fetchLeads("pending");
    fetchTemplates();
    checkSender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSelectedIds([]);
    fetchLeads(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  /*
  |--------------------------------------------------------------------------
  | Filter
  |--------------------------------------------------------------------------
  */

  const filteredLeads = useMemo(() => {
    const value = search
      .trim()
      .toLowerCase();

    if (!value) {
      return leads;
    }

    return leads.filter((lead) =>
      [
        lead.sector,
        lead.website,
        lead.location,
        lead.email,
      ]
        .filter(Boolean)
        .some((field) =>
          String(field)
            .toLowerCase()
            .includes(value)
        )
    );
  }, [leads, search]);

  /*
  |--------------------------------------------------------------------------
  | Selection
  |--------------------------------------------------------------------------
  */

  const allVisibleSelected =
    filteredLeads.length > 0 &&
    filteredLeads.every((lead) =>
      selectedIds.includes(lead.id)
    );

  function toggleLead(id: number) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter(
            (item) => item !== id
          )
        : [...current, id]
    );
  }

  function toggleAll() {
    if (allVisibleSelected) {
      setSelectedIds((current) =>
        current.filter(
          (id) =>
            !filteredLeads.some(
              (lead) => lead.id === id
            )
        )
      );
      return;
    }

    setSelectedIds((current) => [
      ...new Set([
        ...current,
        ...filteredLeads.map(
          (lead) => lead.id
        ),
      ]),
    ]);
  }

  /*
  |--------------------------------------------------------------------------
  | Template helpers
  |--------------------------------------------------------------------------
  */

  const currentTemplate =
    templates.find(
      (template) =>
        template.id ===
        selectedTemplateId
    ) || null;

  function openAddTemplate() {
    setSelectedTemplate(null);
    setTemplateModalMode("add");
    setTemplateModalOpen(true);
  }

  function openViewTemplate() {
    if (!currentTemplate) {
      setError("Select a template first.");
      return;
    }

    setSelectedTemplate(currentTemplate);
    setTemplateModalMode("view");
    setTemplateModalOpen(true);
  }

  function openEditTemplate() {
    if (!currentTemplate) {
      setError("Select a template first.");
      return;
    }

    setSelectedTemplate(currentTemplate);
    setTemplateModalMode("edit");
    setTemplateModalOpen(true);
  }

  function handleTemplateSaved(
    template: EmailTemplate
  ) {
    setTemplates((current) => {
      const exists = current.some(
        (item) => item.id === template.id
      );

      if (exists) {
        return current.map((item) =>
          item.id === template.id
            ? template
            : item
        );
      }

      return [template, ...current];
    });

    setSelectedTemplateId(template.id);
    setMessage(
      "Email template saved successfully."
    );
    setError("");
  }

  function handleTemplateDeleted(
    id: number
  ) {
    setTemplates((current) =>
      current.filter(
        (template) => template.id !== id
      )
    );

    if (selectedTemplateId === id) {
      setSelectedTemplateId("");
    }

    setMessage(
      "Email template deleted successfully."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Refresh
  |--------------------------------------------------------------------------
  */

  async function handleRefresh() {
    await Promise.all([
      fetchLeads(activeTab),
      fetchTemplates(),
      ]);
  }

  /*
  |--------------------------------------------------------------------------
  | Schedule
  |--------------------------------------------------------------------------
  */

  async function handleSchedule() {
    setMessage("");
    setError("");

    if (selectedIds.length === 0) {
      setError(
        "Select at least one lead."
      );
      return;
    }

    if (!selectedTemplateId) {
      setError(
        "Select an email template."
      );
      return;
    }

    if (!senderConfigured) {
      setError(`Sender ${FIXED_SENDER_EMAIL} is not configured.`);
      return;
    }

    if (!scheduleDate) {
      setError("Select a schedule date.");
      return;
    }

    if (!scheduleTime) {
      setError("Select a schedule time.");
      return;
    }

    const scheduledAt = new Date(
      `${scheduleDate}T${scheduleTime}`
    );

    if (
      Number.isNaN(
        scheduledAt.getTime()
      )
    ) {
      setError(
        "Invalid schedule date or time."
      );
      return;
    }

    if (scheduledAt <= new Date()) {
      setError(
        "Schedule time must be in the future."
      );
      return;
    }

    try {
      setProcessing(true);

      const response = await fetch(
        "/api/email-outreach",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "schedule",
            leadIds: selectedIds,
            templateId:
              selectedTemplateId,
            senderEmail: FIXED_SENDER_EMAIL,
            scheduledAt:
              scheduledAt.toISOString(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Failed to schedule emails."
        );
      }

      setMessage(data.message);
      setSelectedIds([]);
      setScheduleDate("");
      setScheduleTime("");

      await fetchLeads(activeTab);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to schedule emails."
      );
    } finally {
      setProcessing(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Send Now
  |--------------------------------------------------------------------------
  */

  async function handleSendNow() {
    setMessage("");
    setError("");

    if (selectedIds.length === 0) {
      setError(
        "Select at least one lead."
      );
      return;
    }

    if (!selectedTemplateId) {
      setError(
        "Select an email template."
      );
      return;
    }

    if (!senderConfigured) {
      setError(`Sender ${FIXED_SENDER_EMAIL} is not configured.`);
      return;
    }

    const confirmed =
      window.confirm(
        `Send email to ${selectedIds.length} selected lead(s) now?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setProcessing(true);

      const response = await fetch(
        "/api/email-outreach",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "send-now",
            leadIds: selectedIds,
            templateId:
              selectedTemplateId,
            senderEmail: FIXED_SENDER_EMAIL,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Failed to send emails."
        );
      }

      setMessage(data.message);
      setSelectedIds([]);

      await fetchLeads(activeTab);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to send emails."
      );
    } finally {
      setProcessing(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Cancel Scheduled
  |--------------------------------------------------------------------------
  */

  async function cancelScheduled(
    leadId: number
  ) {
    const confirmed =
      window.confirm(
        "Cancel this scheduled email?"
      );

    if (!confirmed) return;

    try {
      const response = await fetch(
        "/api/email-outreach",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            leadIds: [leadId],
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Failed to cancel email."
        );
      }

      setMessage(
        "Scheduled email cancelled."
      );

      await fetchLeads(activeTab);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to cancel email."
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | UI
  |--------------------------------------------------------------------------
  */

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Mail
                size={19}
                className="text-blue-400"
              />

              <h1 className="text-lg font-semibold">
                Email Outreach
              </h1>
            </div>

            <p className="mt-1 text-xs text-slate-500">
              Manage templates, verified leads,
              scheduling and email delivery.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={
                refreshing
                  ? "animate-spin"
                  : ""
              }
            />

            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800 px-6">
        <div className="flex gap-5">
          {tabs.map((tab) => {
            const active =
              activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() =>
                  setActiveTab(tab.id)
                }
                className={`relative py-3 text-xs font-medium transition ${
                  active
                    ? "text-blue-400"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {tab.label}

                {active && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 p-6">
        {/* Messages */}
        {message && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 text-xs text-emerald-400">
            <Check size={14} />
            {message}

            <button
              type="button"
              onClick={() =>
                setMessage("")
              }
              className="ml-auto"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-xs text-red-400">
            {error}

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              className="ml-auto"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Controls - only Ready */}
        {activeTab === "pending" && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="grid gap-3 xl:grid-cols-[1.2fr_1fr_1fr_auto_auto]">
              {/* Template */}
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Email Template
                </label>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <select
                      value={
                        selectedTemplateId
                      }
                      onChange={(e) =>
                        setSelectedTemplateId(
                          e.target.value
                            ? Number(
                                e.target.value
                              )
                            : ""
                        )
                      }
                      className="w-full appearance-none rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 pr-8 text-xs text-slate-200 outline-none focus:border-blue-500/50"
                    >
                      <option value="">
                        Select template
                      </option>

                      {templates.map(
                        (template) => (
                          <option
                            key={
                              template.id
                            }
                            value={
                              template.id
                            }
                          >
                            {template.name}
                          </option>
                        )
                      )}
                    </select>

                    <ChevronDown
                      size={13}
                      className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={
                      openViewTemplate
                    }
                    disabled={
                      !currentTemplate
                    }
                    title="View template"
                    className="rounded-lg border border-slate-800 px-2.5 text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:opacity-40"
                  >
                    <Mail size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={
                      openEditTemplate
                    }
                    disabled={
                      !currentTemplate
                    }
                    title="Edit template"
                    className="rounded-lg border border-slate-800 px-2.5 text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:opacity-40"
                  >
                    <Pencil size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={
                      openAddTemplate
                    }
                    title="Add template"
                    className="rounded-lg border border-blue-500/20 bg-blue-600/10 px-2.5 text-blue-400 transition hover:bg-blue-600/20"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Fixed sender */}
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Send From
                </label>
                <div className="flex h-[38px] items-center rounded-lg border border-slate-800 bg-slate-950 px-3 text-xs text-slate-200">
                  <Mail size={13} className="mr-2 shrink-0 text-slate-600" />
                  <span className="truncate">{FIXED_SENDER_EMAIL}</span>
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Schedule Date
                </label>

                <div className="relative">
                  <CalendarDays
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
                  />

                  <input
                    type="date"
                    min={today}
                    value={scheduleDate}
                    onChange={(e) =>
                      setScheduleDate(
                        e.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-9 pr-3 text-xs text-slate-200 outline-none focus:border-blue-500/50"
                  />
                </div>
              </div>

              {/* Time */}
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Time
                </label>

                <div className="relative">
                  <Clock3
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
                  />

                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) =>
                      setScheduleTime(
                        e.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-9 pr-3 text-xs text-slate-200 outline-none focus:border-blue-500/50"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={
                    handleSendNow
                  }
                  disabled={
                    processing
                  }
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
                >
                  <Send size={14} />

                  Send Now
                </button>

                <button
                  type="button"
                  onClick={
                    handleSchedule
                  }
                  disabled={
                    processing
                  }
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-xs font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
                >
                  <CalendarDays
                    size={14}
                  />

                  Schedule
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative w-full max-w-sm">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
            />

            <input
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Search leads..."
              className="w-full rounded-lg border border-slate-800 bg-slate-900/50 py-2.5 pl-9 pr-3 text-xs text-white outline-none placeholder:text-slate-600 focus:border-blue-500/50"
            />
          </div>

          <div className="text-[11px] text-slate-500">
            {selectedIds.length > 0 && (
              <>
                <span className="text-blue-400">
                  {selectedIds.length}
                </span>{" "}
                selected
              </>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80">
                  {activeTab ===
                    "pending" && (
                    <th className="w-10 px-3 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={
                          allVisibleSelected
                        }
                        onChange={
                          toggleAll
                        }
                        className="h-3.5 w-3.5 accent-blue-500"
                      />
                    </th>
                  )}

                  <th className="w-12 px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    #
                  </th>

                  <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    Sector
                  </th>

                  <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    Website
                  </th>

                  <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    Email
                  </th>

                  <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    Location
                  </th>

                  {activeTab ===
                    "scheduled" && (
                    <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                      Scheduled
                    </th>
                  )}

                  {activeTab ===
                    "sent" && (
                    <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                      Sent
                    </th>
                  )}

                  {activeTab ===
                    "failed" && (
                    <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                      Error
                    </th>
                  )}

                  {activeTab ===
                    "scheduled" && (
                    <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                      Action
                    </th>
                  )}
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={
                        activeTab ===
                        "pending"
                          ? 6
                          : activeTab ===
                              "scheduled"
                            ? 8
                            : 7
                      }
                      className="px-4 py-12 text-center text-xs text-slate-600"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : filteredLeads.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={
                        activeTab ===
                        "pending"
                          ? 6
                          : activeTab ===
                              "scheduled"
                            ? 8
                            : 7
                      }
                      className="px-4 py-12 text-center text-xs text-slate-600"
                    >
                      No leads found.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map(
                    (lead, index) => (
                      <tr
                        key={lead.id}
                        className="border-b border-slate-800/70 transition hover:bg-slate-900/50"
                      >
                        {activeTab ===
                          "pending" && (
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(
                                lead.id
                              )}
                              onChange={() =>
                                toggleLead(
                                  lead.id
                                )
                              }
                              className="h-3.5 w-3.5 accent-blue-500"
                            />
                          </td>
                        )}

                        <td className="px-3 py-3 text-[11px] text-slate-600">
                          {index + 1}
                        </td>

                        <td className="px-3 py-3 text-xs text-slate-300">
                          {lead.sector ||
                            "—"}
                        </td>

                        <td className="max-w-[240px] px-3 py-3">
                          <a
                            href={
                              lead.website
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="truncate text-xs text-blue-400 hover:text-blue-300"
                          >
                            {lead.website}
                          </a>
                        </td>

                        <td className="px-3 py-3 text-xs text-slate-300">
                          {lead.email ||
                            "—"}
                        </td>

                        <td className="px-3 py-3 text-xs text-slate-400">
                          {lead.location ||
                            "—"}
                        </td>

                        {activeTab ===
                          "scheduled" && (
                          <td className="px-3 py-3 text-xs text-slate-400">
                            {lead.emailScheduledAt
                              ? new Date(
                                  lead.emailScheduledAt
                                ).toLocaleString()
                              : "—"}
                          </td>
                        )}

                        {activeTab ===
                          "sent" && (
                          <td className="px-3 py-3 text-xs text-slate-400">
                            {lead.emailSentAt
                              ? new Date(
                                  lead.emailSentAt
                                ).toLocaleString()
                              : "—"}
                          </td>
                        )}

                        {activeTab ===
                          "failed" && (
                          <td className="max-w-[320px] px-3 py-3 text-xs text-red-400">
                            {lead.emailError ||
                              "Email sending failed."}
                          </td>
                        )}

                        {activeTab ===
                          "scheduled" && (
                          <td className="px-3 py-3 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                cancelScheduled(
                                  lead.id
                                )
                              }
                              className="rounded-lg border border-red-500/20 px-2.5 py-1.5 text-[10px] font-medium text-red-400 transition hover:bg-red-500/10"
                            >
                              Cancel
                            </button>
                          </td>
                        )}
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Template Modal */}
      <EmailTemplateModal
        open={templateModalOpen}
        mode={templateModalMode}
        template={selectedTemplate}
        onClose={() =>
          setTemplateModalOpen(false)
        }
        onSaved={
          handleTemplateSaved
        }
        onDeleted={
          handleTemplateDeleted
        }
      />
    </div>
  );
}
