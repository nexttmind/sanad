/** Stable device fingerprint for fraud scoring — collected only on form submit. */
export async function getDeviceFingerprint(): Promise<string | null> {
  if (typeof window === "undefined" || !crypto?.subtle) return null;

  const parts = [
    navigator.userAgent,
    String(screen.width),
    String(screen.height),
    navigator.language,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join("|");

  const encoded = new TextEncoder().encode(parts);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
