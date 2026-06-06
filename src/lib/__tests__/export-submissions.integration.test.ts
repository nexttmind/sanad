import { resetSupabaseMock, supabase } from "@/integrations/supabase/__mocks__/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client");

import {
  canExport,
  createExportJob,
  downloadCsv,
  exportFilename,
  fetchSubmissionsCsv,
  filterCsvColumns,
  countCsvDataRows,
  needsAsyncExport,
  runExportJobUntilComplete,
  DEFAULT_EXPORT_COLUMNS,
} from "@/lib/export-submissions";

describe("export-submissions supabase flows", () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  it("fetchSubmissionsCsv calls export_submissions_csv with built filters", async () => {
    supabase.rpc.mockResolvedValue({
      data: "reference_code,full_name\nSND-1,Ali\n",
      error: null,
    });

    const csv = await fetchSubmissionsCsv({ search: "Ali", status: "submitted" });
    expect(csv).toContain("SND-1");
    expect(supabase.rpc).toHaveBeenCalledWith("export_submissions_csv", {
      _filters: { search: "Ali", status: "submitted" },
    });
  });

  it("fetchSubmissionsCsv returns empty string for non-string RPC data", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });
    expect(await fetchSubmissionsCsv({})).toBe("");
  });

  it("fetchSubmissionsCsv propagates RPC errors", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: "forbidden" } });
    await expect(fetchSubmissionsCsv({})).rejects.toEqual({ message: "forbidden" });
  });

  it("createExportJob returns sync mode for small exports", async () => {
    supabase.rpc.mockResolvedValue({
      data: { mode: "sync", total_count: 120 },
      error: null,
    });
    const result = await createExportJob({ status: "submitted" }, ["reference_code"]);
    expect(result).toEqual({ mode: "sync", totalCount: 120 });
    expect(supabase.rpc).toHaveBeenCalledWith("create_export_job", {
      _filters: { status: "submitted" },
      _columns: ["reference_code"],
    });
  });

  it("createExportJob returns async mode with job id", async () => {
    supabase.rpc.mockResolvedValue({
      data: { mode: "async", job_id: "job-1", total_count: 9000 },
      error: null,
    });
    const result = await createExportJob({}, DEFAULT_EXPORT_COLUMNS);
    expect(result).toEqual({ mode: "async", jobId: "job-1", totalCount: 9000 });
  });

  it("runExportJobUntilComplete polls until completed", async () => {
    supabase.rpc
      .mockResolvedValueOnce({
        data: {
          id: "job-1",
          status: "processing",
          total_count: 9000,
          processed_count: 1500,
          progress_pct: 17,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: "job-1",
          status: "completed",
          total_count: 9000,
          processed_count: 9000,
          progress_pct: 100,
          row_count: 9000,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: "\uFEFFreference_code\nSND-1\n",
        error: null,
      });

    const csv = await runExportJobUntilComplete("job-1");
    expect(csv).toContain("SND-1");
    expect(supabase.rpc).toHaveBeenCalledWith("advance_export_job", { _job_id: "job-1" });
    expect(supabase.rpc).toHaveBeenCalledWith("fetch_export_job_csv", { _job_id: "job-1" });
  });
});

describe("export-submissions helpers", () => {
  it("canExport allows admin, reviewer, distributor — blocks viewer-only", () => {
    expect(canExport(["viewer"])).toBe(false);
    expect(canExport(["distributor"])).toBe(true);
    expect(canExport(["reviewer"])).toBe(true);
    expect(canExport(["admin"])).toBe(true);
    expect(canExport(["viewer", "reviewer"])).toBe(true);
  });

  it("needsAsyncExport is true above sync limit", () => {
    expect(needsAsyncExport(5000)).toBe(false);
    expect(needsAsyncExport(5001)).toBe(true);
  });

  it("exportFilename uses ISO date stamp", () => {
    expect(exportFilename("test-export")).toMatch(/^test-export-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("filterCsvColumns keeps BOM and selected headers only", () => {
    const raw = "\uFEFFqueue_number,reference_code,full_name\n1,SND-1,Ali\n";
    const filtered = filterCsvColumns(raw, ["reference_code", "full_name"]);
    expect(filtered.startsWith("\uFEFF")).toBe(true);
    expect(filtered).toContain("reference_code,full_name");
    expect(filtered).not.toContain("queue_number");
    expect(filtered).toContain("SND-1,Ali");
  });

  it("countCsvDataRows excludes header row", () => {
    expect(countCsvDataRows("a,b\n1,2\n3,4\n")).toBe(2);
  });

  it("downloadCsv triggers anchor download with blob URL", () => {
    const click = vi.fn();
    const revoke = vi.fn();
    const createObjectURL = vi.fn(() => "blob:mock");

    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: revoke });
    vi.stubGlobal(
      "document",
      {
        createElement: vi.fn(() => ({ href: "", download: "", click })),
      } as unknown as Document,
    );

    downloadCsv("a,b\n1,2", "test.csv");

    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith("blob:mock");

    vi.unstubAllGlobals();
  });
});
