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

type ExportLead = {
  sector: string;
  website: string;
  email: string;
  phone: string;
  verificationStatus: "verified" | "sent";
};

export default function VerifiedDataPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function loadVerifiedData() {
      try {
        const response = await fetch(
          "/api/verified-data",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            "Failed to fetch verified data"
          );
        }

        const data = await response.json();

        setLeads(
          Array.isArray(data) ? data : []
        );
      } catch (error) {
        console.error(
          "Verified data fetch error:",
          error
        );
        setLeads([]);
      } finally {
        setLoading(false);
      }
    }

    loadVerifiedData();
  }, []);

  const filteredLeads = useMemo(() => {
    const value = search
      .trim()
      .toLowerCase();

    if (!value) {
      return leads;
    }

    return leads.filter((lead) => {
      const fields = [
        lead.sector,
        lead.website,
        lead.email,
        lead.phone,
      ];

      return fields
        .filter(Boolean)
        .some((field) =>
          String(field)
            .toLowerCase()
            .includes(value)
        );
    });
  }, [leads, search]);

  function getStatusLabel(status: string) {
    return status === "sent"
      ? "Already Sent"
      : "Verified";
  }

  async function handleExportToGoogleSheets() {
    if (filteredLeads.length === 0) {
      alert(
        "There is no verified data to export."
      );
      return;
    }

    setExporting(true);

    try {
      const exportLeads: ExportLead[] =
        filteredLeads.map((lead) => ({
          sector: lead.sector || "",
          website: lead.website || "",
          email: lead.email || "",
          phone: lead.phone || "",
          verificationStatus:
            lead.verificationStatus ===
            "sent"
              ? "sent"
              : "verified",
        }));

      const response = await fetch(
        "/api/verified-data/export",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            source: "uct-lead-research",
            type: "verified-data-export",
            totalLeads:
              exportLeads.length,
            leads: exportLeads,
          }),
          cache: "no-store",
        }
      );

      const responseText =
        await response.text();

      let result: {
        success?: boolean;
        error?: string;
        details?: unknown;
        result?: unknown;
      } = {};

      try {
        result = responseText
          ? JSON.parse(responseText)
          : {};
      } catch {
        result = {
          error:
            responseText ||
            "Unknown export error",
        };
      }

      if (
        !response.ok ||
        result.success === false
      ) {
        throw new Error(
          result.error ||
            "Google Sheets export failed."
        );
      }

      const googleSheetUrl =
        "https://docs.google.com/spreadsheets/d/1ajE7mXomEMEndGVg8XHVN0sS6Ba45c1Vf2LSE1_k6sU/edit?gid=0";

      alert(
        `${exportLeads.length} lead${
          exportLeads.length === 1
            ? ""
            : "s"
        } exported successfully.`
      );

      window.open(
        googleSheetUrl,
        "_blank"
      );
    } catch (error) {
      console.error(
        "Google Sheets export error:",
        error
      );

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
      <div className="w-full px-4 py-4">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CheckCircle2
                size={16}
                className="text-emerald-400"
              />

              <h1 className="text-base font-semibold text-white">
                All Verified Data
              </h1>
            </div>

            <p className="mt-0.5 text-[10px] text-slate-500">
              Verified leads ready for outreach
              and export.
            </p>
          </div>

          <button
            type="button"
            onClick={
              handleExportToGoogleSheets
            }
            disabled={
              loading ||
              exporting ||
              filteredLeads.length === 0
            }
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-[10px] font-medium text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={13} />

            {exporting
              ? "Exporting..."
              : "Export to Google Sheets"}
          </button>
        </div>

        {/* Search + Count */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="relative w-full max-w-md">
            <Search
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600"
            />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search sector, website, email, phone..."
              className="h-8 w-full rounded-md border border-slate-800 bg-slate-950 pl-8 pr-8 text-[10px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500/50"
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-slate-600 hover:text-slate-300"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="shrink-0 rounded-md border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-[10px] text-slate-500">
            <span className="font-semibold text-white">
              {filteredLeads.length}
            </span>{" "}
            leads
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80 text-left">
                  <th className="w-10 px-2.5 py-2 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                    #
                  </th>

                  <th className="w-[210px] px-2.5 py-2 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                    Sector
                  </th>

                  <th className="w-[230px] px-2.5 py-2 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                    Website
                  </th>

                  <th className="w-[280px] px-2.5 py-2 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                    Email
                  </th>

                  <th className="w-[150px] px-2.5 py-2 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                    Phone
                  </th>

                  <th className="w-[130px] px-2.5 py-2 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="h-32 text-center"
                    >
                      <p className="text-[10px] text-slate-500">
                        Loading verified data...
                      </p>
                    </td>
                  </tr>
                ) : filteredLeads.length > 0 ? (
                  filteredLeads.map(
                    (lead, index) => {
                      const status =
                        getStatusLabel(
                          lead.verificationStatus
                        );

                      return (
                        <tr
                          key={lead.id}
                          className="border-b border-slate-900 last:border-b-0 hover:bg-slate-900/40"
                        >
                          <td className="px-2.5 py-2 text-[10px] font-medium text-slate-600">
                            {index + 1}
                          </td>

                          <td className="max-w-[210px] px-2.5 py-2">
                            <span
                              className="block truncate text-[10px] text-slate-200"
                              title={
                                lead.sector ||
                                ""
                              }
                            >
                              {lead.sector || "—"}
                            </span>
                          </td>

                          <td className="max-w-[230px] px-2.5 py-2">
                            {lead.website ? (
                              <a
                                href={
                                  lead.website.startsWith(
                                    "http"
                                  )
                                    ? lead.website
                                    : `https://${lead.website}`
                                }
                                target="_blank"
                                rel="noreferrer"
                                title={
                                  lead.website
                                }
                                className="block truncate text-[10px] text-blue-400 hover:text-blue-300"
                              >
                                {lead.website}
                              </a>
                            ) : (
                              <span className="text-[10px] text-slate-600">
                                —
                              </span>
                            )}
                          </td>

                          <td className="max-w-[280px] px-2.5 py-2">
                            <span
                              className="block truncate text-[10px] text-slate-400"
                              title={
                                lead.email ||
                                ""
                              }
                            >
                              {lead.email || "—"}
                            </span>
                          </td>

                          <td className="px-2.5 py-2 text-[10px] text-slate-400">
                            {lead.phone || "—"}
                          </td>

                          <td className="px-2.5 py-2">
                            <span
                              className={`inline-flex h-6 items-center rounded-md border px-2 text-[9px] font-medium ${
                                status ===
                                "Already Sent"
                                  ? "border-amber-500/30 bg-amber-500/5 text-amber-400"
                                  : "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
                              }`}
                            >
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    }
                  )
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="h-32 text-center"
                    >
                      <p className="text-[10px] text-slate-500">
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