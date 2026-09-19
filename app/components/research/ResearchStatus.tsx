"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Database,
  FileSearch,
  History,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";

export interface ResearchStats {
  totalLeads: number;
  lastResearch: number;
  duplicatesRemoved: number;
  rejected: number;
}

export interface ActivityItem {
  id: number;
  type: "info" | "success" | "warning" | "error";
  message: string;
}

interface ResearchStatusProps {
  stats?: ResearchStats;
  activities?: ActivityItem[];
  loading?: boolean;
}

const defaultStats: ResearchStats = {
  totalLeads: 0,
  lastResearch: 0,
  duplicatesRemoved: 0,
  rejected: 0,
};

function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);

  useEffect(() => {
    const startValue = previousValue.current;
    const endValue = value;

    if (startValue === endValue) return;

    const difference = endValue - startValue;
    const duration = 300;
    const startTime = performance.now();

    let animationFrame = 0;

    function animate(currentTime: number) {
      const progress = Math.min(
        (currentTime - startTime) / duration,
        1
      );

      const easedProgress =
        1 - Math.pow(1 - progress, 3);

      setDisplayValue(
        Math.round(
          startValue + difference * easedProgress
        )
      );

      if (progress < 1) {
        animationFrame =
          requestAnimationFrame(animate);
      } else {
        previousValue.current = endValue;
      }
    }

    animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
      previousValue.current = endValue;
    };
  }, [value]);

  return <>{displayValue}</>;
}

export default function ResearchStatus({
  stats = defaultStats,
  activities = [],
  loading = false,
}: ResearchStatusProps) {
  const activityEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading) return;

    activityEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [activities, loading]);

  const statCards = [
    {
      title: "Total Leads",
      value: stats.totalLeads,
      icon: Database,
    },
    {
      title: "Last Research",
      value: stats.lastResearch,
      icon: FileSearch,
    },
    {
      title: "Duplicates Removed",
      value: stats.duplicatesRemoved,
      icon: History,
    },
    {
      title: "Rejected",
      value: stats.rejected,
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="mt-5 space-y-5">
      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.title}
              className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg shadow-black/10"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-medium text-slate-500">
                    {stat.title}
                  </p>

                  <p className="mt-2 text-2xl font-bold tracking-tight text-white">
                    <AnimatedNumber value={stat.value} />
                  </p>
                </div>

                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                  <Icon size={16} />
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Live Activity */}
      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-xl shadow-black/10">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  loading
                    ? "animate-pulse bg-blue-400"
                    : "bg-slate-600"
                }`}
              />

              <h2 className="text-sm font-semibold text-white">
                Live Activity
              </h2>
            </div>

            <p className="mt-1 text-xs text-slate-500">
              Real-time research activity
            </p>
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-xs text-blue-400">
              <Loader2 size={14} className="animate-spin" />
              Researching
            </div>
          )}
        </div>

        {/* Terminal - only this area scrolls */}
        <div className="max-h-[420px] min-h-[260px] overflow-y-auto bg-black px-5 py-4 font-mono text-xs">
          {activities.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-slate-600">
              Waiting for research to start...
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => (
                <ActivityRow
                  key={activity.id}
                  activity={activity}
                />
              ))}

              <div ref={activityEndRef} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ActivityRow({
  activity,
}: {
  activity: ActivityItem;
}) {
  const config = {
    info: {
      label: "INFO",
      className: "text-slate-400",
      icon: FileSearch,
    },
    success: {
      label: "SUCCESS",
      className: "text-emerald-400",
      icon: CheckCircle2,
    },
    warning: {
      label: "SKIPPED",
      className: "text-amber-400",
      icon: History,
    },
    error: {
      label: "ERROR",
      className: "text-red-400",
      icon: XCircle,
    },
  };

  const current = config[activity.type];
  const Icon = current.icon;

  return (
    <div className="flex items-start gap-3">
      <Icon
        size={14}
        className={`mt-0.5 shrink-0 ${current.className}`}
      />

      <span
        className={`w-[70px] shrink-0 text-[10px] font-semibold ${current.className}`}
      >
        {current.label}
      </span>

      <span className="leading-5 text-slate-400">
        {activity.message}
      </span>
    </div>
  );
}
