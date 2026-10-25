"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SubmitButton({
  children,
  className,
  variant,
  size,
  disabled,
  pending: pendingProp,
}: {
  children: React.ReactNode;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  disabled?: boolean;
  /**
   * `useFormStatus` only sees forms with an `action`. Whoever submits through
   * `onSubmit` (see `useFormAction`) reports the pending state here.
   */
  pending?: boolean;
}) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      disabled={pending || disabled}
      className={cn(className)}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </Button>
  );
}
