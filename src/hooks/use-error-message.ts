"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { ActionResult, ErrorCode, ErrorParams } from "@/lib/action-result";

/**
 * Turns an action's error code into a sentence in the reader's language.
 *
 * Single place where codes become prose, so a component never has to know a
 * namespace or remember to pass params.
 */
export function useErrorMessage() {
  const t = useTranslations("errors");

  return React.useCallback(
    (code: ErrorCode, params?: ErrorParams) => t(code, params),
    [t],
  );
}

/**
 * Narrows a result and translates it in one step.
 *
 * Returns null when the action succeeded, which reads naturally at call sites:
 * `const error = messageFor(result); if (error) toast.error(error)`.
 */
export function useResultError() {
  const messageFor = useErrorMessage();

  return React.useCallback(
    <T,>(result: ActionResult<T> | null | undefined): string | null =>
      result && !result.ok ? messageFor(result.code, result.params) : null,
    [messageFor],
  );
}
