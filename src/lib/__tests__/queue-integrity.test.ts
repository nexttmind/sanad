import { resetSupabaseMock, supabase } from "@/integrations/supabase/__mocks__/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client");
vi.mock("@/lib/audit-log", () => ({
  logAdminAction: vi.fn().mockResolvedValue(undefined),
}));

import { logAdminAction } from "@/lib/audit-log";
import {
  parseQueueIntegrityReport,
  runQueueIntegrityCheck,
} from "@/lib/queue-integrity";

describe("queue-integrity supabase flows", () => {
  beforeEach(() => {
    resetSupabaseMock();
    vi.mocked(logAdminAction).mockClear();
  });

  it("runQueueIntegrityCheck calls check_queue_integrity RPC and logs audit", async () => {
    supabase.rpc.mockResolvedValue({
      data: {
        checked_at: "2026-06-06T12:00:00Z",
        healthy: true,
        queue_numbers: {
          unique: true,
          total_assigned: 500,
          max: 500,
          duplicates: [],
        },
        sequence: {
          ok: true,
          last_value: 500,
          next_value: 501,
          max_queue_number: 500,
        },
        duplicate_phones_pending: [],
        pending_total: 42,
      },
      error: null,
    });

    const report = await runQueueIntegrityCheck("Admin User");
    expect(report.healthy).toBe(true);
    expect(report.pending_total).toBe(42);
    expect(supabase.rpc).toHaveBeenCalledWith("check_queue_integrity");
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "queue_integrity_check",
        entity: "queue",
        actorName: "Admin User",
      }),
    );
  });

  it("runQueueIntegrityCheck propagates RPC errors", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: "denied" } });
    await expect(runQueueIntegrityCheck()).rejects.toEqual({ message: "denied" });
  });

  it("runQueueIntegrityCheck throws on invalid payload", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });
    await expect(runQueueIntegrityCheck()).rejects.toThrow("Invalid integrity check response");
  });
});

describe("queue-integrity parsing", () => {
  it("parseQueueIntegrityReport maps duplicates and phone groups", () => {
    const report = parseQueueIntegrityReport({
      checked_at: "2026-06-06T12:00:00Z",
      healthy: false,
      queue_numbers: {
        unique: false,
        total_assigned: 3,
        max: 2,
        duplicates: [
          {
            queue_number: 1,
            count: 2,
            requests: [
              { id: "a", reference_code: "SND-1" },
              { id: "b", reference_code: "SND-2" },
            ],
          },
        ],
      },
      sequence: {
        ok: false,
        last_value: 2,
        next_value: 3,
        max_queue_number: 5,
      },
      duplicate_phones_pending: [
        {
          phone: "+96170123456",
          count: 2,
          requests: [
            { id: "a", reference_code: "SND-1", queue_number: 1, status: "submitted" },
            { id: "c", reference_code: "SND-3", queue_number: 3, status: "reviewing" },
          ],
        },
      ],
      pending_total: 2,
    });

    expect(report?.healthy).toBe(false);
    expect(report?.queue_numbers.duplicates).toHaveLength(1);
    expect(report?.duplicate_phones_pending[0]?.phone).toBe("+96170123456");
    expect(report?.sequence.ok).toBe(false);
  });

  it("parseQueueIntegrityReport returns null for invalid input", () => {
    expect(parseQueueIntegrityReport(null)).toBeNull();
    expect(parseQueueIntegrityReport([])).toBeNull();
  });
});
