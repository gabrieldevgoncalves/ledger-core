"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchAccount, fetchAccountEntries } from "@/lib/api";
import { formatMinorUnits, formatDate, formatDateTime, shortId } from "@/lib/format";
import { BalanceChart } from "@/components/balance-chart";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";

export default function AccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [granularity, setGranularity] = useState<"daily" | "monthly">("monthly");

  const { data: account, isLoading: loadingAccount } = useQuery({
    queryKey: ["account", id],
    queryFn: () => fetchAccount(id),
  });

  const { data: entriesPage, isLoading: loadingEntries } = useQuery({
    queryKey: ["account-entries", id],
    queryFn: () => fetchAccountEntries(id),
  });

  const entries = entriesPage?.data ?? [];

  return (
    <div className="space-y-6">
      {/* Back link + header */}
      <div className="flex items-center gap-3">
        <Link
          href="/accounts"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Accounts
        </Link>
        <span className="text-muted-foreground">/</span>
        {loadingAccount ? (
          <Skeleton className="h-5 w-48" />
        ) : (
          <span className="text-sm font-medium">{account?.name}</span>
        )}
      </div>

      {/* Account info card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            {loadingAccount ? <Skeleton className="h-6 w-64" /> : account?.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingAccount ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-40" />
            </div>
          ) : account ? (
            <div className="flex flex-wrap gap-6 items-start">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Type</p>
                <p className="font-medium">{account.type}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Currency</p>
                <p className="font-mono font-medium">{account.currency}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Balance</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatMinorUnits(account.balance_minor_units, account.currency)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
                <Badge variant={account.is_active ? "outline" : "secondary"}>
                  {account.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">ID</p>
                <p className="font-mono text-xs text-muted-foreground">{id}</p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Balance chart */}
      {account && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Balance History</CardTitle>
              <Tabs
                value={granularity}
                onValueChange={(v) => setGranularity(v as "daily" | "monthly")}
              >
                <TabsList>
                  <TabsTrigger value="daily">Daily</TabsTrigger>
                  <TabsTrigger value="monthly">Monthly</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            <BalanceChart
              accountId={id}
              currency={account.currency}
              granularity={granularity}
            />
          </CardContent>
        </Card>
      )}

      {/* Entry history */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Entry History</h2>
          {!loadingEntries && (
            <span className="text-sm text-muted-foreground">
              {entries.length} entries
            </span>
          )}
        </div>
        <div className="rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Journal</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingEntries &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              {!loadingEntries && entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                    No entries
                  </TableCell>
                </TableRow>
              )}
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <Link
                      href={`/journals/${e.journal_id}`}
                      className="font-mono text-xs hover:underline text-muted-foreground"
                    >
                      {shortId(e.journal_id)}
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
                  <TableCell className="text-muted-foreground text-xs">
                    {formatDateTime(e.created_at)}
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
