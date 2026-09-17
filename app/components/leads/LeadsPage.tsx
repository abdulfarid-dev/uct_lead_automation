"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Edit3,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import LeadForm, {
  LeadFormData,
} from "./LeadForm";

export interface Lead {
  id: number;
  sector: string;
  website: string;
  location: string;
  phone: string;
  email: string;
  googleBusinessProfile: string;
}

type MessageType = "success" | "error" | "info";

interface ApiResponse {
  success?: boolean;
  leads?: unknown[];
  lead?: unknown;
  error?: string;
  message?: string;
}

function normalizeLead(value: unknown): Lead {
  const lead =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  return {
    id:
      typeof lead.id === "number"
        ? lead.id
        : Number(lead.id) || 0,

    sector:
      typeof lead.sector === "string"
        ? lead.sector
        : "",

    website:
      typeof lead.website === "string"
        ? lead.website
        : "",

    location:
      typeof lead.location === "string"
        ? lead.location
        : "",

    phone:
      typeof lead.phone === "string"
        ? lead.phone
        : "",

    email:
      typeof lead.email === "string"
        ? lead.email
        : "",

    googleBusinessProfile:
      typeof lead.googleBusinessProfile === "string"
        ? lead.googleBusinessProfile
        : "",
  };
}

async function readApiResponse(
  response: Response
): Promise<ApiResponse> {
  const text = await response.text();

  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text) as ApiResponse;
  } catch {
    return {
      error: `Server returned an invalid response (${response.status}).`,
    };
  }
}

function normalizeSearchValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getWebsiteUrl(website: string) {
  if (!website) {
    return "";
  }

  return website.startsWith("http://") ||
    website.startsWith("https://")
    ? website
    : `https://${website}`;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);

  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] =
    useState(false);

  const [showForm, setShowForm] =
    useState(false);

  const [editingLead, setEditingLead] =
    useState<Lead | null>(null);

  const [searchQuery, setSearchQuery] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [messageType, setMessageType] =
    useState<MessageType>("info");

  const fetchLeads = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) {
          setLoading(true);
        }

        setMessage("");

        const response = await fetch(
          "/api/leads",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const data =
          await readApiResponse(response);

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Failed to fetch leads."
          );
        }

        const nextLeads = Array.isArray(
          data.leads
        )
          ? data.leads.map(normalizeLead)
          : [];

        setLeads(nextLeads);
      } catch (error) {
        setMessageType("error");

        setMessage(
          error instanceof Error
            ? error.message
            : "Failed to fetch leads."
        );
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    void fetchLeads();

    const params = new URLSearchParams(
      window.location.search
    );

    if (params.get("add") === "1") {
      setEditingLead(null);
      setShowForm(true);

      window.history.replaceState(
        {},
        "",
        window.location.pathname
      );
    }
  }, [fetchLeads]);

  const filteredLeads = useMemo(() => {
    const query =
      normalizeSearchValue(searchQuery);

    if (!query) {
      return leads;
    }

    return leads.filter((lead) => {
      const searchableText = [
        lead.sector,
        lead.website,
        lead.email,
        lead.phone,
        lead.location,
        lead.googleBusinessProfile,
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [leads, searchQuery]);

  function showMessage(
    text: string,
    type: MessageType
  ) {
    setMessage(text);
    setMessageType(type);
  }

  function handleAddLead() {
    setEditingLead(null);
    setShowForm(true);
    setMessage("");
  }

  function handleEditLead(lead: Lead) {
    setEditingLead(lead);
    setShowForm(true);
    setMessage("");
  }

  function handleCloseForm() {
    if (formLoading) {
      return;
    }

    setShowForm(false);
    setEditingLead(null);
  }

  async function handleFormSubmit(
    formData: LeadFormData
  ) {
    try {
      setFormLoading(true);
      setMessage("");

      const isEdit =
        Boolean(editingLead);

      const url = isEdit
        ? `/api/leads/${editingLead?.id}`
        : "/api/leads";

      const method = isEdit
        ? "PATCH"
        : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data =
        await readApiResponse(response);

      if (!response.ok) {
        throw new Error(
          data.error ||
            `Failed to ${
              isEdit
                ? "update"
                : "create"
            } lead.`
        );
      }

      setShowForm(false);
      setEditingLead(null);

      await fetchLeads(false);

      showMessage(
        isEdit
          ? "Lead updated successfully."
          : "Lead added successfully.",
        "success"
      );
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong.",
        "error"
      );
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDeleteLead(
    lead: Lead
  ) {
    const confirmed =
      window.confirm(
        `Delete ${lead.website}? This action cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setMessage("");

      const response = await fetch(
        `/api/leads/${lead.id}`,
        {
          method: "DELETE",
        }
      );

      const data =
        await readApiResponse(response);

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to delete lead."
        );
      }

      setLeads((current) =>
        current.filter(
          (item) =>
            item.id !== lead.id
        )
      );

      showMessage(
        "Lead deleted successfully.",
        "success"
      );
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Failed to delete lead.",
        "error"
      );
    }
  }

    return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-white">
            all leads for Uniconverge Technology
          </h1>

          <p className="mt-0.5 text-xs text-slate-500">
            Manage and review all researched leads for UCT.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAddLead}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-blue-600/15 transition hover:bg-blue-500"
        >
          <Plus size={14} />
          Add Lead
        </button>
      </div>

      {/* Main Card */}
      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80 shadow-lg shadow-black/10">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/40 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div>
              <h2 className="text-xs font-semibold text-white">
                All Leads
              </h2>

              <p className="mt-0.5 text-[10px] text-slate-500">
                {searchQuery
                  ? `${filteredLeads.length} of ${leads.length} leads`
                  : `${leads.length} leads available`}
              </p>
            </div>

            <div className="hidden rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-[9px] font-medium text-slate-600 sm:block">
              PostgreSQL
            </div>
          </div>

          {/* Search + Refresh */}
          <div className="flex items-center gap-2">
            <div className="relative w-[280px] max-w-[45vw]">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600"
              />

              <input
                type="text"
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(
                    event.target.value
                  )
                }
                placeholder="Search website/company, email, sector..."
                className="h-8 w-full rounded-lg border border-slate-800 bg-slate-950 pl-8 pr-8 text-[11px] text-slate-300 outline-none transition placeholder:text-slate-600 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/10"
              />

              {searchQuery && (
                <button
                  type="button"
                  onClick={() =>
                    setSearchQuery("")
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 transition hover:text-slate-300"
                  aria-label="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                void fetchLeads(false)
              }
              title="Refresh leads"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-slate-500 transition hover:border-slate-700 hover:text-slate-200"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        {/* Status Message */}
        {message && (
          <div
            className={`border-b px-3 py-2 ${
              messageType === "error"
                ? "border-red-500/10 bg-red-500/5"
                : messageType === "success"
                  ? "border-emerald-500/10 bg-emerald-500/5"
                  : "border-slate-800 bg-slate-950/40"
            }`}
          >
            <p
              className={`text-[10px] ${
                messageType === "error"
                  ? "text-red-400"
                  : messageType === "success"
                    ? "text-emerald-400"
                    : "text-slate-400"
              }`}
            >
              {message}
            </p>
          </div>
        )}

        {/* Table Area */}
        {loading ? (
          <div className="flex h-[calc(100vh-245px)] min-h-[260px] items-center justify-center">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-700 border-t-blue-400" />
              Loading leads...
            </div>
          </div>
        ) : (
          <div className="leads-scroll max-h-[calc(100vh-245px)] min-h-[260px] overflow-auto">
            <table className="w-full min-w-[1120px] border-collapse text-left">
              <thead className="sticky top-0 z-30">
                <tr className="border-b border-slate-800 bg-slate-950">
                  {/* # */}
                  <th className="sticky left-0 z-40 w-10 border-r border-slate-800 bg-slate-950 px-2.5 py-2 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                    #
                  </th>

                  {/* Sector */}
                  <th className="w-[180px] px-2.5 py-2 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                    Sector
                  </th>

                  {/* Website */}
                  <th className="w-[210px] px-2.5 py-2 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                    Website
                  </th>

                  {/* Email */}
                  <th className="w-[240px] px-2.5 py-2 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                    Email
                  </th>

                  {/* Phone */}
                  <th className="w-[150px] px-2.5 py-2 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                    Phone
                  </th>

                  {/* Location */}
                  <th className="w-[190px] px-2.5 py-2 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                    Location
                  </th>

                  {/* Actions */}
                  <th className="sticky right-0 z-40 w-[88px] border-l border-slate-800 bg-slate-950 px-2.5 py-2 text-right text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/80">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="h-[240px] px-4 text-center"
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Search
                          size={22}
                          className="text-slate-700"
                        />

                        <p className="text-xs text-slate-500">
                          {searchQuery
                            ? "No leads match your search."
                            : "No leads found."}
                        </p>

                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() =>
                              setSearchQuery("")
                            }
                            className="text-[10px] text-blue-400 hover:text-blue-300"
                          >
                            Clear search
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map(
                    (lead, index) => (
                      <tr
                        key={lead.id}
                        className="group h-10 transition hover:bg-slate-800/35"
                      >
                        {/* # */}
                        <td className="sticky left-0 z-20 border-r border-slate-800/80 bg-slate-900 px-2.5 py-2 text-[10px] font-medium text-slate-500 group-hover:bg-slate-800/80">
                          {index + 1}
                        </td>

                        {/* Sector */}
                        <td className="max-w-[180px] px-2.5 py-2">
                          <span className="block truncate text-[11px] font-medium text-slate-200">
                            {lead.sector || "—"}
                          </span>
                        </td>

                        {/* Website */}
                        <td className="px-2.5 py-2">
                          {lead.website ? (
                            <a
                              href={getWebsiteUrl(
                                lead.website
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group/link flex max-w-[205px] items-center gap-1.5"
                              title={lead.website}
                            >
                              <Globe
                                size={12}
                                className="shrink-0 text-blue-400"
                              />

                              <span className="truncate text-[11px] text-blue-400 transition group-hover/link:text-blue-300">
                                {lead.website}
                              </span>

                              <ExternalLink
                                size={10}
                                className="shrink-0 text-slate-700 opacity-0 transition group-hover/link:opacity-100"
                              />
                            </a>
                          ) : (
                            <span className="text-[11px] text-slate-600">
                              —
                            </span>
                          )}
                        </td>

                        {/* Email */}
                        <td className="px-2.5 py-2">
                          {lead.email ? (
                            <div
                              className="flex max-w-[235px] items-center gap-1.5"
                              title={lead.email}
                            >
                              <Mail
                                size={12}
                                className="shrink-0 text-slate-600"
                              />

                              <span className="truncate text-[11px] text-slate-400">
                                {lead.email}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-600">
                              —
                            </span>
                          )}
                        </td>

                        {/* Phone */}
                        <td className="px-2.5 py-2">
                          {lead.phone ? (
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <Phone
                                size={12}
                                className="shrink-0 text-slate-600"
                              />

                              <span className="text-[11px] text-slate-400">
                                {lead.phone}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-600">
                              —
                            </span>
                          )}
                        </td>

                        {/* Location */}
                        <td className="max-w-[190px] px-2.5 py-2">
                          <div
                            className="flex max-w-[185px] items-center gap-1.5"
                            title={lead.location}
                          >
                            <MapPin
                              size={12}
                              className="shrink-0 text-slate-600"
                            />

                            <span className="truncate text-[11px] text-slate-400">
                              {lead.location || "—"}
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="sticky right-0 z-20 border-l border-slate-800/80 bg-slate-900 px-2.5 py-2 group-hover:bg-slate-800/90">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              title="Edit lead"
                              onClick={() =>
                                handleEditLead(
                                  lead
                                )
                              }
                              className="flex h-6.5 w-6.5 items-center justify-center rounded-md border border-slate-800 bg-slate-950 text-slate-500 transition hover:border-blue-500/40 hover:text-blue-400"
                            >
                              <Edit3 size={12} />
                            </button>

                            <button
                              type="button"
                              title="Delete lead"
                              onClick={() =>
                                void handleDeleteLead(
                                  lead
                                )
                              }
                              className="flex h-6.5 w-6.5 items-center justify-center rounded-md border border-slate-800 bg-slate-950 text-slate-500 transition hover:border-red-500/40 hover:text-red-400"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Bottom Info */}
        {!loading && filteredLeads.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/60 px-3 py-2">
            <p className="text-[9px] text-slate-600">
              Showing{" "}
              <span className="text-slate-500">
                {filteredLeads.length}
              </span>{" "}
              of{" "}
              <span className="text-slate-500">
                {leads.length}
              </span>{" "}
              leads
            </p>

            <p className="text-[9px] text-slate-600">
              PostgreSQL
            </p>
          </div>
        )}
      </section>

      {/* Add / Edit Form */}
      {showForm && (
        <LeadForm
          lead={editingLead}
          loading={formLoading}
          onSubmit={handleFormSubmit}
          onCancel={handleCloseForm}
        />
      )}
    </div>
  );
}