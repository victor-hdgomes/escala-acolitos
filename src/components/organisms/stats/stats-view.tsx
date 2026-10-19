"use client";

import * as React from "react";
import { ArrowDownWideNarrow, Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export interface StatRow {
  id: string;
  name: string;
  served: number;
  answered: number;
  daysSinceLast: number | null;
  topLocation: string | null;
}

type SortKey = "served" | "answered" | "absent";

const SORTS: Array<{ id: SortKey; label: string }> = [
  { id: "served", label: "Quem serve mais" },
  { id: "answered", label: "Quem responde mais" },
  { id: "absent", label: "Quem sumiu" },
];

export function StatsView({
  rows,
  months,
}: {
  rows: StatRow[];
  months: Array<{ label: string; count: number }>;
}) {
  const [sort, setSort] = React.useState<SortKey>("served");

  const sorted = React.useMemo(() => {
    const copy = [...rows];
    if (sort === "served") copy.sort((a, b) => b.served - a.served);
    if (sort === "answered") copy.sort((a, b) => b.answered - a.answered);
    if (sort === "absent") {
      // Nunca serviu vem primeiro; depois quem está há mais tempo sem servir.
      copy.sort((a, b) => (b.daysSinceLast ?? 9999) - (a.daysSinceLast ?? 9999));
    }
    return copy;
  }, [rows, sort]);

  const maxServed = Math.max(1, ...rows.map((r) => r.served));
  const totalServed = rows.reduce((sum, r) => sum + r.served, 0);
  const average = rows.length ? totalServed / rows.length : 0;
  const neverServed = rows.filter((r) => r.served === 0).length;

  function downloadCsv() {
    const header = [
      "Nome",
      "Escalas",
      "Datas marcadas",
      "Dias desde a última",
      "Local mais frequente",
    ];
    const body = sorted.map((r) => [
      r.name,
      String(r.served),
      String(r.answered),
      r.daysSinceLast === null ? "nunca serviu" : String(r.daysSinceLast),
      r.topLocation ?? "",
    ]);
    const csv = [header, ...body]
      .map((cols) =>
        cols
          .map((c) => (/[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c))
          .join(";"),
      )
      .join("\r\n");

    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "estatisticas-acolitos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Estatísticas</h1>
          <p className="text-sm text-muted-foreground">
            Média de {average.toFixed(1)} escalas por acólito ·{" "}
            {neverServed} nunca serviram
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={downloadCsv}>
          <Download className="h-4 w-4" />
          CSV
        </Button>
      </header>

      {months.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Escalações por mês</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {months.map((m) => {
              const max = Math.max(...months.map((x) => x.count), 1);
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
        {SORTS.map((s) => (
          <Button
            key={s.id}
            size="sm"
            variant={sort === s.id ? "default" : "outline"}
            onClick={() => setSort(s.id)}
          >
            <ArrowDownWideNarrow className="h-3.5 w-3.5" />
            {s.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acólitos ({rows.length})</CardTitle>
          <CardDescription>
            A barra compara com quem mais serviu no período.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {sorted.map((r, i) => (
            <React.Fragment key={r.id}>
              {i > 0 ? <Separator /> : null}
              <div className="py-2">
                <div className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {r.name}
                  </span>
                  {r.served === 0 ? (
                    <Badge
                      variant="secondary"
                      className="bg-[color:var(--color-open)]/15 text-[color:var(--color-open)]"
                    >
                      nunca serviu
                    </Badge>
                  ) : (
                    <span className="text-sm font-medium tabular-nums">
                      {r.served}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-[color:var(--color-filled)]"
                      style={{ width: `${(r.served / maxServed) * 100}%` }}
                    />
                  </div>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {r.answered} datas marcadas
                  {r.topLocation ? ` · mais em ${r.topLocation}` : ""}
                  {r.daysSinceLast !== null
                    ? ` · última há ${r.daysSinceLast} dias`
                    : ""}
                </p>
              </div>
            </React.Fragment>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
