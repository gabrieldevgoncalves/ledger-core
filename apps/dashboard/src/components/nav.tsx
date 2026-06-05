"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/accounts", label: "Accounts" },
  { href: "/journals", label: "Journals" },
  { href: "/reconciliation", label: "Reconciliation" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="border-b bg-background">
      <div className="mx-auto max-w-7xl px-6 h-14 flex items-center gap-8">
        <span className="font-semibold text-sm tracking-tight">
          Ledger Core
        </span>
        <nav className="flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-muted",
                pathname.startsWith(link.href)
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
