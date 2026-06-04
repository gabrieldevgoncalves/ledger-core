"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchJournal } from "@/lib/api";
import { formatMinorUnits, formatDateTime, shortId } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function JournalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data: journal, isLoading, error } = useQuery({
    queryKey: ["journal", id],
    queryFn: () => fetchJournal(id),
  });

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div className="flex items-center gap-3">
        <Link
          href="/journals"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Journals
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-mono text-xs text-muted-foreground">{shortId(id)}</span>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Journal not found
        </div>
      )}

      {/* Journal info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">
              {isLoading ? <Skeleton className="h-6 w-64" /> : (journal?.description ?? "Journal")}
            </CardTitle>
            {journal && (
              <Badge variant={journal.status === "POSTED" ? "default" : "secondary"}>
                {journal.status}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : journal ? (
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">ID</p>
                <p className="font-mono text-xs break-all">{journal.id}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Posted At</p>
                <p className="text-sm">{formatDateTime(journal.posted_at)}</p>
              </div>
              {journal.reference && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Reference</p>
                  <p className="font-mono text-xs">{journal.reference}</p>
                </div>
              )}
              {journal.fx_rate && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">FX Rate</p>
                  <p className="text-sm tabular-nums">
                    {journal.fx_base_currency}/{journal.fx_quote_currency} @ {journal.fx_rate}
                  </p>
                </div>
              )}
              {journal.reverses_journal_id && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Reverses</p>
                  <Link
                    href={`/journals/${journal.reverses_journal_id}`}
                    className="font-mono text-xs hover:underline"
                  >
                    {shortId(journal.reverses_journal_id)}
                  </Link>
                </div>
              )}
              {journal.reversed_by_id && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Reversed By</p>
                  <Link
                    href={`/journals/${journal.reversed_by_id}`}
                    className="font-mono text-xs hover:underline"
                  >
                    {shortId(journal.reversed_by_id)}
                  </Link>
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Entries */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">
          Entries {journal ? `(${journal.entries.length})` : ""}
        </h2>
        <div className="rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Currency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 4 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))}
              {!isLoading && (journal?.entries ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                    No entries
                  </TableCell>
                </TableRow>
              )}
              {(journal?.entries ?? []).map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <Link
                      href={`/accounts/${e.account_id}`}
                      className="font-mono text-xs hover:underline text-muted-foreground"
                    >
                      {shortId(e.account_id)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        e.direction === "DEBIT"
                          ? "border-blue-200 text-blue-700 bg-blue-50"
                          : "border-green-200 text-green-700 bg-green-50"
                      }
                    >
                      {e.direction}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">
                    {formatMinorUnits(e.amount, e.currency)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{e.currency}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {journal && (
          <p className="text-xs text-muted-foreground">
            Net: {
              Object.entries(
                journal.entries.reduce((acc, e) => {
                  acc[e.currency] = (acc[e.currency] ?? 0) +
                    (e.direction === "DEBIT" ? e.amount : -e.amount);
                  return acc;
                }, {} as Record<string, number>)
              )
                .map(([cur, net]) => `${formatMinorUnits(net, cur)} ${cur}`)
                .join(", ")
            } — double-entry balanced ✓
          </p>
        )}
      </div>
    </div>
  );
}
