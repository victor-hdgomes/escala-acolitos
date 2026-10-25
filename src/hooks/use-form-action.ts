"use client";

import * as React from "react";
import { toast } from "sonner";

import { useResultError } from "@/hooks/use-error-message";
import type { ActionResult } from "@/lib/action-result";

type Action<T> = (
  prev: ActionResult<T> | null,
  formData: FormData,
) => Promise<ActionResult<T>>;

interface Options<T> {
  /** Runs only when the action succeeded. */
  onSuccess?: (data?: T) => void;
  /**
   * Runs instead of the default toast. The message arrives already translated
   * - callers deal in sentences, never in codes.
   */
  onError?: (message: string) => void;
}

/**
 * Submits a form to a Server Action and reports the outcome.
 *
 * Exists instead of `useActionState` because the common pattern - "it worked,
 * so close the dialog and refresh" - becomes a `useEffect` watching action
 * state, which is exactly the setState-inside-an-effect React warns about.
 * Here success is handled where it happens.
 *
 * Errors are toasted by default: every form in the product wants that, and
 * forgetting it is how a failed save becomes a silent one.
 */
export function useFormAction<T = undefined>(
  action: Action<T>,
  { onSuccess, onError }: Options<T> = {},
) {
  const [pending, startTransition] = React.useTransition();
  const resultError = useResultError();

  const onSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);

      startTransition(async () => {
        const result = await action(null, formData);

        if (result.ok) {
          onSuccess?.(result.data);
          return;
        }

        const message = resultError(result);
        if (!message) return;
        if (onError) onError(message);
        else toast.error(message);
      });
    },
    [action, onSuccess, onError, resultError],
  );

  return { onSubmit, pending };
}
