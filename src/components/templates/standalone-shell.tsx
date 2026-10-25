import { getTranslations } from "next-intl/server";

import { SaintTarcisius } from "@/components/organisms/landing/saint-tarcisius";

/**
 * The column every page outside the signed-in app is built on: accepting an
 * invitation, redeeming a join link, opening a group, waiting to be added.
 *
 * They are all the same shape, so the shape lives here instead of being
 * retyped with slightly different paddings on each one. The artwork is the
 * reason it is a component rather than a `<div>`: Tarcisius is a child who
 * carried the Eucharist and was killed rather than hand it over, and these
 * are the screens where someone is deciding whether this ministry's app is
 * worth signing up for.
 */
export async function StandaloneShell({
  heading,
  description,
  art = "mark",
  children,
  footer,
}: {
  heading?: string;
  description?: string;
  /** "hero" gives the artwork the top of the page; "mark" keeps it inline. */
  art?: "hero" | "mark" | "none";
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const app = await getTranslations("app");

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      {art === "hero" ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <SaintTarcisius className="h-28 w-28" />
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
            {app("name")}
          </p>
        </div>
      ) : null}

      <div>
        {art === "mark" ? (
          <div className="mb-4 flex items-center gap-2 text-lg font-semibold tracking-tight">
            <SaintTarcisius variant="compact" className="h-7 w-7 shrink-0" />
            {app("name")}
          </div>
        ) : null}
        {heading ? (
          <h1 className="text-xl font-semibold tracking-tight">{heading}</h1>
        ) : null}
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>

      {children}

      {footer ? <div>{footer}</div> : null}
    </div>
  );
}
