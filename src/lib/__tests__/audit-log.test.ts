import { describe, expect, it } from "vitest";
import {
  AUDIT_ACTIONS,
  AUDIT_ACTION_LABELS,
  maskIp,
  parseAuditDiff,
} from "@/lib/audit-log";

describe("audit-log helpers", () => {
  it("AUDIT_ACTIONS includes PRD v2 scoring and export events", () => {
    expect(AUDIT_ACTIONS).toContain("export_csv");
    expect(AUDIT_ACTIONS).toContain("urgency_override");
    expect(AUDIT_ACTIONS).toContain("priority_override_set");
    expect(AUDIT_ACTIONS).toContain("priority_override_cleared");
    expect(AUDIT_ACTIONS).toContain("scoring_config_updated");
    expect(AUDIT_ACTIONS).toContain("queue_integrity_check");
    expect(AUDIT_ACTIONS).toContain("field_updated");
    expect(AUDIT_ACTION_LABELS.export_csv).toBe("تصدير CSV");
    expect(AUDIT_ACTION_LABELS.scoring_config_updated).toBe("تحديث قواعد العجلة");
    expect(AUDIT_ACTION_LABELS.queue_integrity_check).toBe("فحص سلامة الدور");
  });

  it("AUDIT_ACTIONS includes donation events", () => {
    expect(AUDIT_ACTIONS).toContain("donation_verified");
    expect(AUDIT_ACTIONS).toContain("donation_rejected");
    expect(AUDIT_ACTIONS).toContain("urgency_override");
    expect(AUDIT_ACTION_LABELS.donation_verified).toBe("وثّق تبرّعاً");
  });

  it("parseAuditDiff extracts nested fields", () => {
    const diff = {
      old_value: { status: "pending" },
      new_value: { status: "verified", reference_code: "DON-001" },
      metadata: { actor_name: "Admin" },
      ip_address: "203.0.113.10",
    };
    const parsed = parseAuditDiff(diff);
    expect(parsed.old_value?.status).toBe("pending");
    expect(parsed.new_value?.reference_code).toBe("DON-001");
    expect(parsed.metadata?.actor_name).toBe("Admin");
    expect(parsed.ip_address).toBe("203.0.113.10");
  });

  it("parseAuditDiff returns empty object for invalid input", () => {
    expect(parseAuditDiff(null)).toEqual({});
    expect(parseAuditDiff([])).toEqual({});
    expect(parseAuditDiff("string")).toEqual({});
  });

  it("maskIp masks IPv4 middle octets", () => {
    expect(maskIp("203.0.113.10")).toBe("203.0.x.x");
    expect(maskIp(null)).toBe("—");
    expect(maskIp("2001:db8::1")).toBe("2001:db8…");
  });
});
