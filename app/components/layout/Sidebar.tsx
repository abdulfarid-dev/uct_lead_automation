"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Database,
  LayoutDashboard,
  LogOut,
  Plus,
  Settings,
} from "lucide-react";

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Total Leads",
    href: "/dashboard/leads",
    icon: Database,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    router.push("/");
  }

  return (
    <aside className="fixed left-0 top-0 z-[9999] flex h-screen w-60 flex-col border-r border-slate-800 bg-slate-950">
      {/* =====================================================
          BRAND
      ====================================================== */}
     {/* Brand */}
<div className="flex h-16 shrink-0 items-center border-b border-slate-800 px-5">
  <div className="flex items-center gap-3">
    <img
      src="/logo.png"
      alt="UCT"
      className="h-20 w-auto object-contain"
    />

    <div>
      <p className="text-sm font-semibold text-white">
        UCT
      </p>

      <p className="text-[10px] text-slate-500">
        Lead Research
      </p>
    </div>
  </div>
</div>


      {/* =====================================================
          NAVIGATION
      ====================================================== */}
      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {/* Main */}
        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
          Main
        </p>

        <div className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;

            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition ${
                  isActive
                    ? "bg-blue-600/10 text-blue-400"
                    : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                }`}
              >
                {/* Active Indicator */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-blue-400" />
                )}

                <Icon
                  size={16}
                  className={
                    isActive
                      ? "text-blue-400"
                      : "text-slate-500 transition-colors group-hover:text-slate-300"
                  }
                />

                <span>{item.name}</span>

                {isActive && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-400" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Lead Management */}
        <p className="mb-3 mt-7 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
          Lead Management
        </p>

        <Link
          href="/dashboard/leads?add=1"
          className="group flex items-center gap-3 rounded-lg border border-blue-500/15 bg-blue-600/5 px-3 py-2.5 text-xs font-medium text-blue-400 transition hover:border-blue-500/25 hover:bg-blue-600/10"
        >
          <Plus
            size={16}
            className="text-blue-400 transition-transform group-hover:rotate-90"
          />

          <span>Add New Lead</span>
        </Link>
      </nav>

      {/* =====================================================
          SYSTEM STATUS + LOGOUT
      ====================================================== */}
      <div className="shrink-0 border-t border-slate-800 p-3">
        {/* System Status */}
        <div className="flex items-center gap-3 rounded-lg bg-slate-900/60 px-3 py-2.5">
          <div className="relative">
            <Activity
              size={15}
              className="text-emerald-400"
            />

            <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </div>

          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-300">
              System Online
            </p>

            <p className="text-[10px] text-slate-600">
              Research engine ready
            </p>
          </div>
        </div>

        {/* Admin Panel */}
        <div className="mt-2 flex items-center gap-2 px-3 py-2 text-[10px] text-slate-600">
          <Settings size={13} />
          <span>Admin Panel</span>
        </div>

        {/* Logout */}
        <button
          type="button"
          onClick={handleLogout}
          className="group mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[20px] font-medium text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut
            size={14}
            className="transition-transform group-hover:-translate-x-0.5"
          />

          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}