import type { SubmissionFilters } from "@/lib/submissions-list";

export type QuickFilterId = "my_review" | "stale" | "high_urgency_pending";

export type QuickFilterPreset = {
  id: QuickFilterId;
  label: string;
  filters: Partial<SubmissionFilters> & {
    assignFilter?: "all" | "unassigned" | string;
  };
};

function staleBeforeDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

export function quickFilterPresets(userId: string | undefined): QuickFilterPreset[] {
  return [
    {
      id: "my_review",
      label: "تحتاج مراجعتي",
      filters: userId
        ? {
            assigned_to: userId,
            status: undefined,
            assignFilter: userId,
          }
        : { assignFilter: "all" },
    },
    {
      id: "stale",
      label: "متأخرة (+7 أيام)",
      filters: {
        status: "submitted",
        created_to: staleBeforeDate(),
        assignFilter: "all",
      },
    },
    {
      id: "high_urgency_pending",
      label: "عجلة عالية معلّقة",
      filters: {
        status: "submitted",
        urgency_min: 85,
        assignFilter: "all",
      },
    },
  ];
}

export function matchQuickFilter(
  id: QuickFilterId,
  userId: string | undefined,
  state: {
    filters: SubmissionFilters;
    assignFilter: string;
    status: string;
    createdTo: string;
    urgencyMin: string;
  },
): boolean {
  const preset = quickFilterPresets(userId).find((p) => p.id === id);
  if (!preset) return false;

  switch (id) {
    case "my_review":
      return Boolean(userId && state.assignFilter === userId);
    case "stale":
      return (
        state.status === "submitted" &&
        state.createdTo === staleBeforeDate() &&
        state.assignFilter === "all"
      );
    case "high_urgency_pending":
      return (
        state.status === "submitted" &&
        state.urgencyMin === "85" &&
        state.assignFilter === "all"
      );
    default:
      return false;
  }
}
