import { describe, expect, it } from "vitest";
import {
  DEFAULT_AID_FORM_SCHEMA,
  cloneDefaultAidFormSchema,
  mergeAidFormSchema,
} from "@/lib/aid-form-schema";
import {
  initAidFormValues,
  isAidFormFieldVisible,
  validateAidFormValues,
} from "@/lib/aid-form-validation";
import { buildAidFormSubmitPayload } from "@/lib/aid-form-payload";

describe("aid-form-schema", () => {
  it("default schema excludes أدوية from needs", () => {
    const needs = DEFAULT_AID_FORM_SCHEMA.sections
      .flatMap((s) => s.fields)
      .find((f) => f.binding === "needs");
    expect(needs?.options).toBeDefined();
    expect(needs?.options).not.toContain("أدوية");
  });

  it("mergeAidFormSchema falls back to defaults for empty input", () => {
    expect(mergeAidFormSchema(null)).toEqual(DEFAULT_AID_FORM_SCHEMA);
  });

  it("cloneDefaultAidFormSchema returns a deep copy", () => {
    const copy = cloneDefaultAidFormSchema();
    copy.sections[0].title = "changed";
    expect(DEFAULT_AID_FORM_SCHEMA.sections[0].title).not.toBe("changed");
  });
});

describe("aid-form-validation", () => {
  it("hides displacement fields when not displaced", () => {
    const schema = DEFAULT_AID_FORM_SCHEMA;
    const values = initAidFormValues(schema);
    const origin = schema.sections
      .flatMap((s) => s.fields)
      .find((f) => f.binding === "origin")!;
    expect(isAidFormFieldVisible(origin, values, schema)).toBe(false);
    values.displaced = true;
    expect(isAidFormFieldVisible(origin, values, schema)).toBe(true);
  });

  it("requires at least one need", () => {
    const schema = DEFAULT_AID_FORM_SCHEMA;
    const values = initAidFormValues(schema);
    values.first = "محمد";
    values.father = "علي";
    values.family = "حسين";
    values.phone = "+96171123456";
    values.total = "4";
    values.u12 = "2";
    values.u2 = "1";
    values.refType = "مختار";
    values.refName = "أحمد";
    values.refPhone = "+96170123456";
    values.refRegion = "صور";
    values.refKnown = "طوال عمري";
    values.confirmed = true;

    const errors = validateAidFormValues(schema, values);
    expect(errors.needs).toBeTruthy();
  });

  it("always requires core reference even if required flags cleared", () => {
    const schema = cloneDefaultAidFormSchema();
    for (const f of schema.sections.flatMap((s) => s.fields)) {
      if (f.binding?.startsWith("ref_")) f.required = false;
    }
    const values = initAidFormValues(schema);
    values.first = "محمد";
    values.father = "علي";
    values.family = "حسين";
    values.phone = "+96171123456";
    values.total = "4";
    values.u12 = "2";
    values.u2 = "1";
    values.needs = ["طعام"];
    values.confirmed = true;

    const errors = validateAidFormValues(schema, values);
    expect(errors.refType || errors.refName || errors.refPhone).toBeTruthy();
  });

  it("surfaces a form-level error when a core reference binding is missing from schema", () => {
    const schema = cloneDefaultAidFormSchema();
    for (const section of schema.sections) {
      section.fields = section.fields.filter((f) => f.binding !== "ref_phone");
    }
    const values = initAidFormValues(schema);
    const errors = validateAidFormValues(schema, values);
    expect(errors._form).toBeTruthy();
    expect(Object.keys(errors).some((k) => k.startsWith("missing_"))).toBe(false);
  });
});

describe("aid-form-payload", () => {
  it("builds submit payload from bound fields", () => {
    const schema = DEFAULT_AID_FORM_SCHEMA;
    const values = initAidFormValues(schema);
    values.first = "محمد";
    values.father = "علي";
    values.family = "حسين";
    values.phone = "+96171123456";
    values.total = "4";
    values.u12 = "2";
    values.u2 = "1";
    values.needs = ["طعام", "ملابس"];
    values.clothesDesc = "ملابس أطفال مقاس صغير";
    values.refType = "مختار";
    values.refName = "أحمد";
    values.refPhone = "+96170123456";
    values.refRegion = "صور";
    values.refKnown = "طوال عمري";

    const { payload } = buildAidFormSubmitPayload(schema, values, {});
    expect(payload.full_name).toBe("محمد علي حسين");
    expect(payload.needs).toContain("طعام");
    expect(payload.needs.some((n) => n.startsWith("ملابس:"))).toBe(true);
    expect(payload.needs.some((n) => n.includes("أدوية"))).toBe(false);
    expect(payload.reference.full_name).toBe("أحمد");
    expect(payload.reference.reference_type).toBe("مختار");
  });
});
