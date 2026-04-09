"use client";

import { useRouter } from "next/navigation";
import { DEFAULT_CURRENCY, normalizeSupportedCurrency, persistPreferredCurrency, type SupportedCurrency } from "@/lib/currency";

interface CurrencySelectorProps {
  value: SupportedCurrency;
  onChange?: (currency: SupportedCurrency) => void;
  id?: string;
  label?: string;
  className?: string;
  refreshOnChange?: boolean;
}

export default function CurrencySelector({
  value,
  onChange,
  id = "currency-selector",
  label = "Currency",
  className = "rounded-full border border-border bg-surface px-4 py-2 text-sm text-foreground",
  refreshOnChange = false,
}: CurrencySelectorProps) {
  const router = useRouter();

  function handleChange(nextValue: string) {
    const nextCurrency = normalizeSupportedCurrency(nextValue);
    persistPreferredCurrency(nextCurrency);
    onChange?.(nextCurrency);

    if (refreshOnChange) {
      router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm text-foreground/60">
        {label}
      </label>
      <select
        id={id}
        value={value || DEFAULT_CURRENCY}
        onChange={(event) => handleChange(event.target.value)}
        className={className}
      >
        <option value="USD">USD</option>
        <option value="EUR">EUR</option>
        <option value="GBP">GBP</option>
      </select>
    </div>
  );
}
