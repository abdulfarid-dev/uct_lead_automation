"use client";

type Tab = "pending" | "scheduled" | "sent" | "delivered" | "replied" | "failed";

type Props = {
  activeTab: Tab;
  counts: Record<Tab, number>;
  onChange: (tab: Tab) => void;
};

const tabs: { id: Tab; label: string }[] = [
  { id: "pending", label: "Verified" },
  { id: "scheduled", label: "Scheduled" },
  { id: "sent", label: "Sent" },
  { id: "delivered", label: "Delivered" },
  { id: "replied", label: "Reply" },
  { id: "failed", label: "Failed" },
];

export default function OutreachTabs({ activeTab, counts, onChange }: Props) {
  return (
    <div className="border-b border-slate-800 bg-slate-950 px-4 sm:px-5">
      <div className="flex gap-5 overflow-x-auto">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`relative flex shrink-0 items-center gap-1.5 py-2.5 text-[11px] font-medium transition ${
                active
                  ? "text-blue-400"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {tab.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[9px] ${
                  active
                    ? "bg-blue-500/10 text-blue-400"
                    : "bg-slate-900 text-slate-600"
                }`}
              >
                {counts[tab.id] ?? 0}
              </span>

              {active && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-blue-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
