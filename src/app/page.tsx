import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Link2 } from "lucide-react";

import { AssemblyPreview } from "@/components/organisms/landing/assembly-preview";
import {
  LandingCaption,
  LandingEyebrow,
  LandingHeading,
  LandingProse,
  LandingSection,
} from "@/components/organisms/landing/landing-section";
import { ResponseCounters } from "@/components/organisms/landing/response-counters";
import { SaintTarcisius } from "@/components/organisms/landing/saint-tarcisius";
import { LocaleSwitcher } from "@/components/molecules/locale-switcher";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

/**
 * The front door.
 *
 * Renders for everyone, signed in or not. An earlier version redirected
 * signed-in visitors straight into the app, which meant the one person most
 * likely to send this link to another parish - the coordinator already using
 * it - could never see the page they were sending. Signed-in visitors get the
 * same page with the call to action pointed at their schedules instead.
 */
export default async function LandingPage() {
  const t = await getTranslations("landing");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const signedIn = !!user;

  const ledger = t.raw("recognition.items") as string[];
  const steps = t.raw("steps.items") as Array<{ title: string; body: string }>;
  const advantages = t.raw("advantages.items") as Array<{
    title: string;
    body: string;
  }>;
  const questions = t.raw("faq.items") as Array<{ q: string; a: string }>;

  const primaryHref = signedIn ? "/home" : "/signup";
  const primaryLabel = signedIn ? t("cta.openApp") : t("cta.primary");

  return (
    <div className="pb-24 sm:pb-0">
      <header className="mx-auto flex w-full max-w-[34rem] items-center justify-between px-5 py-5 sm:max-w-2xl">
        <span className="flex items-center gap-2 font-semibold tracking-tight">
          <SaintTarcisius variant="compact" className="h-7 w-7 shrink-0" />
          {t("productName")}
        </span>
        <div className="flex items-center gap-1">
          <LocaleSwitcher />
          <Button variant="ghost" size="sm" asChild>
            <Link href={signedIn ? "/home" : "/login"}>
              {signedIn ? t("cta.openApp") : t("cta.signIn")}
            </Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto w-full max-w-[34rem] px-5 pt-6 pb-14 sm:max-w-2xl sm:pb-20">
        <LandingEyebrow>{t("hero.eyebrow")}</LandingEyebrow>
        <h1 className="mt-3 text-[2rem] leading-[1.15] font-semibold tracking-tight text-balance sm:text-5xl">
          {t("hero.headline")}
        </h1>
        <p className="mt-4 max-w-prose text-base text-pretty text-muted-foreground sm:text-lg">
          {t("hero.subheadline")}
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" asChild className="w-full sm:w-auto">
            <Link href={primaryHref}>
              {primaryLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          {!signedIn ? (
            <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
              <Link href="/login">{t("cta.signIn")}</Link>
            </Button>
          ) : null}
        </div>

        <p className="mt-4 text-sm text-muted-foreground">{t("hero.support")}</p>

        {/* Not a Card and never a button: a third offer here would compete
            with the two that matter. */}
        <aside className="mt-8 flex gap-3 rounded-lg border-l-2 border-[color:var(--color-pending)] bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          <Link2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{t("hero.serverAside")}</p>
        </aside>
      </section>

      {/* Recognition, set like a ledger of grievances */}
      <LandingSection tone="recessed">
        <LandingHeading>{t("recognition.title")}</LandingHeading>
        <ul className="mt-5">
          {ledger.map((line) => (
            <li
              key={line}
              className="flex gap-3 border-b border-border/60 py-3 text-base leading-relaxed text-muted-foreground last:border-b-0"
            >
              <span
                className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-[color:var(--color-open)]/70"
                aria-hidden
              />
              {line}
            </li>
          ))}
        </ul>
        <LandingProse className="mt-5 text-foreground">
          {t("recognition.closing")}
        </LandingProse>
      </LandingSection>

      <LandingSection>
        <LandingHeading>{t("turn")}</LandingHeading>
      </LandingSection>

      {/* How a month goes */}
      <LandingSection>
        <LandingHeading>{t("steps.title")}</LandingHeading>
        <ol className="mt-6 flex flex-col gap-6">
          {steps.map((step, index) => (
            <li key={step.title}>
              <div className="flex gap-3">
                <span
                  className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border border-border text-sm text-muted-foreground tabular-nums"
                  aria-hidden
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-medium">{step.title}</p>
                  <LandingProse className="mt-1">{step.body}</LandingProse>
                  {index === 3 ? <AssemblyPreview /> : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </LandingSection>

      {/* What the form never told you */}
      <LandingSection>
        <LandingHeading>{t("counters.title")}</LandingHeading>
        <LandingProse className="mt-3">{t("counters.body")}</LandingProse>
        <ResponseCounters />
        <LandingProse className="mt-5">{t("counters.followUp")}</LandingProse>
      </LandingSection>

      {/* Four things a spreadsheet was never going to tell you */}
      <LandingSection tone="recessed">
        <LandingHeading>{t("advantages.title")}</LandingHeading>
        <dl className="mt-6 flex flex-col gap-5">
          {advantages.map((item) => (
            <div key={item.title}>
              <dt className="font-medium">{item.title}</dt>
              <dd className="mt-1 text-base leading-relaxed text-muted-foreground">
                {item.body}
              </dd>
            </div>
          ))}
        </dl>
      </LandingSection>

      {/* Swaps - the one place amber appears outside the host */}
      <LandingSection>
        <LandingHeading>{t("swap.title")}</LandingHeading>
        <div className="mt-4 border-l-2 border-[color:var(--color-pending)] pl-4">
          <LandingProse>{t("swap.body")}</LandingProse>
          <LandingProse className="mt-3">{t("swap.closing")}</LandingProse>
        </div>
      </LandingSection>

      <LandingSection>
        <LandingHeading className="text-[color:var(--color-novena)]">
          {t("novena.title")}
        </LandingHeading>
        <LandingProse className="mt-3">{t("novena.body")}</LandingProse>
        <LandingProse className="mt-3">{t("novena.scope")}</LandingProse>
      </LandingSection>

      <LandingSection>
        <LandingHeading>{t("stats.title")}</LandingHeading>
        <LandingProse className="mt-3">{t("stats.body")}</LandingProse>
        <LandingProse className="mt-3">{t("stats.closing")}</LandingProse>
      </LandingSection>

      <LandingSection>
        <LandingHeading>{t("noAccount.title")}</LandingHeading>
        <LandingProse className="mt-3">{t("noAccount.body")}</LandingProse>
        <LandingProse className="mt-3">{t("noAccount.privacy")}</LandingProse>
        <LandingProse className="mt-3">{t("noAccount.claim")}</LandingProse>
      </LandingSection>

      {/* Saint Tarcisius. No buttons in this band. Ever. */}
      <LandingSection tone="shrine" className="text-center">
        <SaintTarcisius
          className="mx-auto h-42 w-42 motion-safe:animate-[achievement-rise_250ms_cubic-bezier(0.16,1,0.3,1)_both]"
          title={t("tarcisius.figureAlt")}
        />
        <LandingHeading className="mt-8">{t("tarcisius.title")}</LandingHeading>
        <LandingProse className="mt-4 text-left">
          {t("tarcisius.story")}
        </LandingProse>
        <LandingProse className="mt-4 text-left">
          {t("tarcisius.today")}
        </LandingProse>
        <LandingProse className="mt-4 text-left text-foreground">
          {t("tarcisius.closing")}
        </LandingProse>
      </LandingSection>

      {/* A plain list. A volunteer should not have to click to find an answer. */}
      <LandingSection>
        <LandingHeading>{t("faq.title")}</LandingHeading>
        <dl className="mt-6 flex flex-col gap-5">
          {questions.map((item) => (
            <div key={item.q}>
              <dt className="font-medium">{item.q}</dt>
              <dd className="mt-1 text-base leading-relaxed text-muted-foreground">
                {item.a}
              </dd>
            </div>
          ))}
        </dl>
      </LandingSection>

      <LandingSection>
        <LandingHeading>{t("final.title")}</LandingHeading>
        <LandingProse className="mt-3">{t("final.body")}</LandingProse>
        <LandingProse className="mt-3">{t("final.reassurance")}</LandingProse>
        <div className="mt-6">
          <Button size="lg" asChild className="w-full sm:w-auto">
            <Link href={primaryHref}>
              {primaryLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <LandingCaption>{t("final.passItOn")}</LandingCaption>
      </LandingSection>

      <footer className="mx-auto w-full max-w-[34rem] px-5 py-10 sm:max-w-2xl">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <SaintTarcisius
            variant="compact"
            className="h-4 w-4 shrink-0 opacity-60"
          />
          {t("footer.line")}
        </div>
      </footer>

      {/* Phone-only: the primary action stays reachable once the hero is gone. */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:hidden">
        <Button size="lg" asChild className="w-full">
          <Link href={primaryHref}>{primaryLabel}</Link>
        </Button>
      </div>
    </div>
  );
}
