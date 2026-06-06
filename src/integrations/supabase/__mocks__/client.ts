import { vi } from "vitest";
import { buildMockSupabase } from "@/test/helpers/mock-builders";

export const supabase = buildMockSupabase();

/** Reset all mock call history between tests. */
export function resetSupabaseMock() {
  supabase.from.mockReset();
  supabase.rpc.mockReset();
  supabase.auth.getUser.mockReset();
  supabase.storage.from.mockReset();
  supabase.functions.invoke.mockReset();
  supabase.channel.mockReset();
  supabase.removeChannel.mockReset();
}
