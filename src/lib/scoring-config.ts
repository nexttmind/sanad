import { supabase } from "@/integrations/supabase/client";
import type { UrgencyBreakdown } from "@/lib/scoring";
import { parseUrgencyBreakdown } from "@/lib/scoring";

type CategorySignalWeights = Record<string, number>;

type CategoryRules = {
  max: number;
  weights: CategorySignalWeights;
};

export type ScoringConfigRules = {
  version: number;
  raw_max: number;
  priority_override_floor: number;
  categories: Record<string, CategoryRules>;
};

const DEFAULT_SCORING_CONFIG_RULES: ScoringConfigRules = {
  version: 1,
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
    dependents: {
      max: 25,
      weights: {
        infants: 8,
        elderly: 4,
        pregnant_or_nursing: 10,
        many_children: 5,
        infant_supplies: 5,
      },
    },
    displacement: {
      max: 15,
      weights: {
        displaced_7d: 15,
        displaced_30d: 10,
        displaced_90d: 5,
      },
    },
    household: {
      max: 10,
      weights: {
        family_8plus: 10,
        family_6plus: 7,
        family_4plus: 4,
      },
    },
    reference: {
      max: 5,
      weights: {
        reference_confirmed: 5,
        reference_denied: -10,
      },
    },
  },
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeWeights(raw: unknown, defaults: CategorySignalWeights): CategorySignalWeights {
  if (!isObject(raw)) {
    return { ...defaults };
  }

  const result: CategorySignalWeights = { ...defaults };
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "number") {
      result[key] = value;
    } else if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        result[key] = parsed;
      }
    }
  }

  return result;
}

function normalizeCategoryRules(raw: unknown, defaults: CategoryRules): CategoryRules {
  if (!isObject(raw)) {
    return defaults;
  }

  return {
    max: typeof raw.max === "number" ? raw.max : defaults.max,
    weights: normalizeWeights(raw.weights, defaults.weights),
  };
}

function normalizeScoringConfigRules(raw: unknown): ScoringConfigRules {
  let parsedRaw = raw;
  if (typeof raw === "string") {
    try {
      parsedRaw = JSON.parse(raw);
    } catch {
      parsedRaw = raw;
    }
  }

  if (!isObject(parsedRaw)) {
    return DEFAULT_SCORING_CONFIG_RULES;
  }

  const categoriesRaw = isObject(parsedRaw.categories) ? parsedRaw.categories : {};
  return {
    version: typeof parsedRaw.version === "number" ? parsedRaw.version : DEFAULT_SCORING_CONFIG_RULES.version,
    raw_max: typeof parsedRaw.raw_max === "number" ? parsedRaw.raw_max : DEFAULT_SCORING_CONFIG_RULES.raw_max,
    priority_override_floor:
      typeof parsedRaw.priority_override_floor === "number"
        ? parsedRaw.priority_override_floor
        : DEFAULT_SCORING_CONFIG_RULES.priority_override_floor,
    categories: {
      shelter: normalizeCategoryRules(categoriesRaw.shelter, DEFAULT_SCORING_CONFIG_RULES.categories.shelter),
      medical: normalizeCategoryRules(categoriesRaw.medical, DEFAULT_SCORING_CONFIG_RULES.categories.medical),
      dependents: normalizeCategoryRules(categoriesRaw.dependents, DEFAULT_SCORING_CONFIG_RULES.categories.dependents),
      displacement: normalizeCategoryRules(categoriesRaw.displacement, DEFAULT_SCORING_CONFIG_RULES.categories.displacement),
      household: normalizeCategoryRules(categoriesRaw.household, DEFAULT_SCORING_CONFIG_RULES.categories.household),
      reference: normalizeCategoryRules(categoriesRaw.reference, DEFAULT_SCORING_CONFIG_RULES.categories.reference),
    },
  };
}

export type ScoringConfig = {
  id: string;
  version: number;
  rules: ScoringConfigRules;
  is_active: boolean;
  updated_at: string;
};

export type ScoringPreviewSample = {
  id: string;
  reference_code: string;
  full_name: string;
  urgency_score: number;
  effective_urgency: number | null;
  urgency_tier: string | null;
  urgency_breakdown: UrgencyBreakdown | null;
  created_at: string;
};

export type BulkRecalcBatchResult = {
  processed: number;
  offset: number;
  total: number;
  next_offset: number | null;
  has_more: boolean;
};

export async function fetchActiveScoringConfig(): Promise<ScoringConfig | null> {
  const { data, error } = await supabase.rpc("get_active_scoring_config");
  if (error) throw error;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  return {
    id: String(d.id),
    version: Number(d.version),
    rules: normalizeScoringConfigRules(d.rules),
    is_active: Boolean(d.is_active),
    updated_at: String(d.updated_at),
  };
}

export async function saveScoringConfig(rules: ScoringConfigRules): Promise<number> {
  const { data, error } = await supabase.rpc("save_scoring_config", { _rules: rules });
  if (error) throw error;
  return Number(data);
}

function parsePreviewSample(raw: unknown): ScoringPreviewSample | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const d = raw as Record<string, unknown>;
  if (!d.id || !d.reference_code) return null;
  return {
    id: String(d.id),
    reference_code: String(d.reference_code),
    full_name: String(d.full_name ?? ""),
    urgency_score: Number(d.urgency_score ?? 0),
    effective_urgency: d.effective_urgency != null ? Number(d.effective_urgency) : null,
    urgency_tier: d.urgency_tier != null ? String(d.urgency_tier) : null,
    urgency_breakdown: parseUrgencyBreakdown(d.urgency_breakdown),
    created_at: String(d.created_at ?? ""),
  };
}

export async function fetchScoringPreviewSamples(limit = 3): Promise<ScoringPreviewSample[]> {
  const { data, error } = await supabase.rpc("get_scoring_preview_samples", { _limit: limit });
  if (error) throw error;
  if (!Array.isArray(data)) return [];
  return data.map(parsePreviewSample).filter((s): s is ScoringPreviewSample => s != null);
}

export async function bulkRecalculateBatch(
  offset: number,
  batchSize = 100,
): Promise<BulkRecalcBatchResult> {
  const { data, error } = await supabase.rpc("bulk_recalculate_scores", {
    _offset: offset,
    _batch_size: batchSize,
  });
  if (error) throw error;
  const d = (data ?? {}) as Record<string, unknown>;
  return {
    processed: Number(d.processed ?? 0),
    offset: Number(d.offset ?? offset),
    total: Number(d.total ?? 0),
    next_offset: d.next_offset != null ? Number(d.next_offset) : null,
    has_more: Boolean(d.has_more),
  };
}

export async function bulkRecalculateAllScores(
  onProgress?: (done: number, total: number) => void,
  batchSize = 100,
): Promise<{ total: number; processed: number }> {
  let offset = 0;
  let total = 0;
  let processed = 0;

  while (true) {
    const batch = await bulkRecalculateBatch(offset, batchSize);
    total = batch.total;
    processed += batch.processed;
    onProgress?.(processed, total);
    if (!batch.has_more || batch.next_offset == null) break;
    offset = batch.next_offset;
  }

  return { total, processed };
}
