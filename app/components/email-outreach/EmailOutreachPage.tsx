"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Mail, X } from "lucide-react";

import OutreachPerformance from "./OutreachPerformance";
import OutreachTabs from "./OutreachTabs";
import OutreachToolbar from "./OutreachToolbar";
import OutreachLeadsTable from "./OutreachLeadsTable";
import EmailTemplateModal, { EmailTemplate } from "./EmailTemplateModal";

type Tab =
  | "pending"
  | "scheduled"
  | "sent"
  | "delivered"
  | "replied"
  | "failed";

type Lead = {
  id: number;
  sector: string;
  website: string;
  location: string | null;
  email: string | null;
  verificationStatus: string;
  emailStatus: string;
  emailScheduledAt: string | null;
  emailSentAt: string | null;
  emailDeliveredAt: string | null;
  emailOpenedAt: string | null;
  emailClickedAt: string | null;
  emailError: string | null;
};

type Template = EmailTemplate;

const emptyCounts: Record<Tab, number> = {
  pending: 0,
  scheduled: 0,
  sent: 0,
  delivered: 0,
  replied: 0,
  failed: 0,
};

function getLocalDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getLocalTimeValue(date: Date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}

function getDefaultSchedule() {
  const date = new Date();

  // Start with a practical future time, but keep it fully dynamic.
  date.setMinutes(date.getMinutes() + 30);
  date.setSeconds(0, 0);

  // Round up to the next 5-minute interval.
  const roundedMinutes = Math.ceil(date.getMinutes() / 5) * 5;
  date.setMinutes(roundedMinutes);

  return {
    date: getLocalDateValue(date),
    time: getLocalTimeValue(date),
  };
}

export default function EmailOutreachPage() {
  const [activeTab, setActiveTab] = useState<Tab>("pending");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [counts, setCounts] = useState(emptyCounts);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | "">(
    ""
  );

  const [search, setSearch] = useState("");
  const [scheduleDate, setScheduleDate] = useState(
    () => getDefaultSchedule().date
  );
  const [scheduleTime, setScheduleTime] = useState(
    () => getDefaultSchedule().time
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null
  );

  const today = getLocalDateValue(new Date());

  async function fetchLeads(status: Tab = activeTab, showLoader = true) {
    try {
      if (showLoader) setRefreshing(true);

      const response = await fetch(`/api/email-outreach?status=${status}`, {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to load leads.");
      }

      setLeads(data.leads || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leads.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function fetchCounts() {
    try {
      const response = await fetch("/api/email-outreach?resource=counts", {
        cache: "no-store",
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setCounts({ ...emptyCounts, ...data.counts });
      }
    } catch {
      // Keep the UI usable even if counts fail.
    }
  }

  async function fetchTemplates() {
    try {
      const response = await fetch("/api/email-outreach/templates", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to load Brevo templates.");
      }

      const nextTemplates: Template[] = Array.isArray(data.templates)
        ? data.templates
        : [];

      setTemplates(nextTemplates);

      if (
        nextTemplates.length &&
        !nextTemplates.some((template) => template.id === selectedTemplateId)
      ) {
        setSelectedTemplateId(nextTemplates[0].id);
      }

      if (!nextTemplates.length) {
        setSelectedTemplateId("");
      }
    } catch (err) {
      setTemplates([]);
      setSelectedTemplateId("");
      setError(
        err instanceof Error ? err.message : "Failed to load Brevo templates."
      );
    }
  }

  useEffect(() => {
    Promise.all([
      fetchLeads("pending", false),
      fetchCounts(),
      fetchTemplates(),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSelectedIds([]);
    setSearch("");
    fetchLeads(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const filteredLeads = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) return leads;

    return leads.filter((lead) =>
      [lead.sector, lead.website, lead.location, lead.email]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value))
    );
  }, [leads, search]);

  const allVisibleSelected =
    filteredLeads.length > 0 &&
    filteredLeads.every((lead) => selectedIds.includes(lead.id));

  const currentTemplate =
    templates.find((template) => template.id === selectedTemplateId) || null;

  const senderEmail = currentTemplate?.sender?.email?.trim() || "";

  function handleTemplateChange(id: number | "") {
    setSelectedTemplateId(id);
    setError("");
  }

  function toggleLead(id: number) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function toggleAll() {
    if (allVisibleSelected) {
      setSelectedIds((current) =>
        current.filter(
          (id) => !filteredLeads.some((lead) => lead.id === id)
        )
      );
      return;
    }

    setSelectedIds((current) => [
      ...new Set([...current, ...filteredLeads.map((lead) => lead.id)]),
    ]);
  }

  async function refreshAll() {
    setMessage("");
    setError("");

    await Promise.all([
      fetchLeads(activeTab),
      fetchCounts(),
      fetchTemplates(),
    ]);
  }

  function openViewTemplate() {
    if (!currentTemplate) {
      setError("Select a template first.");
      return;
    }

    setSelectedTemplate(currentTemplate);
    setTemplateModalOpen(true);
  }

  function validateOutreach() {
    if (!selectedIds.length) {
      setError("Select at least one lead.");
      return false;
    }

    if (!selectedTemplateId || !currentTemplate) {
      setError("Select a Brevo template.");
      return false;
    }

    if (!senderEmail) {
      setError("The selected Brevo template has no sender email.");
      return false;
    }

    return true;
  }

  async function handleSchedule() {
    setMessage("");
    setError("");

    if (!validateOutreach()) return;

    if (!scheduleDate) {
      setError("Select a schedule date.");
      return;
    }

    if (!scheduleTime) {
      setError("Select a schedule time.");
      return;
    }

    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);

    if (Number.isNaN(scheduledAt.getTime())) {
      setError("Invalid schedule date or time.");
      return;
    }

    if (scheduledAt <= new Date()) {
      setError("Schedule time must be in the future.");
      return;
    }

    try {
      setProcessing(true);

      const response = await fetch("/api/email-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "schedule",
          leadIds: selectedIds,
          templateId: selectedTemplateId,
          senderEmail,
          scheduledAt: scheduledAt.toISOString(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to schedule emails.");
      }

      setMessage(data.message);
      setSelectedIds([]);

      const nextSchedule = getDefaultSchedule();
      setScheduleDate(nextSchedule.date);
      setScheduleTime(nextSchedule.time);

      await Promise.all([fetchLeads("pending", false), fetchCounts()]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to schedule emails."
      );
    } finally {
      setProcessing(false);
    }
  }

  async function handleSendNow() {
    setMessage("");
    setError("");

    if (!validateOutreach()) return;

    const confirmed = window.confirm(
      `Send email to ${selectedIds.length} selected lead(s) now?`
    );

    if (!confirmed) return;

    try {
      setProcessing(true);

      const response = await fetch("/api/email-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send-now",
          leadIds: selectedIds,
          templateId: selectedTemplateId,
          senderEmail,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to queue emails.");
      }

      setMessage(data.message);
      setSelectedIds([]);

      await Promise.all([fetchLeads("pending", false), fetchCounts()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to queue emails.");
    } finally {
      setProcessing(false);
    }
  }

  async function cancelScheduled(leadId: number) {
    if (!window.confirm("Cancel this scheduled email?")) return;

    try {
      const response = await fetch("/api/email-outreach", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: [leadId] }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to cancel email.");
      }

      setMessage("Scheduled email cancelled.");
      await Promise.all([fetchLeads("scheduled", false), fetchCounts()]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to cancel email."
      );
    }
  }

  async function retryFailed(leadId: number) {
    try {
      const response = await fetch("/api/email-outreach", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadIds: [leadId],
          status: "pending",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to retry lead.");
      }

      setMessage("Lead moved back to Verified.");
      await Promise.all([fetchLeads("failed", false), fetchCounts()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to retry lead.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <OutreachPerformance />

      <div className="border-b border-slate-800 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <Mail size={17} className="text-blue-400" />

          <div>
            <h1 className="text-sm font-semibold">Email Outreach</h1>
            <p className="text-[10px] text-slate-600">
              Brevo templates • verified leads • scheduling • delivery lifecycle
            </p>
          </div>
        </div>
      </div>

      <OutreachTabs
        activeTab={activeTab}
        counts={counts}
        onChange={setActiveTab}
      />

      {(message || error) && (
        <div className="px-4 pt-3 sm:px-5">
          {message && (
            <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-2 text-[10px] text-emerald-400">
              <Check size={12} />
              <span>{message}</span>

              <button
                type="button"
                onClick={() => setMessage("")}
                className="ml-auto"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {error && (
            <div className="mt-1.5 flex items-center gap-2 rounded-md border border-red-500/20 bg-red-500/5 px-2.5 py-2 text-[10px] text-red-400">
              <span>{error}</span>

              <button
                type="button"
                onClick={() => setError("")}
                className="ml-auto"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>
      )}

      <OutreachToolbar
        activeTab={activeTab}
        search={search}
        onSearchChange={setSearch}
        templates={templates}
        selectedTemplateId={selectedTemplateId}
        onTemplateChange={handleTemplateChange}
        onViewTemplate={openViewTemplate}
        senderEmail={senderEmail}
        scheduleDate={scheduleDate}
        scheduleTime={scheduleTime}
        today={today}
        onDateChange={setScheduleDate}
        onTimeChange={setScheduleTime}
        onSendNow={handleSendNow}
        onSchedule={handleSchedule}
        processing={processing}
        refreshing={refreshing}
        onRefresh={refreshAll}
        selectedCount={selectedIds.length}
      />

      <OutreachLeadsTable
        activeTab={activeTab}
        leads={leads}
        loading={loading}
        selectedIds={selectedIds}
        filteredLeads={filteredLeads}
        allVisibleSelected={allVisibleSelected}
        onToggleAll={toggleAll}
        onToggleLead={toggleLead}
        onCancel={cancelScheduled}
        onRetry={retryFailed}
      />

      <EmailTemplateModal
        open={templateModalOpen}
        template={selectedTemplate}
        onClose={() => setTemplateModalOpen(false)}
      />
    </div>
  );
}
