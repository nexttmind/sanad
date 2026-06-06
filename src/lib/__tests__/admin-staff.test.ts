import { describe, expect, it } from "vitest";
import { staffMapById } from "@/lib/admin-staff";

describe("admin-staff helpers", () => {
  it("staffMapById builds user_id to display_name map", () => {
    const map = staffMapById([
      { user_id: "u1", role: "admin", email: "a@x.com", display_name: "Sami" },
      { user_id: "u2", role: "reviewer", email: "b@x.com", display_name: "Rana" },
    ]);
    expect(map.u1).toBe("Sami");
    expect(map.u2).toBe("Rana");
    expect(Object.keys(map)).toHaveLength(2);
  });
});
