import { buildMockQuery } from "@/test/helpers/mock-builders";
import { resetSupabaseMock, supabase } from "@/integrations/supabase/__mocks__/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client");

import {
  bulkRecalculateAllScores,
  bulkRecalculateBatch,
  fetchActiveScoringConfig,
  fetchScoringPreviewSamples,
  fetchScoringTierDistribution,
  saveScoringConfig,
  type ScoringConfigRules,
} from "@/lib/scoring-config";

const sampleRules: ScoringConfigRules = {
  version: 2,
  raw_max: 105,
  priority_override_floor: 85,
  categories: {
    shelter: {
      max: 25,
      weights: {
        school_shelter: 25,
        informal_shelter: 20,
        destroyed_home: 15,
        rented: 12,
        with_relatives: 5,
        other_housing: 15,
      },
    },
    medical: {
      max: 25,
      weights: {
        medicine_need: 15,
        chronic_illness: 10,
        disabled: 10,
      },
    },
  },
};

describe("scoring-config supabase flows", () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  it("fetchActiveScoringConfig parses active config from RPC", async () => {
    supabase.rpc.mockResolvedValue({
      data: {
        id: "cfg-1",
        version: 2,
        rules: sampleRules,
        is_active: true,
        updated_at: "2026-06-01T12:00:00Z",
      },
      error: null,
    });

    const config = await fetchActiveScoringConfig();
    expect(config?.version).toBe(2);
    expect(config?.rules.raw_max).toBe(105);
    expect(config?.is_active).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith("get_active_scoring_config");
  });

  it("fetchActiveScoringConfig returns null for invalid payload", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });
    expect(await fetchActiveScoringConfig()).toBeNull();

    supabase.rpc.mockResolvedValue({ data: [1, 2], error: null });
    expect(await fetchActiveScoringConfig()).toBeNull();
  });

  it("saveScoringConfig sends rules and returns new version number", async () => {
    supabase.rpc.mockResolvedValue({ data: 3, error: null });

    const version = await saveScoringConfig(sampleRules);
    expect(version).toBe(3);
    expect(supabase.rpc).toHaveBeenCalledWith("save_scoring_config", { _rules: sampleRules });
  });

  it("saveScoringConfig propagates RPC errors", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: "admin only" } });
    await expect(saveScoringConfig(sampleRules)).rejects.toEqual({ message: "admin only" });
  });

  it("fetchScoringPreviewSamples parses preview rows", async () => {
    supabase.rpc.mockResolvedValue({
      data: [
        {
          id: "r1",
          reference_code: "SND-1",
          full_name: "Ali",
          urgency_score: 70,
          effective_urgency: 70,
          urgency_tier: "high",
          urgency_breakdown: { version: 2, raw_total: 74, normalized: 70, categories: {} },
          created_at: "2026-06-01T00:00:00Z",
        },
      ],
      error: null,
    });

    const samples = await fetchScoringPreviewSamples(20);
    expect(samples).toHaveLength(1);
    expect(samples[0]?.reference_code).toBe("SND-1");
    expect(supabase.rpc).toHaveBeenCalledWith("get_scoring_preview_samples", { _limit: 20 });
  });

  it("fetchScoringTierDistribution parses tier counts", async () => {
    supabase.rpc.mockResolvedValue({
      data: { critical: 2, high: 5, medium: 10, low: 3, total: 20 },
      error: null,
    });

    const dist = await fetchScoringTierDistribution();
    expect(dist.total).toBe(20);
    expect(dist.critical).toBe(2);
    expect(supabase.rpc).toHaveBeenCalledWith("get_scoring_tier_distribution");
  });

  it("bulkRecalculateBatch parses batch response", async () => {
    supabase.rpc.mockResolvedValue({
      data: { processed: 100, offset: 0, total: 250, next_offset: 100, has_more: true },
      error: null,
    });

    const batch = await bulkRecalculateBatch(0, 100);
    expect(batch.processed).toBe(100);
    expect(batch.has_more).toBe(true);
    expect(batch.next_offset).toBe(100);
  });

  it("bulkRecalculateAllScores loops until has_more is false", async () => {
    supabase.rpc
      .mockResolvedValueOnce({
        data: { processed: 2, offset: 0, total: 3, next_offset: 2, has_more: true },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { processed: 1, offset: 2, total: 3, next_offset: null, has_more: false },
        error: null,
      });

    const onProgress = vi.fn();
    const result = await bulkRecalculateAllScores(onProgress, 2);
    expect(result.processed).toBe(3);
    expect(result.total).toBe(3);
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
  });
});
