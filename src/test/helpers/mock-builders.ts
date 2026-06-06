import { vi } from "vitest";

export type QueryResult = {
  data?: unknown;
  error?: { message: string; code?: string } | null;
  count?: number | null;
};

/** Chainable Supabase query builder mock that resolves to `result` on await. */
export function buildMockQuery(result: QueryResult) {
  type Thenable = Promise<QueryResult> & Record<string, ReturnType<typeof vi.fn>>;
  const thenable = Promise.resolve(result) as Thenable;
  const self = () => thenable;

  for (const method of [
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "gte",
    "lte",
    "order",
    "limit",
    "in",
    "neq",
    "or",
    "filter",
    "match",
    "not",
    "is",
    "contains",
  ]) {
    thenable[method] = vi.fn(self);
  }

  thenable.single = vi.fn().mockResolvedValue(result);
  thenable.maybeSingle = vi.fn().mockResolvedValue(result);

  return thenable;
}

export function buildMockSupabase() {
  return {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: { getUser: vi.fn() },
    storage: { from: vi.fn() },
    functions: { invoke: vi.fn() },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  };
}
