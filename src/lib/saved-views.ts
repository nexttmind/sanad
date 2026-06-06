import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { SubmissionFilters, SubmissionSort } from "@/lib/submissions-list";

export type SavedView = {
  id: string;
  user_id: string;
  name: string;
  filters: SubmissionFilters;
  sort: SubmissionSort;
  columns: string[] | null;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
};

function parseView(row: Record<string, unknown>): SavedView {
  const filters = (row.filters ?? {}) as SubmissionFilters;
  const sortRaw = (row.sort ?? {}) as Record<string, string>;
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    name: String(row.name),
    filters,
    sort: {
      field: (sortRaw.field as SubmissionSort["field"]) ?? "effective_urgency",
      direction: sortRaw.direction === "asc" ? "asc" : "desc",
    },
    columns: Array.isArray(row.columns) ? row.columns.map(String) : null,
    is_shared: Boolean(row.is_shared),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function fetchSavedViews(): Promise<SavedView[]> {
  const { data, error } = await supabase
    .from("admin_saved_views")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => parseView(row as Record<string, unknown>));
}

export async function createSavedView(input: {
  name: string;
  filters: SubmissionFilters;
  sort: SubmissionSort;
  columns?: string[] | null;
  isShared?: boolean;
}): Promise<SavedView> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("admin_saved_views")
    .insert({
      user_id: auth.user.id,
      name: input.name.trim(),
      filters: input.filters as Json,
      sort: input.sort as Json,
      columns: input.columns?.length ? (input.columns as Json) : null,
      is_shared: input.isShared ?? false,
    })
    .select("*")
    .single();

  if (error) throw error;
  return parseView(data as Record<string, unknown>);
}

export async function deleteSavedView(id: string): Promise<void> {
  const { error } = await supabase.from("admin_saved_views").delete().eq("id", id);
  if (error) throw error;
}
