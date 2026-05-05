"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { adminApi, type StudentListItem } from "@/lib/api/admin-client";

/**
 * Admin User Directory (View 1).
 *
 * Lists all students with search-by-name/email. Each row links to
 * /admin/users/[userId] — the unified single-user dashboard.
 *
 * Backend: GET /v2/admin/students (already wired via adminApi.listStudents).
 * Status column derives from sessions_count + last_session_at; the spec's
 * "Pending Review / Completed / In Progress" map is approximated until the
 * backend exposes a per-user review-state field.
 */

type DerivedStatus = "Pending Review" | "Completed" | "In Progress";

function deriveStatus(row: StudentListItem): DerivedStatus {
  if ((row.sessions_count ?? 0) === 0) return "In Progress";
  if (row.last_session_at) return "Pending Review";
  return "Completed";
}

function badgeVariantForStatus(status: DerivedStatus): "default" | "success" | "muted" {
  if (status === "Pending Review") return "default";
  if (status === "Completed") return "success";
  return "muted";
}

function formatLastActive(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function displayName(row: StudentListItem): string {
  return (
    (row.name && row.name.trim()) ||
    (row.email && row.email.trim()) ||
    (row.user_email && row.user_email.trim()) ||
    row.user_id
  );
}

function displayEmail(row: StudentListItem): string {
  return (row.email && row.email.trim()) || (row.user_email && row.user_email.trim()) || "—";
}

export default function AdminUsersDirectory() {
  const [rows, setRows] = useState<StudentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminApi
      .getStudents({ limit: 200, offset: 0 })
      .then((res) => {
        if (cancelled) return;
        setRows(res.students ?? []);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load users.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = displayName(r).toLowerCase();
      const email = displayEmail(r).toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [rows, query]);

  return (
    <div className="min-h-screen bg-orange-50/40">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <span className="text-sm font-bold">W</span>
            </div>
            <span className="text-base font-semibold tracking-tight">Willab Admin</span>
          </div>
          <div className="relative w-full max-w-sm">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              placeholder="Search by name or email"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              aria-label="Search users"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">User Directory</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading…" : `${filtered.length} users`}
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Last Active</th>
                <th className="px-4 py-3 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                    Loading users…
                  </td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                    {query ? "No users match your search." : "No users yet."}
                  </td>
                </tr>
              )}

              {!loading &&
                filtered.map((row) => {
                  const name = displayName(row);
                  const email = displayEmail(row);
                  const status = deriveStatus(row);
                  return (
                    <tr
                      key={row.user_id}
                      className="border-b border-border last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/users/${row.user_id}`}
                          className="flex items-center gap-3 font-medium text-foreground hover:underline"
                        >
                          <Avatar name={name} sizePx={36} />
                          <span className="truncate">{name}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <span className="truncate">{email}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatLastActive(row.last_session_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Badge variant={badgeVariantForStatus(status)}>{status}</Badge>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
