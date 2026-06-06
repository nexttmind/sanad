import { buildMockQuery } from "@/test/helpers/mock-builders";
import { resetSupabaseMock, supabase } from "@/integrations/supabase/__mocks__/client";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client");

import { fetchAnalyticsData, parseDateRange } from "@/lib/analytics";

describe("analytics supabase flows", () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  it("fetchAnalyticsData queries requests and fraud events in range", async () => {
    supabase.from.mockImplementation((table: string) => {
      if (table === "aid_requests") {
        return buildMockQuery({
          data: [{ created_at: "2026-06-01T10:00:00.000Z", needs: [], status: "submitted" }],
          error: null,
        });
      }
      if (table === "fraud_events") {
        return buildMockQuery({
          data: [{ code: "DUPLICATE_PHONE", created_at: "2026-06-01T11:00:00.000Z" }],
          error: null,
        });
      }
      return buildMockQuery({ data: null, error: null });
    });

    const range = parseDateRange("2026-06-01", "2026-06-05");
    const snapshot = await fetchAnalyticsData(range);
    expect(snapshot.requests).toHaveLength(1);
    expect(snapshot.fraudEvents).toHaveLength(1);
  });
});
