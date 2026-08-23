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

type InvokeErrorContext = {
  context?: {
    json?: () => Promise<unknown>;
    text?: () => Promise<string>;
    status?: number;
  };
};

function hasInvokeErrorContext(error: unknown): error is InvokeErrorContext & { context: NonNullable<InvokeErrorContext["context"]> } {
  if (typeof error !== "object" || error === null || !("context" in error)) return false;
  const ctx = (error as InvokeErrorContext).context;
  return !!ctx && (typeof ctx.json === "function" || typeof ctx.text === "function");
}

async function readInvokeErrorBody<T extends FunctionInvokeBody>(error: unknown): Promise<T | null> {
  if (!hasInvokeErrorContext(error)) return null;

  if (typeof error.context.json === "function") {
    try {
      return (await error.context.json()) as T;
    } catch {
      /* fall through to text */
    }
  }

  if (typeof error.context.text === "function") {
    try {
      const raw = (await error.context.text()).trim();
      if (!raw) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return { ok: false, message: raw } as T;
      }
    } catch {
      return null;
    }
  }

  return null;
}

/** Read JSON body from a successful invoke or from FunctionsHttpError.context (non-2xx). */
export async function readFunctionInvokeBody<T extends FunctionInvokeBody>(
  data: T | null | undefined,
  error: unknown,
): Promise<{ body: T | null; transportFailed: boolean }> {
  if (error) {
    const body = await readInvokeErrorBody<T>(error);
    if (body) return { body, transportFailed: false };

    // instanceof fallback for environments where duck-typing context shape differs
    if (error instanceof FunctionsHttpError) {
      const fromInstance = await readInvokeErrorBody<T>(error);
      if (fromInstance) return { body: fromInstance, transportFailed: false };
    }

    return { body: null, transportFailed: true };
  }

  return { body: data ?? null, transportFailed: false };
}
