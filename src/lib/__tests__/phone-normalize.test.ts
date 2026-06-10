import { describe, expect, it } from "vitest";
import {
  normalizeLebanesePhone,
  normalizeNationalId,
  validateDocumentNumberFormat,
  maskReferenceCode,
} from "@/lib/phone-normalize";
describe("normalizeLebanesePhone", () => {
  it("normalizes local 03 prefix", () => {
    expect(normalizeLebanesePhone("03 123 456")).toBe("9613123456");
  });

  it("keeps 961 prefix", () => {
    expect(normalizeLebanesePhone("+961 71 234 567")).toBe("96171234567");
  });

  it("treats equivalent formats as same", () => {
    expect(normalizeLebanesePhone("71 234 567")).toBe(normalizeLebanesePhone("+96171234567"));
  });
});

describe("normalizeNationalId", () => {
  it("strips spaces and dashes, uppercases", () => {
    expect(normalizeNationalId("rl 123-4567")).toBe("RL1234567");
  });
});

describe("validateDocumentNumberFormat", () => {
  it("accepts 7–8 digit Lebanese ID", () => {
    expect(validateDocumentNumberFormat("lebanese_id", "1234567")).toBe(true);
    expect(validateDocumentNumberFormat("lebanese_id", "12345678")).toBe(true);
  });

  it("rejects short Lebanese ID", () => {
    expect(validateDocumentNumberFormat("lebanese_id", "123456")).toBe(false);
  });

  it("accepts passport 2L+7D", () => {
    expect(validateDocumentNumberFormat("passport", "RL1234567")).toBe(true);
    expect(validateDocumentNumberFormat("passport", "rl 1234567")).toBe(true);
  });

  it("rejects invalid passport", () => {
    expect(validateDocumentNumberFormat("passport", "R1234567")).toBe(false);
  });
});

describe("maskReferenceCode", () => {
  it("masks all but last 4 characters", () => {
    expect(maskReferenceCode("SND-ABC1234")).toBe("*******1234");
  });
});
