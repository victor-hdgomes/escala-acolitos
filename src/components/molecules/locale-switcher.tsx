"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Check, Languages } from "lucide-react";

import { setLocaleAction } from "@/app/actions/locale";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

/**
 * Language picker.
 *
 * Each option is written in its own language - someone who landed in the wrong
 * one can still read their way out, which is the whole point of the control.
 */
export function LocaleSwitcher({
  variant = "icon",
  className,
}: {
  /** "icon" for toolbars, "full" where there is room for a label. */
  variant?: "icon" | "full";
  className?: string;
}) {
  const router = useRouter();
  const locale = useLocale() as Locale;
  const t = useTranslations("common");
  const [pending, startTransition] = React.useTransition();

  const choose = (next: Locale) =>
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={variant === "icon" ? "icon" : "sm"}
          disabled={pending}
          aria-label={t("language")}
          className={cn(variant === "full" && "gap-2", className)}
        >
          <Languages className="h-4 w-4" />
          {variant === "full" ? LOCALE_LABELS[locale] : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t("language")}</DropdownMenuLabel>
        {LOCALES.map((option) => (
          <DropdownMenuItem key={option} onSelect={() => choose(option)}>
            <span className="min-w-0 flex-1 truncate">
              {LOCALE_LABELS[option]}
            </span>
            {option === locale ? <Check className="h-4 w-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
