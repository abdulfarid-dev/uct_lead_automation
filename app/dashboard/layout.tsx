import type { ReactNode } from "react";
import AdminLayout from "@/app/components/layout/AdminLayout";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AdminLayout>{children}</AdminLayout>;
}