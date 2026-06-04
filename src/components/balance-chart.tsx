"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { fetchBalanceHistory } from "@/lib/api";
import { formatMinorUnits, fromSixMonthsAgo, todayStr } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  accountId: string;
  currency: string;
  granularity?: "DAILY" | "WEEKLY" | "MONTHLY";
}

export function BalanceChart({ accountId, currency, granularity = "MONTHLY" }: Props) {
  const from = fromSixMonthsAgo();
  const to = todayStr();

  const { data, isLoading, error } = useQuery({
    queryKey: ["balance-history", accountId, granularity, from, to],
    queryFn: () => fetchBalanceHistory(accountId, { from, to, granularity }),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (error || !data) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
        Failed to load chart data
      </div>
    );
  }
  if (data.series.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
        No data for this period
      </div>
    );
  }

  const tickFormatter = (v: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: "compact",
    }).format(v / 100);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data.series} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(d: string) =>
            new Date(d + "T00:00:00Z").toLocaleDateString("en-US", {
              month: "short",
              year: "2-digit",
            })
          }
        />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={tickFormatter}
          width={72}
        />
        <Tooltip
          formatter={(value: number) => [
            formatMinorUnits(value, currency),
            "Balance",
          ]}
          labelFormatter={(label: string) =>
            new Date(label + "T00:00:00Z").toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })
          }
          contentStyle={{
            borderRadius: "8px",
            fontSize: "12px",
          }}
        />
        <Area
          type="monotone"
          dataKey="balance_minor_units"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          fill="url(#balanceGrad)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
