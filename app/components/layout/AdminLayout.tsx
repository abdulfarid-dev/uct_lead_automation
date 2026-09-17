"use client";

import { ReactNode } from "react";
import Sidebar from "./Sidebar";

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({
  children,
}: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Fixed Sidebar */}
      <Sidebar />

      {/* Main Application Area */}
      <div className="min-h-screen pl-60">
        <main className="min-h-screen w-full">
          <div className="mx-auto w-full max-w-[1600px] px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}