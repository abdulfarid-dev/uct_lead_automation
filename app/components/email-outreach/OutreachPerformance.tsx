"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  Eye,
  MousePointerClick,
  RefreshCw,
  Send,
  UserMinus,
} from "lucide-react";

type Metrics = {
  sent: number;
  delivered: number;
  deliveredRate: number;
  opens: number;
  openRate: number;
  clicks: number;
  clickRate: number;
  conversions: number;
  conversionRate: number;
  unsubscribes: number;
  unsubscribeRate: number;
};

const cards = [
  { key: "delivered", label: "Delivered", rate: "deliveredRate", icon: CheckCircle2 },
  { key: "opens", label: "Opens", rate: "openRate", icon: Eye },
  { key: "clicks", label: "Clicks", rate: "clickRate", icon: MousePointerClick },
  { key: "conversions", label: "Conversions", rate: "conversionRate", icon: BarChart3 },
  { key: "unsubscribes", label: "Unsubscribes", rate: "unsubscribeRate", icon: UserMinus },
] as const;

export default function OutreachPerformance() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);
      const response = await fetch("/api/email-outreach/performance?days=90", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to load performance.");
      }

      setMetrics(data.metrics);
    } catch {
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="border-b border-slate-800 bg-slate-950 px-4 py-3 sm:px-5">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={15} className="text-blue-400" />
          <h2 className="text-xs font-semibold text-slate-200">
            Email Performance
          </h2>
          <span className="text-[10px] text-slate-600">Last 90 days</span>
        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          title="Refresh performance"
          className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-900 hover:text-slate-200 disabled:opacity-40"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;
          const value = metrics?.[card.key] ?? 0;
          const rate = metrics?.[card.rate] ?? 0;

          return (
            <div
              key={card.key}
              className="rounded-lg border border-slate-800 bg-slate-900/45 px-3 py-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  {card.label}
                </span>
                <Icon size={13} className="text-slate-600" />
              </div>

              <div className="mt-1 flex items-end justify-between gap-2">
                <span className="text-lg font-semibold leading-none text-slate-100">
                  {loading ? "—" : value.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-500">
                  {loading ? "—" : `${rate}%`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-600">
        <Send size={11} />
        {loading
          ? "Loading Brevo statistics..."
          : `Delivered ${metrics?.delivered.toLocaleString() ?? 0} of ${metrics?.sent.toLocaleString() ?? 0} requests`}
      </div>
    </section>
  );
}
