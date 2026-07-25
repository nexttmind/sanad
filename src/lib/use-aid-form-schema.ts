import { useEffect, useState } from "react";
import {
  DEFAULT_AID_FORM_SCHEMA,
  fetchAidFormSchema,
  type AidFormSchema,
} from "@/lib/aid-form-schema";

export function useAidFormSchema(force = false) {
  const [schema, setSchema] = useState<AidFormSchema>(DEFAULT_AID_FORM_SCHEMA);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchAidFormSchema(force).then((s) => {
      if (!cancelled) {
        setSchema(s);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [force]);

  return { schema, loading, setSchema };
}
