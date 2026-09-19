"use client";

import { useEffect, useState } from "react";
import ResearchForm from "./ResearchForm";
import ResearchStatus, {
  ActivityItem,
  ResearchStats,
} from "./ResearchStatus";

export default function ResearchPage() {
  const [loading, setLoading] = useState(false);

  const [stats, setStats] = useState<ResearchStats>({
    totalLeads: 0,
    lastResearch: 0,
    duplicatesRemoved: 0,
    rejected: 0,
  });

  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      try {
        const response = await fetch("/api/research", {
          method: "GET",
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok || cancelled) return;

        setStats((current) => ({
          ...current,
          totalLeads: Number(data.totalLeads ?? 0),
        }));
      } catch (error) {
        console.error("Failed to load research stats:", error);
      }
    }

    loadStats();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleResearchStart() {
    setLoading(true);

    setStats((current) => ({
      ...current,
      lastResearch: 0,
      duplicatesRemoved: 0,
      rejected: 0,
    }));

    setActivities([
      {
        id: Date.now(),
        type: "info",
        message: "Research started",
      },
    ]);
  }

  function handleResearchActivity(activity: {
    type: "info" | "success" | "warning" | "error";
    message: string;
  }) {
    const message = activity.message;

    setActivities((current) => [
      ...current,
      {
        id: Date.now() + current.length,
        type: activity.type,
        message,
      },
    ]);

    /*
     * IMPORTANT:
     * Only successful "Found X new lead(s)" events increase
     * the live database counter.
     *
     * The backend emits this event only after the lead has
     * been successfully saved to PostgreSQL.
     */
    if (
      activity.type === "success" &&
      /^Found \d+ new lead(s)?:/i.test(message)
    ) {
      setStats((current) => ({
        ...current,
        totalLeads: current.totalLeads + 1,
        lastResearch: current.lastResearch + 1,
      }));

      return;
    }

    /*
     * Rejected and skipped leads are intentionally kept only
     * in frontend state. They are NOT stored in the database.
     */
    if (
      activity.type === "warning" &&
      /^SKIPPED|^Duplicate lead skipped|^Lead rejected|^REJECTED/i.test(
        message
      )
    ) {
      const isRejected =
        /^Lead rejected|^REJECTED/i.test(message);

      setStats((current) => ({
        ...current,
        rejected: isRejected
          ? current.rejected + 1
          : current.rejected,
        duplicatesRemoved: isRejected
          ? current.duplicatesRemoved
          : current.duplicatesRemoved + 1,
      }));
    }
  }

  function handleResearchComplete(data: {
    leadsFound: number;
    totalLeads?: number;
  }) {
    setLoading(false);

    setStats((current) => ({
      ...current,
      /*
       * Do not overwrite the live counter with an old value.
       * The counter has already been updated lead-by-lead.
       *
       * If the API sends the final DB total, use it only as
       * a final synchronization point.
       */
      totalLeads:
        typeof data.totalLeads === "number"
          ? data.totalLeads
          : current.totalLeads,
      lastResearch: current.lastResearch,
    }));

    setActivities((current) => [
      ...current,
      {
        id: Date.now(),
        type: "success",
        message: `Research completed · ${data.leadsFound} leads found`,
      },
    ]);
  }

  function handleResearchError(message: string) {
    setLoading(false);

    setActivities((current) => [
      ...current,
      {
        id: Date.now(),
        type: "error",
        message,
      },
    ]);
  }

  return (
    <div className="space-y-5">
      <ResearchForm
        onResearchStart={handleResearchStart}
        onResearchActivity={handleResearchActivity}
        onResearchComplete={handleResearchComplete}
        onResearchError={handleResearchError}
      />

      <ResearchStatus
        stats={stats}
        activities={activities}
        loading={loading}
      />
    </div>
  );
}
