"use client";

import { FormEvent, useState } from "react";
import {
  FileText,
  MapPin,
  Play,
  Plus,
  Search,
} from "lucide-react";

const defaultPrompt =
  "Find potential customers in India. Focus on manufacturing and factories, industrial plants and machinery-intensive businesses, warehouses and logistics companies, fleet and transportation businesses, energy and utilities, solar companies, oil and gas, mining, agriculture and smart farming, greenhouses, healthcare facilities and medical equipment operations, large buildings and smart infrastructure, and engineering or equipment companies that operate industrial assets. For each relevant company, find the company name, official website, business email address, phone number, and business location. Return only real businesses and use their official website for verification. Exclude directories, job portals, news websites, blogs, publishers, and lead-data websites.";

const quickFilters = [
  "Manufacturing",
  "Logistics",
  "Solar",
  "Oil & Gas",
  "Agriculture",
];

interface ResearchFormProps {
  onResearchStart?: () => void;
  onResearchActivity?: (activity: {
    type: "info" | "success" | "warning" | "error";
    message: string;
  }) => void;
  onResearchComplete?: (data: {
    leadsFound: number;
    totalLeads?: number;
  }) => void;
  onResearchError?: (message: string) => void;
}

export default function ResearchForm({
  onResearchStart,
  onResearchActivity,
  onResearchComplete,
  onResearchError,
}: ResearchFormProps) {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!prompt.trim()) {
      setMessage("Please enter a research prompt.");
      return;
    }

    setLoading(true);
    setMessage("");
    onResearchStart?.();

    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          limit,
        }),
      });

      if (!response.ok) {
        let errorMessage = "Research could not be started.";

        try {
          const data = await response.json();
          errorMessage = data.error || errorMessage;
        } catch {
          // Keep the default error message.
        }

        throw new Error(errorMessage);
      }

      if (!response.body) {
        throw new Error("Research stream is not available.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const messages = buffer.split("\n\n");
        buffer = messages.pop() ?? "";

        for (const rawMessage of messages) {
          const dataLine = rawMessage
            .split("\n")
            .find((line) => line.startsWith("data: "));

          if (!dataLine) continue;

          try {
            const payload = JSON.parse(dataLine.slice(6));

            if (payload.type === "activity" && payload.event) {
              const event = payload.event;

              let activityType:
                | "info"
                | "success"
                | "warning"
                | "error" = "info";

              if (event.type === "success") {
                activityType = "success";
              } else if (
                event.type === "rejected" ||
                event.type === "skipped"
              ) {
                activityType = "warning";
              } else if (event.type === "error") {
                activityType = "error";
              }

              onResearchActivity?.({
                type: activityType,
                message: event.message,
              });
            }

            if (payload.type === "complete") {
              const leadsFound = Number(payload.leadsFound ?? 0);
              const totalLeads =
                typeof payload.totalLeads === "number"
                  ? payload.totalLeads
                  : undefined;

              setMessage(
                `Research completed · ${leadsFound} leads found`
              );

              onResearchComplete?.({
                leadsFound,
                totalLeads,
              });
            }

            if (payload.type === "error") {
              throw new Error(
                payload.message || "Research could not be completed."
              );
            }
          } catch (error) {
            if (error instanceof SyntaxError) {
              console.error("Invalid research stream event:", error);
              continue;
            }

            throw error;
          }
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Something went wrong.";

      setMessage(errorMessage);
      onResearchError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Research Prompt */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-black/10">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/15 text-blue-400">
              <Search size={19} />
            </div>

            <div>
              <h2 className="text-sm font-semibold text-white">
                Research Prompt
              </h2>

              <p className="mt-0.5 text-xs text-slate-500">
                Tell the system what type of businesses UCT should research.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={loading}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:text-white disabled:opacity-50"
          >
            Use Template
          </button>
        </div>

        <div className="relative">
          <FileText
            size={16}
            className="absolute left-3 top-3 text-slate-600"
          />

          <textarea
            id="research-prompt"
            value={prompt}
            onChange={(event) =>
              setPrompt(event.target.value)
            }
            rows={5}
            disabled={loading}
            className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 py-3 pl-10 pr-4 text-sm leading-6 text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        {/* Controls */}
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            {quickFilters.map((filter) => (
              <button
                key={filter}
                type="button"
                disabled={loading}
                onClick={() => {
                  setPrompt((current) =>
                    current.includes(filter)
                      ? current
                      : `${current}\nFocus additionally on ${filter} businesses.`
                  );
                }}
                className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1.5 text-[11px] font-medium text-slate-300 transition hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-300 disabled:opacity-50"
              >
                {filter}
              </button>
            ))}

            <button
              type="button"
              disabled={loading}
              className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950 px-3 py-1.5 text-[11px] font-medium text-slate-400 transition hover:border-slate-500 hover:text-white disabled:opacity-50"
            >
              <Plus size={13} />
              Add
            </button>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-3">
            {/* Research Limit */}
            <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5">
              <span className="text-xs font-medium text-slate-400">
                Limit
              </span>

              <select
                value={limit}
                onChange={(event) =>
                  setLimit(Number(event.target.value))
                }
                disabled={loading}
                className="bg-transparent text-xs font-semibold text-slate-200 outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Location */}
            <button
              type="button"
              disabled={loading}
              className="flex min-w-[130px] items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs font-medium text-slate-200 disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                <MapPin
                  size={15}
                  className="text-slate-400"
                />
                India
              </span>

              <span className="text-slate-500">
                ⌄
              </span>
            </button>

            {/* Start Research */}
            <button
              type="submit"
              disabled={loading}
              className="flex min-w-[145px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Play
                size={15}
                fill="currentColor"
              />

              {loading
                ? "Researching..."
                : "Start Research"}
            </button>
          </div>
        </div>

        {/* Result Message */}
        {message && (
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-slate-400">
            {message}
          </div>
        )}
      </section>
    </form>
  );
}
