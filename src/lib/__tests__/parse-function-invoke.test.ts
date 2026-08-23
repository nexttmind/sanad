import { FunctionsHttpError } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { readFunctionInvokeBody } from "@/lib/parse-function-invoke";

describe("readFunctionInvokeBody", () => {
  it("returns data when invoke succeeds", async () => {
    const body = { ok: true, id: "req-1", reference_code: "SND-1" };
    const result = await readFunctionInvokeBody(body, null);
    expect(result).toEqual({ body, transportFailed: false });
  });

  it("parses JSON from FunctionsHttpError.context", async () => {
    const body = {
      ok: false,
      message: "تعذّر حفظ بيانات المرجع — يرجى المحاولة مرة أخرى.",
      errors: { reference: "تعذّر حفظ بيانات المرجع" },
    };
    const result = await readFunctionInvokeBody(null, new FunctionsHttpError({
      json: vi.fn().mockResolvedValue(body),
    }));
    expect(result).toEqual({ body, transportFailed: false });
  });

  it("marks transportFailed for non-http invoke errors", async () => {
    const result = await readFunctionInvokeBody(null, new Error("network down"));
    expect(result).toEqual({ body: null, transportFailed: true });
  });

  it("parses plain-text FunctionsHttpError bodies", async () => {
    const result = await readFunctionInvokeBody(null, {
      context: {
        text: vi.fn().mockResolvedValue("Forbidden"),
        status: 403,
      },
    });
    expect(result).toEqual({ body: { ok: false, message: "Forbidden" }, transportFailed: false });
  });
});
