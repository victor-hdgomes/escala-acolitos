"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Radix's Select is not a `<select>`, so nothing of it reaches the FormData.
 * This wrapper keeps a hidden input in sync - that is what allows using
 * `<form action={serverAction}>` without turning every form into controlled
 * state.
 */
export function FormSelect({
  name,
  options,
  defaultValue,
  placeholder,
  id,
  required,
  className,
  onValueChange,
}: {
  name: string;
  options: SelectOption[];
  defaultValue?: string;
  placeholder?: string;
  id?: string;
  required?: boolean;
  className?: string;
  onValueChange?: (value: string) => void;
}) {
  const t = useTranslations("shell");
  const [value, setValue] = React.useState(defaultValue ?? "");

  return (
    <>
      <input type="hidden" name={name} value={value} required={required} />
      <Select
        value={value || undefined}
        onValueChange={(next) => {
          setValue(next);
          onValueChange?.(next);
        }}
      >
        <SelectTrigger id={id} className={className ?? "w-full"}>
          <SelectValue placeholder={placeholder ?? t("select.placeholder")} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
