import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/auth";
import { buildFiltersJson, type SubmissionFilters } from "@/lib/submissions-list";

export type ExportColumnKey =
  | "queue_number"
  | "reference_code"
  | "full_name"
  | "phone"
  | "governorate"
  | "town"
  | "housing_type"
  | "family_size"
  | "infants"
  | "children"
  | "elderly"
  | "needs"
  | "flags"
  | "status"
  | "trust_score"
  | "urgency_score"
  | "effective_urgency"
  | "urgency_tier"
  | "risk_level"
  | "assigned_to"
  | "tags"
  | "reference_type"
  | "reference_name"
  | "reference_phone"
  | "reference_region"
  | "reference_contact_result"
  | "created_at"
  | "queued_at";

export const CORE_EXPORT_COLUMNS: { key: ExportColumnKey; label: string }[] = [
  { key: "queue_number", label: "رقم الدور" },
  { key: "reference_code", label: "رمز الطلب" },
  { key: "full_name", label: "الاسم" },
  { key: "phone", label: "الهاتف" },
  { key: "governorate", label: "المحافظة" },
  { key: "town", label: "البلدة" },
  { key: "housing_type", label: "المأوى" },
  { key: "family_size", label: "حجم العائلة" },
  { key: "infants", label: "الرضّع" },
  { key: "status", label: "الحالة" },
  { key: "trust_score", label: "الثقة" },
  { key: "urgency_score", label: "العجلة المحسوبة" },
  { key: "effective_urgency", label: "العجلة الفعّالة" },
  { key: "urgency_tier", label: "مستوى العجلة" },
  { key: "risk_level", label: "المخاطرة" },
  { key: "created_at", label: "تاريخ التقديم" },
  { key: "queued_at", label: "تاريخ الدور" },
];

export const OPTIONAL_EXPORT_COLUMNS: { key: ExportColumnKey; label: string }[] = [
  { key: "children", label: "الأطفال" },
  { key: "elderly", label: "كبار السن" },
  { key: "needs", label: "الاحتياجات" },
  { key: "flags", label: "إشارات الاحتيال" },
  { key: "assigned_to", label: "معرّف المراجع" },
  { key: "tags", label: "الوسوم" },
  { key: "reference_type", label: "نوع المرجع" },
  { key: "reference_name", label: "اسم المرجع" },
  { key: "reference_phone", label: "هاتف المرجع" },
  { key: "reference_region", label: "منطقة المرجع" },
  { key: "reference_contact_result", label: "نتيجة التحقق من المرجع" },
];

export const EXPORT_COLUMNS: { key: ExportColumnKey; label: string }[] = [
  ...CORE_EXPORT_COLUMNS,
  ...OPTIONAL_EXPORT_COLUMNS,
];

export const DEFAULT_EXPORT_COLUMNS: ExportColumnKey[] = CORE_EXPORT_COLUMNS.map((c) => c.key);

/** Sync RPC export cap — larger sets use export_jobs. */
export const SYNC_EXPORT_ROW_LIMIT = 5000;
export const ASYNC_EXPORT_ROW_MAX = 50000;

const EXPORT_COLUMNS_STORAGE_KEY = "sanad-export-columns";

export function loadSavedExportColumns(): ExportColumnKey[] {
  if (typeof localStorage === "undefined") return DEFAULT_EXPORT_COLUMNS;
  try {
    const raw = localStorage.getItem(EXPORT_COLUMNS_STORAGE_KEY);
    if (!raw) return DEFAULT_EXPORT_COLUMNS;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_EXPORT_COLUMNS;
    const valid = new Set(EXPORT_COLUMNS.map((c) => c.key));
    const cols = parsed.filter((k): k is ExportColumnKey => typeof k === "string" && valid.has(k as ExportColumnKey));
    return cols.length > 0 ? cols : DEFAULT_EXPORT_COLUMNS;
  } catch {
    return DEFAULT_EXPORT_COLUMNS;
  }
}

export function saveExportColumns(columns: ExportColumnKey[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(EXPORT_COLUMNS_STORAGE_KEY, JSON.stringify(columns));
}

export function resolveExportColumns(cols: string[] | null | undefined): ExportColumnKey[] {
  if (!cols?.length) return loadSavedExportColumns();
  const valid = new Set(EXPORT_COLUMNS.map((c) => c.key));
  const filtered = cols.filter(
    (k): k is ExportColumnKey => typeof k === "string" && valid.has(k as ExportColumnKey),
  );
  return filtered.length > 0 ? filtered : loadSavedExportColumns();
}

/** Keep UTF-8 BOM and filter CSV to selected column keys (order preserved). */
export function filterCsvColumns(csv: string, columns: ExportColumnKey[]): string {
  if (columns.length === 0) return csv;
  const bom = csv.charCodeAt(0) === 0xfeff ? "\uFEFF" : "";
  const body = bom ? csv.slice(1) : csv;
  const lines = body.split(/\r?\n/).filter((line, i) => i === 0 || line.length > 0);
  if (lines.length === 0) return csv;

  const header = lines[0]!.split(",");
  const indices = columns
    .map((key) => header.indexOf(key))
    .filter((idx) => idx >= 0);
  if (indices.length === 0) return csv;

  const filtered = lines.map((line) =>
    indices.map((idx) => line.split(",")[idx] ?? "").join(","),
  );
  return bom + filtered.join("\n") + (body.endsWith("\n") ? "\n" : "");
}

export function countCsvDataRows(csv: string): number {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  return Math.max(0, lines.length - 1);
}

export function canExport(roles: AppRole[]): boolean {
  return roles.some((r) => r === "admin" || r === "reviewer" || r === "distributor");
}

export function needsAsyncExport(totalCount: number): boolean {
  return totalCount > SYNC_EXPORT_ROW_LIMIT;
}

export type ExportJobStatus = {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  totalCount: number;
  processedCount: number;
  progressPct: number;
  errorMessage: string | null;
  rowCount: number | null;
};

export type CreateExportJobResult =
  | { mode: "sync"; totalCount: number }
  | { mode: "async"; jobId: string; totalCount: number };

function parseExportJobStatus(data: unknown): ExportJobStatus {
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    id: String(row.id ?? ""),
    status: (row.status as ExportJobStatus["status"]) ?? "pending",
    totalCount: Number(row.total_count ?? 0),
    processedCount: Number(row.processed_count ?? 0),
    progressPct: Number(row.progress_pct ?? 0),
    errorMessage: typeof row.error_message === "string" ? row.error_message : null,
    rowCount: row.row_count != null ? Number(row.row_count) : null,
  };
}

function parseCreateExportJobResult(data: unknown): CreateExportJobResult {
  const row = (data ?? {}) as Record<string, unknown>;
  const mode = row.mode === "async" ? "async" : "sync";
  const totalCount = Number(row.total_count ?? 0);
  if (mode === "async" && row.job_id) {
    return { mode: "async", jobId: String(row.job_id), totalCount };
  }
  return { mode: "sync", totalCount };
}

export async function createExportJob(
  filters: SubmissionFilters,
  columns: ExportColumnKey[],
): Promise<CreateExportJobResult> {
  const { data, error } = await supabase.rpc("create_export_job", {
    _filters: buildFiltersJson(filters),
    _columns: columns,
  });
  if (error) throw error;
  return parseCreateExportJobResult(data);
}

export async function getExportJob(jobId: string): Promise<ExportJobStatus> {
  const { data, error } = await supabase.rpc("get_export_job", { _job_id: jobId });
  if (error) throw error;
  return parseExportJobStatus(data);
}

export async function advanceExportJob(jobId: string): Promise<ExportJobStatus> {
  const { data, error } = await supabase.rpc("advance_export_job", { _job_id: jobId });
  if (error) throw error;
  return parseExportJobStatus(data);
}

export async function fetchExportJobCsv(jobId: string): Promise<string> {
  const { data, error } = await supabase.rpc("fetch_export_job_csv", { _job_id: jobId });
  if (error) throw error;
  return typeof data === "string" ? data : "";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll batched SQL export until completed; returns CSV with BOM. */
export async function runExportJobUntilComplete(
  jobId: string,
  onProgress?: (status: ExportJobStatus) => void,
): Promise<string> {
  for (;;) {
    const status = await advanceExportJob(jobId);
    onProgress?.(status);
    if (status.status === "completed") {
      return fetchExportJobCsv(jobId);
    }
    if (status.status === "failed") {
      throw new Error(status.errorMessage ?? "فشل التصدير في الخلفية.");
    }
    await sleep(400);
  }
}

export async function fetchSubmissionsCsv(filters: SubmissionFilters): Promise<string> {
  const { data, error } = await supabase.rpc("export_submissions_csv", {
    _filters: buildFiltersJson(filters),
  });
  if (error) throw error;
  return typeof data === "string" ? data : "";
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function getSupabaseFunctionsBaseUrl(): string {
  const explicit = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  if (supabaseUrl.includes("localhost") || supabaseUrl.includes("127.0.0.1")) {
    return "http://localhost:54321/functions/v1";
  }

  if (supabaseUrl.endsWith("/")) {
    return supabaseUrl.replace(/\/$/, "").replace(/\.supabase\.co$/, ".functions.supabase.co");
  }

  return supabaseUrl.replace(/\.supabase\.co$/, ".functions.supabase.co");
}

export async function fetchExportJobSignedUrl(jobId: string): Promise<string> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) {
    throw new Error("Unauthorized.");
  }

  const functionsUrl = getSupabaseFunctionsBaseUrl();
  const response = await fetch(`${functionsUrl}/export-job-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ job_id: jobId }),
  });

  const data = await response.json();
  if (!response.ok || !data?.ok || typeof data.url !== "string") {
    throw new Error(data?.message || "Unable to create export download URL.");
  }
  return data.url;
}

export async function ensureExportJobStored(jobId: string): Promise<void> {
  await fetchExportJobSignedUrl(jobId);
}

export function exportFilename(prefix = "sanad-submissions"): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${prefix}-${stamp}.csv`;
}
