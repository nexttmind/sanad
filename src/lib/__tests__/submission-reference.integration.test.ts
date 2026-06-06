import { buildMockQuery } from "@/test/helpers/mock-builders";
import { resetSupabaseMock, supabase } from "@/integrations/supabase/__mocks__/client";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client");

import {
  fetchSubmissionReference,
  insertSubmissionReference,
  updateReferenceContact,
} from "@/lib/submission-reference";

describe("submission-reference supabase flows", () => {
  beforeEach(() => {
    resetSupabaseMock();
    supabase.from.mockReturnValue(buildMockQuery({ data: null, error: null }));
  });

  it("insertSubmissionReference writes row", async () => {
    await insertSubmissionReference({
      request_id: "req-1",
      reference_type: "مختار",
      full_name: "Hassan",
      phone: "70123456",
    });
    expect(supabase.from).toHaveBeenCalledWith("submission_references");
  });

  it("fetchSubmissionReference returns joined whitelist", async () => {
    supabase.from.mockReturnValue(
      buildMockQuery({
        data: {
          id: "sr-1",
          request_id: "req-1",
          mukhtar_whitelist: { id: "w1", full_name: "Hassan", verified_at: "2026-01-01" },
        },
        error: null,
      }),
    );
    const ref = await fetchSubmissionReference("req-1");
    expect(ref?.mukhtar_whitelist?.id).toBe("w1");
  });

  it("updateReferenceContact sets contact fields", async () => {
    await updateReferenceContact("req-1", "confirmed", "answered", "admin-1");
    const chain = supabase.from.mock.results[0]?.value;
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ contact_result: "confirmed", contacted_by: "admin-1" }),
    );
  });
});
