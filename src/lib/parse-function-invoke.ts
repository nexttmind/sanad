import { FunctionsHttpError } from "@supabase/supabase-js";

export type FunctionInvokeBody = {
  ok?: boolean;
  message?: string;
  reason?: string;
  errors?: Record<string, string>;
  reference_code?: string;
  id?: string;
  retry_after_seconds?: number;
};

/** Read JSON body from a successful invoke or from FunctionsHttpError.context (non-2xx). */
export async function readFunctionInvokeBody<T extends FunctionInvokeBody>(
  data: T | null | undefined,
  error: unknown,
): Promise<{ body: T | null; transportFailed: boolean }> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as T;
      return { body, transportFailed: false };
    } catch {
      return { body: null, transportFailed: true };
    }
  }

  if (error) {
    return { body: null, transportFailed: true };
  }

  return { body: data ?? null, transportFailed: false };
}
