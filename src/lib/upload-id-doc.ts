import { supabase } from "@/integrations/supabase/client";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export type UploadIdDocResult =
  | { ok: true; storage_path: string }
  | { ok: false; message: string; rateLimited?: boolean };

async function fileToBase64(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("file too large");
  }
  const buffer = await new Response(file).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/** Rate-limited ID document upload via edge function (Step 4.1). */
export async function uploadIdDocument(
  requestId: string,
  file: File,
): Promise<UploadIdDocResult> {
  if (!requestId.trim() || file.size === 0) {
    return { ok: false, message: "invalid upload" };
  }

  let file_base64: string;
  try {
    file_base64 = await fileToBase64(file);
  } catch (err) {
    if (err instanceof Error && err.message === "file too large") {
      return { ok: false, message: "حجم الملف يجب ألا يتجاوز ٥ ميغابايت." };
    }
    return { ok: false, message: "تعذّر رفع الوثيقة." };
  }

  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean;
    message?: string;
    storage_path?: string;
    retry_after_seconds?: number;
  }>("upload-id-doc", {
    body: {
      request_id: requestId,
      file_base64,
      filename: file.name,
      content_type: file.type || "application/octet-stream",
    },
  });

  if (error) {
    if (import.meta.env.DEV) console.error("[UploadIdDoc] invoke failed:", error);
    return { ok: false, message: "تعذّر رفع الوثيقة." };
  }

  if (!data?.ok || !data.storage_path) {
    const message = data?.message ?? "تعذّر رفع الوثيقة.";
    const rateLimited =
      typeof data?.message === "string" &&
      (data.message.includes("تجاوزت الحد") || data.retry_after_seconds != null);
    return { ok: false, message, rateLimited };
  }

  return { ok: true, storage_path: data.storage_path };
}
