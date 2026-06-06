import { resetSupabaseMock, supabase } from "@/integrations/supabase/__mocks__/client";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client");

import { uploadIdDocument } from "@/lib/upload-id-doc";

describe("upload-id-doc supabase flows", () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  it("uploadIdDocument rejects empty input locally", async () => {
    const emptyFile = new File([], "empty.pdf", { type: "application/pdf" });
    const result = await uploadIdDocument("", emptyFile);
    expect(result).toEqual({ ok: false, message: "invalid upload" });
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it("uploadIdDocument invokes upload-id-doc edge function", async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { ok: true, storage_path: "req-1/id.pdf" },
      error: null,
    });

    const file = new File([new Uint8Array([1, 2, 3, 4])], "id.pdf", { type: "application/pdf" });
    const result = await uploadIdDocument("req-1", file);

    expect(result).toEqual({ ok: true, storage_path: "req-1/id.pdf" });
    expect(supabase.functions.invoke).toHaveBeenCalledWith("upload-id-doc", {
      body: expect.objectContaining({
        request_id: "req-1",
        filename: "id.pdf",
        content_type: "application/pdf",
      }),
    });
  });

  it("uploadIdDocument surfaces rate limit message", async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: {
        ok: false,
        message: "تجاوزت الحد المسموح لرفع الملفات — حاول لاحقاً.",
        retry_after_seconds: 600,
      },
      error: null,
    });

    const file = new File([new Uint8Array([1, 2, 3, 4])], "id.pdf", { type: "application/pdf" });
    const result = await uploadIdDocument("req-1", file);

    expect(result).toEqual({
      ok: false,
      message: "تجاوزت الحد المسموح لرفع الملفات — حاول لاحقاً.",
      rateLimited: true,
    });
  });
});
