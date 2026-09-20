"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  Search,
  X,
} from "lucide-react";

type Lead = {
  id: number;
  sector: string;
  website: string;
  location: string | null;
  phone: string | null;
  email: string | null;
  googleBusinessProfile: string | null;
  verificationStatus: string;
  isVerified: boolean;
  verifiedAt: string | null;
  createdAt: string;
};

export default function VerifiedDataPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function loadVerifiedData() {
      try {
        const response = await fetch("/api/verified-data", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch verified data");
        }

        const data = await response.json();

        setLeads(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Verified data fetch error:", error);
        setLeads([]);
      } finally {
        setLoading(false);
      }
    }

    loadVerifiedData();
  }, []);

  const filteredLeads = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) {
      return leads;
    }

    return leads.filter((lead) => {
      const searchableFields = [
        lead.sector,
        lead.website,
        lead.location,
        lead.phone,
        lead.email,
        lead.googleBusinessProfile,
      ];

      return searchableFields
        .filter(Boolean)
        .some((field) =>
          String(field).toLowerCase().includes(value)
        );
    });
  }, [leads, search]);

  function formatDate(value: string | null) {
    if (!value) {
      return "—";
    }

    return new Date(value).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

   async function handleExportToGoogleSheets() {
  if (filteredLeads.length === 0) {
    alert("There is no verified data to export.");
    return;
  }

  setExporting(true);

  try {
    const response = await fetch("/api/verified-data/export", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "uct-lead-research",
        type: "verified-data-export",
        exportedAt: new Date().toISOString(),
        totalLeads: filteredLeads.length,
        leads: filteredLeads,
      }),
      cache: "no-store",
    });

    const responseText = await response.text();

    let result: {
      success?: boolean;
      error?: string;
      details?: unknown;
      result?: unknown;
    } = {};

    try {
      result = responseText ? JSON.parse(responseText) : {};
    } catch {
      result = {
        error: responseText || "Unknown export error",
      };
    }

    if (!response.ok || result.success === false) {
      console.error("Verified data export API error:", result);

      const details =
        typeof result.details === "string"
          ? result.details
          : result.details
            ? JSON.stringify(result.details)
            : "";

      throw new Error(
        result.error ||
          details ||
          `Export failed with status ${response.status}`
      );
    }

    // New Google Sheet
    const googleSheetUrl =
      "https://docs.google.com/spreadsheets/d/1ajE7mXomEMEndGVg8XHVN0sS6Ba45c1Vf2LSE1_k6sU/edit?gid=0";

    alert(
      `${filteredLeads.length} verified lead${
        filteredLeads.length === 1 ? "" : "s"
      } exported successfully.`
    );

    // Open the actual Google Sheet after successful export
    window.open(googleSheetUrl, "_blank");
  } catch (error) {
    console.error("Google Sheets export error:", error);

    alert(
      error instanceof Error
        ? error.message
        : "Google Sheets export failed."
    );
  } finally {
    setExporting(false);
  }
}
  return (
    <main className="min-h-screen w-full bg-slate-950">
      <div className="w-full px-6 py-6">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CheckCircle2
                size={18}
                className="text-emerald-400"
              />

              <h1 className="text-lg font-semibold text-white">
                All Verified Data
              </h1>
            </div>

            <p className="mt-1 text-xs text-slate-500">
              All leads manually verified and ready for export.
            </p>
          </div>

          {/* Export */}
          <button
            type="button"
            onClick={handleExportToGoogleSheets}
            disabled={
              loading ||
              exporting ||
              filteredLeads.length === 0
            }
            className="flex h-9 shrink-0 items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 text-xs font-medium text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={14} />

            {exporting
              ? "Exporting..."
              : "Export to Google Sheets"}
          </button>
        </div>

        {/* Search + Count */}
        <div className="mb-4 flex w-full items-center justify-between gap-3">
          <div className="relative w-full max-w-xl">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search company, website, email, sector, location..."
              className="h-9 w-full rounded-md border border-slate-800 bg-slate-950 pl-9 pr-9 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500/50"
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-slate-500 transition hover:bg-slate-900 hover:text-slate-200"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="shrink-0 rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-[11px] text-slate-400">
            <span className="font-semibold text-white">
              {filteredLeads.length}
            </span>{" "}
            {search ? "matching" : "verified"} lead
            {filteredLeads.length === 1 ? "" : "s"}
          </div>
        </div>

        {/* Table */}
        <div className="w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[1050px] border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/70 text-left">
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Sector
                  </th>

                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Website
                  </th>

                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Location
                  </th>

                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Phone
                  </th>

                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Email
                  </th>

                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Verified
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-14 text-center"
                    >
                      <p className="text-sm text-slate-500">
                        Loading verified data...
                      </p>
                    </td>
                  </tr>
                ) : filteredLeads.length > 0 ? (
                  filteredLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-b border-slate-900 last:border-b-0 hover:bg-slate-900/40"
                    >
                      {/* Sector */}
                      <td className="px-4 py-3 text-xs text-slate-200">
                        {lead.sector || "—"}
                      </td>

                      {/* Website */}
                      <td className="max-w-[260px] px-4 py-3">
                        {lead.website ? (
                          <a
                            href={
                              lead.website.startsWith("http")
                                ? lead.website
                                : `https://${lead.website}`
                            }
                            target="_blank"
                            rel="noreferrer"
                            title={lead.website}
                            className="block truncate text-xs text-blue-400 hover:text-blue-300"
                          >
                            {lead.website}
                          </a>
                        ) : (
                          <span className="text-xs text-slate-600">
                            —
                          </span>
                        )}
                      </td>

                      {/* Location */}
                      <td className="max-w-[240px] truncate px-4 py-3 text-xs text-slate-400">
                        {lead.location || "—"}
                      </td>

                      {/* Phone */}
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {lead.phone || "—"}
                      </td>

                      {/* Email */}
                      <td className="max-w-[280px] px-4 py-3 text-xs text-slate-400">
                        <span
                          className="block truncate"
                          title={lead.email || ""}
                        >
                          {lead.email || "—"}
                        </span>
                      </td>

                      {/* Verified */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle2
                            size={14}
                            className="text-emerald-400"
                          />

                          <div>
                            <p className="text-[11px] font-medium text-emerald-400">
                              Verified
                            </p>

                            <p className="text-[10px] text-slate-600">
                              {formatDate(lead.verifiedAt)}
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-14 text-center"
                    >
                      <p className="text-sm text-slate-500">
                        {search
                          ? "No verified leads match your search."
                          : "No verified leads found."}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}