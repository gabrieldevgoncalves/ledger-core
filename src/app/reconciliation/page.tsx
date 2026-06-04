"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchReconciliationRuns } from "@/lib/api";
import { formatMinorUnits, formatDateTime, shortId } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ReconciliationPage() {
  const { data: runs, isLoading, error } = useQuery({
    queryKey: ["reconciliation-runs"],
    queryFn: fetchReconciliationRuns,
    refetchInterval: 30_000,
  });

  const latest = runs?.[0];
  const passCount = runs?.filter((r) => r.status === "PASS").length ?? 0;
  const failCount = runs?.filter((r) => r.status === "FAIL").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Reconciliation</h1>
        {runs && (
          <span className="text-sm text-muted-foreground">{runs.length} runs</span>
        )}
      </div>

      {/* Summary cards */}
      {(isLoading || latest) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card size="sm">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Latest Status</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : latest ? (
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">
                    {latest.status === "PASS" ? "✅" : "❌"}
                  </span>
                  <Badge
                    variant={latest.status === "PASS" ? "outline" : "destructive"}
                    className={latest.status === "PASS" ? "border-green-500 text-green-600" : ""}
                  >
                    {latest.status}
                  </Badge>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Pass / Fail</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <p className="text-2xl font-bold">
                  <span className="text-green-600">{passCount}</span>
                  <span className="text-muted-foreground font-normal text-base"> / </span>
                  <span className="text-destructive">{failCount}</span>
                </p>
              )}
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Latest Debits</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : latest ? (
                <p className="text-lg font-bold tabular-nums">
                  {latest.total_debits.toLocaleString()}
                  <span className="text-xs font-normal text-muted-foreground ml-1">minor units</span>
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load reconciliation runs
        </div>
      )}

      {/* Run history */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Run History</h2>
        <div className="rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total Debits</TableHead>
                <TableHead className="text-right">Total Credits</TableHead>
                <TableHead className="text-right">Discrepancy</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead>Run At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))}
              {!isLoading && (runs ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    No reconciliation runs yet
                  </TableCell>
                </TableRow>
              )}
              {(runs ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {shortId(r.id)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={r.status === "PASS" ? "outline" : "destructive"}
                      className={r.status === "PASS" ? "border-green-500 text-green-600 bg-green-50" : ""}
                    >
                      {r.status === "PASS" ? "✓ PASS" : "✗ FAIL"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {r.total_debits.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {r.total_credits.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {r.discrepancy === 0 ? (
                      <span className="text-green-600">0</span>
                    ) : (
                      <span className="text-destructive">{r.discrepancy.toLocaleString()}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {r.duration_ms}ms
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(r.run_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
