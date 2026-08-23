import { describe, expect, it, beforeEach } from "vitest";
import {
  buildRequestsListUiState,
  buildRequestsListUrlSearch,
  defaultRequestsListUiState,
  loadRequestsListUiState,
  saveRequestsListUiState,
} from "@/lib/requests-list-ui-state";

describe("requests-list-ui-state", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("round-trips list UI state through sessionStorage", () => {
    const state = buildRequestsListUiState({
      ...defaultRequestsListUiState(50),
      dailyBatchEnabled: false,
      q: "محمد",
      createdFrom: "2026-01-01",
      urlSearch: { sort: "created_at", dir: "desc" },
      scrollY: 420,
      loadedPages: 3,
    });

    saveRequestsListUiState(state);
    const loaded = loadRequestsListUiState(50);

    expect(loaded?.dailyBatchEnabled).toBe(false);
    expect(loaded?.q).toBe("محمد");
    expect(loaded?.urlSearch).toEqual({ sort: "created_at", dir: "desc" });
    expect(loaded?.scrollY).toBe(420);
    expect(loaded?.loadedPages).toBe(3);
  });

  it("buildRequestsListUrlSearch omits empty params", () => {
    expect(
      buildRequestsListUrlSearch({
        sort: "created_at",
        dir: "desc",
        q: "",
        status: "reviewing",
      }),
    ).toEqual({
      sort: "created_at",
      dir: "desc",
      status: "reviewing",
    });
  });
});
