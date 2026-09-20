import { ExternalLink, RotateCcw, XCircle } from "lucide-react";

type Tab = "pending" | "scheduled" | "sent" | "delivered" | "replied" | "failed";

type Lead = {
  id: number;
  sector: string;
  website: string;
  location: string | null;
  email: string | null;
  emailStatus: string;
  emailScheduledAt: string | null;
  emailSentAt: string | null;
  emailDeliveredAt: string | null;
  emailOpenedAt: string | null;
  emailClickedAt: string | null;
  emailError: string | null;
};

type Props = {
  activeTab: Tab;
  leads: Lead[];
  loading: boolean;
  selectedIds: number[];
  filteredLeads: Lead[];
  allVisibleSelected: boolean;
  onToggleAll: () => void;
  onToggleLead: (id: number) => void;
  onCancel: (id: number) => void;
  onRetry: (id: number) => void;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default function OutreachLeadsTable({
  activeTab,
  leads,
  loading,
  selectedIds,
  filteredLeads,
  allVisibleSelected,
  onToggleAll,
  onToggleLead,
  onCancel,
  onRetry,
}: Props) {
  const emptyMessage =
    activeTab === "replied"
      ? "No replies tracked yet."
      : "No leads found.";

  return (
    <div className="mx-4 mb-4 overflow-hidden rounded-lg border border-slate-800 sm:mx-5">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/75">
              {activeTab === "pending" && (
                <th className="w-9 px-2.5 py-2.5">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={onToggleAll}
                    className="h-3.5 w-3.5 accent-blue-500"
                  />
                </th>
              )}
              <th className="w-10 px-2.5 py-2.5 text-left text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                #
              </th>
              <th className="px-2.5 py-2.5 text-left text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                Sector
              </th>
              <th className="px-2.5 py-2.5 text-left text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                Website
              </th>
              <th className="px-2.5 py-2.5 text-left text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                Email
              </th>
              <th className="px-2.5 py-2.5 text-left text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                Location
              </th>
              {activeTab === "scheduled" && (
                <th className="px-2.5 py-2.5 text-left text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                  Scheduled
                </th>
              )}
              {activeTab === "sent" && (
                <th className="px-2.5 py-2.5 text-left text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                  Sent
                </th>
              )}
              {activeTab === "delivered" && (
                <th className="px-2.5 py-2.5 text-left text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                  Delivered
                </th>
              )}
              {activeTab === "replied" && (
                <th className="px-2.5 py-2.5 text-left text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                  Reply
                </th>
              )}
              {activeTab === "failed" && (
                <th className="px-2.5 py-2.5 text-left text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                  Error
                </th>
              )}
              {activeTab === "scheduled" && (
                <th className="px-2.5 py-2.5 text-right text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                  Action
                </th>
              )}
              {activeTab === "failed" && (
                <th className="px-2.5 py-2.5 text-right text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                  Action
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-[11px] text-slate-600">
                  Loading...
                </td>
              </tr>
            ) : !filteredLeads.length ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-[11px] text-slate-600">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              filteredLeads.map((lead, index) => (
                <tr
                  key={lead.id}
                  className="border-b border-slate-800/70 transition hover:bg-slate-900/45"
                >
                  {activeTab === "pending" && (
                    <td className="px-2.5 py-2.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(lead.id)}
                        onChange={() => onToggleLead(lead.id)}
                        className="h-3.5 w-3.5 accent-blue-500"
                      />
                    </td>
                  )}

                  <td className="px-2.5 py-2.5 text-[10px] text-slate-600">
                    {index + 1}
                  </td>

                  <td className="px-2.5 py-2.5 text-[11px] text-slate-300">
                    {lead.sector || "—"}
                  </td>

                  <td className="max-w-[240px] px-2.5 py-2.5">
                    <a
                      href={lead.website}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex max-w-[230px] items-center gap-1 truncate text-[11px] text-blue-400 hover:text-blue-300"
                    >
                      <span className="truncate">{lead.website}</span>
                      <ExternalLink size={10} className="shrink-0" />
                    </a>
                  </td>

                  <td className="px-2.5 py-2.5 text-[11px] text-slate-300">
                    {lead.email || "—"}
                  </td>

                  <td className="px-2.5 py-2.5 text-[11px] text-slate-400">
                    {lead.location || "—"}
                  </td>

                  {activeTab === "scheduled" && (
                    <td className="px-2.5 py-2.5 text-[11px] text-slate-400">
                      {formatDate(lead.emailScheduledAt)}
                    </td>
                  )}

                  {activeTab === "sent" && (
                    <td className="px-2.5 py-2.5 text-[11px] text-slate-400">
                      {formatDate(lead.emailSentAt)}
                    </td>
                  )}

                  {activeTab === "delivered" && (
                    <td className="px-2.5 py-2.5 text-[11px] text-slate-400">
                      {formatDate(lead.emailDeliveredAt)}
                    </td>
                  )}

                  {activeTab === "replied" && (
                    <td className="px-2.5 py-2.5 text-[11px] text-slate-400">
                      Reply tracking will appear here after inbound email integration.
                    </td>
                  )}

                  {activeTab === "failed" && (
                    <td className="max-w-[330px] px-2.5 py-2.5 text-[11px] text-red-400">
                      {lead.emailError || "Email sending failed."}
                    </td>
                  )}

                  {activeTab === "scheduled" && (
                    <td className="px-2.5 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => onCancel(lead.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-500/20 px-2 py-1.5 text-[10px] font-medium text-red-400 hover:bg-red-500/10"
                      >
                        <XCircle size={11} />
                        Cancel
                      </button>
                    </td>
                  )}

                  {activeTab === "failed" && (
                    <td className="px-2.5 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => onRetry(lead.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1.5 text-[10px] font-medium text-slate-300 hover:bg-slate-800"
                      >
                        <RotateCcw size={11} />
                        Retry
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
