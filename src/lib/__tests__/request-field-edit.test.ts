import { resetSupabaseMock, supabase } from "@/integrations/supabase/__mocks__/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client");
vi.mock("@/lib/audit-log", () => ({
  logAdminAction: vi.fn().mockResolvedValue(undefined),
}));

import { logAdminAction } from "@/lib/audit-log";
import type { AidRowExtended } from "@/lib/request-detail-types";
import {
  diffEditableFields,
  requestToEditableFields,
  updateRequestFields,
  validateEditableFields,
} from "@/lib/request-field-edit";

const baseRow = {
  id: "req-1",
  reference_code: "SND-001",
  phone: "+961 71 234 567",
  alt_phone: null,
  governorate: "قضاء صور",
  town: "صور",
  housing_type: "مدرسة",
  family_size: 5,
  infants: 1,
  children: 2,
  elderly: 0,
  disabled: false,
  chronic_illness: false,
  pregnant_or_nursing: false,
  displaced: true,
  displacement_date: "2026-05-01",
  origin_town: "بint jbeil",
  current_address: "address",
  needs: ["طعام"],
  needs_other: null,
} as AidRowExtended;

describe("request-field-edit validation", () => {
  it("validateEditableFields rejects invalid Lebanese phone", () => {
    const fields = requestToEditableFields(baseRow);
    fields.phone = "12345";
    const errors = validateEditableFields(fields, "personal");
    expect(errors.phone).toBeTruthy();
  });

  it("validateEditableFields requires at least one need", () => {
    const fields = requestToEditableFields(baseRow);
    fields.needs = [];
    expect(validateEditableFields(fields, "needs").needs).toBeTruthy();
  });

  it("validateEditableFields requires family_size >= 1", () => {
    const fields = requestToEditableFields(baseRow);
    fields.family_size = 0;
    expect(validateEditableFields(fields, "family").family_size).toBeTruthy();
  });

  it("diffEditableFields returns only changed keys", () => {
    const before = requestToEditableFields(baseRow);
    const after = { ...before, town: "جديد", phone: before.phone };
    const { old_value, new_value } = diffEditableFields(before, after, ["town", "phone"]);
    expect(old_value).toEqual({ town: "صور" });
    expect(new_value).toEqual({ town: "جديد" });
  });
});

describe("request-field-edit supabase flows", () => {
  beforeEach(() => {
    resetSupabaseMock();
    vi.mocked(logAdminAction).mockClear();
  });

  it("updateRequestFields updates DB and logs field_updated audit", async () => {
    const chain = { eq: vi.fn().mockResolvedValue({ error: null }) };
    chain.eq.mockReturnValue(chain);
    supabase.from.mockReturnValue({
      update: vi.fn().mockReturnValue(chain),
    });

    const after = requestToEditableFields(baseRow);
    after.town = "بلدة جديدة";

    const result = await updateRequestFields({
      requestId: "req-1",
      referenceCode: "SND-001",
      before: baseRow,
      after,
      section: "location",
      actorName: "Admin",
    });

    expect(result.ok).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith("aid_requests");
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "field_updated",
        entityId: "req-1",
        actorName: "Admin",
      }),
    );
  });

  it("updateRequestFields returns errors when phone invalid", async () => {
    const after = requestToEditableFields(baseRow);
    after.phone = "bad";
    const result = await updateRequestFields({
      requestId: "req-1",
      referenceCode: "SND-001",
      before: baseRow,
      after,
      section: "personal",
      actorName: "Admin",
    });
    expect(result.ok).toBe(false);
    expect(result.errors?.phone).toBeTruthy();
  });

  it("updateRequestFields skips when no changes in section", async () => {
    const after = requestToEditableFields(baseRow);
    const result = await updateRequestFields({
      requestId: "req-1",
      referenceCode: "SND-001",
      before: baseRow,
      after,
      section: "personal",
      actorName: "Admin",
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("لا توجد تغييرات");
  });
});
