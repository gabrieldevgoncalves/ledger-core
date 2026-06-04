"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchJournals } from "@/lib/api";
import { formatDateTime, shortId } from "@/lib/format";
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

function StatusBadge({ status }: { status: string }) {
  if (status === "POSTED")
    return <Badge variant="default">{status}</Badge>;
  if (status === "REVERSED")
    return <Badge variant="secondary">{status}</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export default function JournalsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const { data, isLoading, error } = useQuery({
    queryKey: ["journals"],
    queryFn: () => fetchJournals(),
  });

  const journals = (data?.data ?? []).filter((j) => {
    const matchSearch =
      search === "" ||
      j.id.toLowerCase().includes(search.toLowerCase()) ||
      (j.description ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (j.reference ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || j.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Journals</h1>
        {data && (
          <span className="text-sm text-muted-foreground">
            {data.data.length} total
          </span>
        )}
      </div>

      <div className="flex gap-3">
        <Input
          placeholder="Search by description or reference…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
        >
          {["ALL", "POSTED", "REVERSED"].map((s) => (
            <option key={s} value={s}>{s === "ALL" ? "All Statuses" : s}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load journals
        </div>
      )}

      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Entries</TableHead>
              <TableHead>Posted At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {!isLoading && journals.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                  No journals found
                </TableCell>
              </TableRow>
            )}
            {journals.map((j) => (
              <TableRow key={j.id} className="cursor-pointer">
                <TableCell>
                  <Link
                    href={`/journals/${j.id}`}
                    className="font-mono text-xs hover:underline"
                  >
                    {shortId(j.id)}
                  </Link>
                </TableCell>
                <TableCell className="max-w-xs truncate text-sm">
                  {j.description ?? (
                    <span className="text-muted-foreground italic">—</span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {j.reference ?? "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge status={j.status} />
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  {j.entry_count}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {formatDateTime(j.posted_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
