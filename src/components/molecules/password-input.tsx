"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const t = useTranslations("shell");
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className="pr-10" />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute top-0 right-0 h-full px-3 hover:bg-transparent"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("passwordInput.hide") : t("passwordInput.show")}
        tabIndex={-1}
      >
        {visible ? (
          <EyeOff className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Eye className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>
    </div>
  );
}
