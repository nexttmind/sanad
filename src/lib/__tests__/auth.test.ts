import { describe, expect, it } from "vitest";
import type { User } from "@supabase/supabase-js";
import {
  displayNameFromUser,
  initialsFromName,
  pickPrimaryRole,
  roleLabel,
  safeAdminRedirect,
} from "@/lib/auth";

describe("auth helpers", () => {
  it("roleLabel returns Arabic labels", () => {
    expect(roleLabel("admin")).toBe("مدير");
    expect(roleLabel("reviewer")).toBe("مراجع");
    expect(roleLabel("distributor")).toBe("موزّع");
    expect(roleLabel("viewer")).toBe("مشاهد");
  });

  it("pickPrimaryRole chooses highest priority role", () => {
    expect(pickPrimaryRole(["viewer", "admin", "reviewer"])).toBe("admin");
    expect(pickPrimaryRole(["distributor", "viewer"])).toBe("distributor");
    expect(pickPrimaryRole([])).toBeNull();
  });

  it("displayNameFromUser prefers full_name metadata", () => {
    const user = {
      email: "admin@sanad.lb",
      user_metadata: { full_name: "  سامي جابر  " },
    } as User;
    expect(displayNameFromUser(user)).toBe("سامي جابر");
  });

  it("displayNameFromUser falls back to email local part", () => {
    const user = { email: "reviewer@sanad.lb", user_metadata: {} } as User;
    expect(displayNameFromUser(user)).toBe("reviewer");
  });

  it("displayNameFromUser falls back to generic label", () => {
    const user = { user_metadata: {} } as User;
    expect(displayNameFromUser(user)).toBe("مستخدم");
  });

  it("initialsFromName extracts two initials from two words", () => {
    expect(initialsFromName("سامي جابر")).toBe("سج");
  });

  it("initialsFromName uses first two chars for single word", () => {
    expect(initialsFromName("Admin")).toBe("Ad");
  });

  it("initialsFromName handles empty input", () => {
    expect(initialsFromName("   ")).toBe("؟؟");
  });

  it("safeAdminRedirect only allows /admin paths", () => {
    expect(safeAdminRedirect("/admin/requests")).toBe("/admin/requests");
    expect(safeAdminRedirect("https://evil.com/admin")).toBe("/admin");
    expect(safeAdminRedirect(undefined)).toBe("/admin");
  });
});
