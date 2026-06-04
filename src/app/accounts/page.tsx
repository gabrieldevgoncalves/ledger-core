"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchAccounts } from "@/lib/api";
import { formatMinorUnits, formatDate } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const TYPE_COLORS: Record<string, string> = {
  ASSET:     "bg-blue-50 text-blue-700 border-blue-200",
  LIABILITY: "bg-orange-50 text-orange-700 border-orange-200",
  REVENUE:   "bg-green-50 text-green-700 border-green-200",
  EXPENSE:   "bg-red-50 text-red-700 border-red-200",
  EQUITY:    "bg-purple-50 text-purple-700 border-purple-200",
};

export default function AccountsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const { data, isLoading, error } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => fetchAccounts(),
  });

  const accounts = (data?.data ?? []).filter((a) => {
    const matchSearch =
      search === "" ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.currency.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "ALL" || a.type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
        {data && (
          <span className="text-sm text-muted-foreground">
            {data.data.length} total
          </span>
        )}
      </div>

      <div className="flex gap-3">
        <Input
          placeholder="Search by name or currency…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
        >
          {["ALL", "ASSET", "LIABILITY", "REVENUE", "EXPENSE", "EQUITY"].map((t) => (
            <option key={t} value={t}>{t === "ALL" ? "All Types" : t}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load accounts
        </div>
      )}

      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {!isLoading && accounts.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                  No accounts found
                </TableCell>
              </TableRow>
            )}
            {accounts.map((a) => (
              <TableRow key={a.id} className="cursor-pointer">
                <TableCell>
                  <Link
                    href={`/accounts/${a.id}`}
                    className="font-medium hover:underline"
                  >
                    {a.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[a.type] ?? ""}`}
                  >
                    {a.type}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs">{a.currency}</TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {formatMinorUnits(a.balance_minor_units, a.currency)}
                </TableCell>
                <TableCell>
                  <Badge variant={a.is_active ? "outline" : "secondary"}>
                    {a.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {formatDate(a.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
