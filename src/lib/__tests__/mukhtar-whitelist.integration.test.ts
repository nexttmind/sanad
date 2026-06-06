import { buildMockQuery } from "@/test/helpers/mock-builders";
import { resetSupabaseMock, supabase } from "@/integrations/supabase/__mocks__/client";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client");

import {
  deactivateMukhtarWhitelist,
  fetchMukhtarWhitelist,
  insertMukhtarWhitelist,
} from "@/lib/mukhtar-whitelist";

describe("mukhtar-whitelist supabase flows", () => {
  beforeEach(() => {
    resetSupabaseMock();
    supabase.from.mockReturnValue(buildMockQuery({ data: null, error: null }));
  });

  it("fetchMukhtarWhitelist loads rows", async () => {
    supabase.from.mockReturnValue(
      buildMockQuery({ data: [{ id: "1", full_name: "Mukhtar", phone: "70123456" }], error: null }),
    );
    const rows = await fetchMukhtarWhitelist();
    expect(rows).toHaveLength(1);
  });

  it("insertMukhtarWhitelist trims fields", async () => {
    await insertMukhtarWhitelist({
      full_name: "  Ali  ",
      phone: " 70123456 ",
      reference_type: "مختار",
      region: " صور ",
    });
    const chain = supabase.from.mock.results[0]?.value;
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ full_name: "Ali", phone: "70123456", region: "صور" }),
    );
  });

  it("deactivateMukhtarWhitelist sets is_active false", async () => {
    await deactivateMukhtarWhitelist("ref-1", "duplicate");
    const chain = supabase.from.mock.results[0]?.value;
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_active: false, deactivation_reason: "duplicate" }),
    );
  });
});
