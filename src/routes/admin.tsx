import { createFileRoute } from "@tanstack/react-router";
import { AdminShellGate } from "@/components/AdminShell";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "لوحة الإدارة — سند" }] }),
  component: AdminShellGate,
});
