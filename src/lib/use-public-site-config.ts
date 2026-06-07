import { useEffect, useState } from "react";
import {
  DEFAULT_PUBLIC_SITE_CONFIG,
  fetchPublicSiteConfig,
  type PublicSiteConfig,
} from "@/lib/public-site-config";

export function usePublicSiteConfig() {
  const [config, setConfig] = useState<PublicSiteConfig>(DEFAULT_PUBLIC_SITE_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchPublicSiteConfig().then((c) => {
      if (!cancelled) {
        setConfig(c);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { config, loading };
}
