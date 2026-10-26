"use client";

import * as React from "react";
import { ArrowDownWideNarrow, Download } from "lucide-react";
import { useTranslations } from "next-intl";

import { FormSelect } from "@/components/molecules/form-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

/** One person's turns (or marks) in one month at one place. */
export interface StatCell {
  month: string;
  locationId: string;
  count: number;
}

export interface StatRow {
  id: string;
  name: string;
  served: StatCell[];
  answered: StatCell[];
  daysSinceLast: number | null;
}

type SortKey = "served" | "answered" | "absent" | "overlooked";
const SORT_KEYS: SortKey[] = ["served", "answered", "absent", "overlooked"];

/** How far back the window reaches, in months. 0 means everything. */
const PERIODS = [0, 3, 6, 12] as const;

export function StatsView({
  rows,
  months,
  locations,
}: {
  rows: StatRow[];
  months: Array<{ iso: string; label: string }>;
  locations: Array<{ id: string; name: string }>;
}) {
  const t = useTranslations("stats");
  const [sort, setSort] = React.useState<SortKey>("served");
  const [period, setPeriod] = React.useState<number>(0);
  const [locationId, setLocationId] = React.useState<string>("");

  // The window is taken from the months that actually exist, not from the
  // calendar: a ministry that skipped August should still see six schedules
  // when it asks for six months.
  const monthsInWindow = React.useMemo(() => {
    const all = months.map((m) => m.iso);
    if (!period) return new Set(all);
    return new Set(all.slice(Math.max(0, all.length - period)));
  }, [months, period]);

  const sum = React.useCallback(
    (cells: StatCell[]) =>
      cells.reduce((total, cell) => {
        if (!monthsInWindow.has(cell.month)) return total;
        if (locationId && cell.locationId !== locationId) return total;
        return total + cell.count;
      }, 0),
    [monthsInWindow, locationId],
  );

  const view = React.useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        servedCount: sum(r.served),
        answeredCount: sum(r.answered),
      })),
    [rows, sum],
  );

  const sorted = React.useMemo(() => {
    const copy = [...view];
    if (sort === "served") copy.sort((a, b) => b.servedCount - a.servedCount);
    if (sort === "answered") {
      copy.sort((a, b) => b.answeredCount - a.answeredCount);
    }
    if (sort === "absent") {
      // Never served first, then whoever has gone longest without serving.
      copy.sort((a, b) => (b.daysSinceLast ?? 99999) - (a.daysSinceLast ?? 99999));
    }
    if (sort === "overlooked") {
      // The unfairest case in the whole product: said yes, never picked.
      const gap = (r: (typeof copy)[number]) =>
        r.servedCount === 0 ? r.answeredCount : -1;
      copy.sort((a, b) => gap(b) - gap(a));
    }
    return copy;
  }, [view, sort]);

  const maxServed = Math.max(1, ...view.map((r) => r.servedCount));
  const totalServed = view.reduce((s, r) => s + r.servedCount, 0);
  const average = view.length ? totalServed / view.length : 0;
  const neverServed = view.filter((r) => r.servedCount === 0).length;
  const overlooked = view.filter(
    (r) => r.servedCount === 0 && r.answeredCount > 0,
  ).length;

  const monthBars = React.useMemo(
    () =>
      months
        .filter((m) => monthsInWindow.has(m.iso))
        .map((m) => ({
          label: m.label,
          count: rows.reduce(
            (total, r) =>
              total +
              r.served
                .filter(
                  (c) =>
                    c.month === m.iso &&
                    (!locationId || c.locationId === locationId),
                )
                .reduce((n, c) => n + c.count, 0),
            0,
          ),
        })),
    [months, monthsInWindow, rows, locationId],
  );

  function downloadCsv() {
    const header = [
      t("csv.name"),
      t("csv.served"),
      t("csv.answered"),
      t("csv.daysSinceLast"),
    ];
    const body = sorted.map((r) => [
      r.name,
      String(r.servedCount),
      String(r.answeredCount),
      r.daysSinceLast === null ? t("neverServed") : String(r.daysSinceLast),
    ]);
    const csv = [header, ...body]
      .map((cols) =>
        cols
          .map((c) => (/[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c))
          .join(";"),
      )
      .join("\r\n");

    // Leading byte-order mark so Excel opens the file as UTF-8.
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = t("csv.fileName");
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("summary", { average: average.toFixed(1), count: neverServed })}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={downloadCsv}>
          <Download className="h-4 w-4" />
          {t("exportCsv")}
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="stats-period">{t("filters.period")}</Label>
          <FormSelect
            id="stats-period"
            name="period"
            defaultValue="0"
            options={PERIODS.map((p) => ({
              value: String(p),
              label: p === 0 ? t("filters.allTime") : t("filters.months", { count: p }),
            }))}
            onValueChange={(value) => setPeriod(Number(value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stats-location">{t("filters.location")}</Label>
          <FormSelect
            id="stats-location"
            name="location"
            defaultValue=""
            options={[
              { value: "", label: t("filters.allLocations") },
              ...locations.map((l) => ({ value: l.id, label: l.name })),
            ]}
            onValueChange={setLocationId}
          />
        </div>
      </div>

      {overlooked > 0 ? (
        <Card className="border-[color:var(--color-pending)]/50 bg-[color:var(--color-pending)]/5">
          <CardContent className="py-4 text-sm">
            {t("overlookedNotice", { count: overlooked })}
          </CardContent>
        </Card>
      ) : null}

      {monthBars.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("byMonth.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {monthBars.map((m) => {
              const max = Math.max(...monthBars.map((x) => x.count), 1);
              return (
                <div key={m.label} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-xs text-muted-foreground">
                    {m.label}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-[color:var(--color-chart-1)]"
                      style={{ width: `${(m.count / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-xs tabular-nums">
                    {m.count}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {SORT_KEYS.map((key) => (
          <Button
            key={key}
            size="sm"
            variant={sort === key ? "default" : "outline"}
            onClick={() => setSort(key)}
          >
            <ArrowDownWideNarrow className="h-3.5 w-3.5" />
            {t(`sorts.${key}`)}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("roster.title", { count: view.length })}
          </CardTitle>
          <CardDescription>{t("roster.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {sorted.map((r, i) => {
            // Rounded before comparing, so somebody on 3 turns against an
            // average of 3.02 is not reported as behind.
            const delta = Math.round(r.servedCount - average);
            return (
              <React.Fragment key={r.id}>
                {i > 0 ? <Separator /> : null}
                <div className="py-2">
                  <div className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {r.name}
                    </span>
                    {r.servedCount === 0 ? (
                      <Badge
                        variant="secondary"
                        className="bg-[color:var(--color-open)]/15 text-[color:var(--color-open)]"
                      >
                        {r.answeredCount > 0
                          ? t("overlooked")
                          : t("neverServed")}
                      </Badge>
                    ) : (
                      <span className="text-sm font-medium tabular-nums">
                        {r.servedCount}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-[color:var(--color-filled)]"
                        style={{
                          width: `${(r.servedCount / maxServed) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {t("row.answered", { count: r.answeredCount })}
                    {delta !== 0
                      ? ` · ${
                          delta > 0
                            ? t("row.above", { count: delta })
                            : t("row.below", { count: Math.abs(delta) })
                        }`
                      : ""}
                    {r.daysSinceLast !== null
                      ? ` · ${t("row.lastServed", { count: r.daysSinceLast })}`
                      : ""}
                  </p>
                </div>
              </React.Fragment>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
