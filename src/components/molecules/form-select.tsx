"use client";

import * as React from "react";

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
 * O Select do radix não é um `<select>`, então nada dele chega no FormData.
 * Este wrapper mantém um input escondido em sincronia — é o que permite usar
 * `<form action={serverAction}>` sem transformar cada formulário em estado
 * controlado.
 */
export function FormSelect({
  name,
  options,
  defaultValue,
  placeholder = "Selecione",
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
          <SelectValue placeholder={placeholder} />
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
