"use client";

import * as React from "react";

import type { ActionResult } from "@/lib/action-result";

type Action<T> = (
  prev: ActionResult<T> | null,
  formData: FormData,
) => Promise<ActionResult<T>>;

/**
 * Submete um formulário a uma Server Action e devolve o resultado por
 * callback.
 *
 * Existe no lugar de `useActionState` porque o padrão "deu certo → fecha o
 * diálogo e recarrega" vira um `useEffect` que observa o estado da action —
 * exatamente o `setState` dentro de efeito que o React desaconselha. Aqui o
 * sucesso é tratado onde ele acontece.
 */
export function useFormAction<T = undefined>(
  action: Action<T>,
  {
    onSuccess,
    onError,
  }: { onSuccess?: (data?: T) => void; onError?: (message: string) => void } = {},
) {
  const [pending, startTransition] = React.useTransition();

  const onSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      startTransition(async () => {
        const result = await action(null, formData);
        if (result.ok) onSuccess?.(result.data);
        else onError?.(result.error);
      });
    },
    [action, onSuccess, onError],
  );

  return { onSubmit, pending };
}
