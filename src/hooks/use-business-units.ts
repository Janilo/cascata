import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BusinessUnit = { code: string; label: string; sort_order: number };

// Hard-coded BU color palette (cycles if more than 6 BUs)
export const BU_COLORS = [
  "var(--marine)",
  "var(--primary)",
  "var(--gold)",
  "var(--green)",
  "#7d3c98",
  "#d35400",
];

const FALLBACK: BusinessUnit[] = [
  { code: "B2B", label: "B2B", sort_order: 1 },
  { code: "B2C", label: "B2C", sort_order: 2 },
];

export function useBusinessUnits() {
  const [bus, setBus] = useState<BusinessUnit[]>(FALLBACK);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("business_units")
        .select("code,label,sort_order")
        .order("sort_order");
      if (!error && data && data.length) setBus(data as BusinessUnit[]);
      setLoaded(true);
    })();
  }, []);

  const labelOf = (code: string) => bus.find((b) => b.code === code)?.label ?? code;
  const colorOf = (code: string) => {
    const i = bus.findIndex((b) => b.code === code);
    return BU_COLORS[(i < 0 ? 0 : i) % BU_COLORS.length];
  };

  return { bus, loaded, labelOf, colorOf };
}
