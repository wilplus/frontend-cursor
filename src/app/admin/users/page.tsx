"use client";

import Link from "next/link";
import { ArrowLeft, Search, UserRound, WalletCards } from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import AdminGate from "@/components/admin/AdminGate";

interface AdminUser {
  user_id: string;
  email: string | null;
  name: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  is_admin: boolean;
}

interface UsersResponse {
  users?: AdminUser[];
  offset?: number;
  has_more?: boolean;
  error?: string;
}

const PAGE_SIZE = 50;

function formatDate(value: string | null, empty: string): string {
  if (!value) return empty;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

async function readJson(response: Response): Promise<UsersResponse> {
  try {
    return (await response.json()) as UsersResponse;
  } catch {
    return {};
  }
}

export default function AdminUsersPage() {
  return (
    <AdminGate>
      <UserDirectory />
    </AdminGate>
  );
}

function UserDirectory() {
  const [query, setQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (search: string, offset: number, append: boolean) => {
      setBusy(true);
      setError(null);
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (search) params.set("search", search);

      try {
        const response = await fetch(`/api/v2/admin/users?${params}`, {
          cache: "no-store",
        });
        const body = await readJson(response);
        if (!response.ok) {
          setError(body.error ?? `Could not load users (${response.status}).`);
          if (!append) setUsers([]);
          return;
        }
        const incoming = Array.isArray(body.users) ? body.users : [];
        setUsers((current) => (append ? [...current, ...incoming] : incoming));
        setNextOffset(offset + incoming.length);
        setHasMore(Boolean(body.has_more) && incoming.length > 0);
      } catch {
        setError("Could not reach the server.");
        if (!append) setUsers([]);
      } finally {
        setBusy(false);
      }
    },
    []
  );

  useEffect(() => {
    void load("", 0, false);
  }, [load]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const target = query.trim();
    setActiveSearch(target);
    void load(target, 0, false);
  };

  const clearSearch = () => {
    setQuery("");
    setActiveSearch("");
    void load("", 0, false);
  };

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <Link
        href="/admin/ceo"
        className="inline-flex items-center gap-1.5 text-sm text-foreground/60 hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to CEO
      </Link>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Review registered accounts and open token top-up with the email
            already selected.
          </p>
        </div>
        <p className="text-xs text-foreground/50">
          {users.length.toLocaleString()} shown
          {activeSearch ? ` for “${activeSearch}”` : ""}
        </p>
      </div>

      <form onSubmit={submitSearch} className="mt-6 flex gap-2">
        <label htmlFor="admin-user-search" className="sr-only">
          Search users
        </label>
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40"
            aria-hidden
          />
          <input
            id="admin-user-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by email, name, or user ID"
            className="w-full rounded-xl border border-foreground/15 bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:border-foreground/40"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:opacity-40"
        >
          Search
        </button>
        {activeSearch ? (
          <button
            type="button"
            onClick={clearSearch}
            disabled={busy}
            className="rounded-xl border border-foreground/15 px-4 py-2.5 text-sm font-medium disabled:opacity-40"
          >
            Clear
          </button>
        ) : null}
      </form>

      {error ? (
        <p className="mt-4 rounded-xl bg-destructive/[0.12] px-4 py-3 text-sm">
          {error}
        </p>
      ) : null}

      <section className="mt-5 overflow-hidden rounded-2xl border border-foreground/12">
        {users.length ? (
          <div className="divide-y divide-foreground/10">
            {users.map((user) => (
              <article
                key={user.user_id}
                className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="flex min-w-0 gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06]">
                    <UserRound className="h-4 w-4" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-medium">
                        {user.name || user.email || "Unnamed account"}
                      </h2>
                      {user.is_admin ? (
                        <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-medium text-background">
                          Admin
                        </span>
                      ) : null}
                      {!user.email_confirmed_at ? (
                        <span className="rounded-full border border-foreground/15 px-2 py-0.5 text-[10px] text-foreground/55">
                          Email unconfirmed
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-foreground/60">
                      {user.email || "No email available"}
                    </p>
                    <p className="mt-1 truncate font-mono text-[10px] text-foreground/35">
                      {user.user_id}
                    </p>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:block sm:space-y-1">
                  <div className="contents sm:flex sm:justify-between sm:gap-3">
                    <dt className="text-foreground/45">Joined</dt>
                    <dd>{formatDate(user.created_at, "—")}</dd>
                  </div>
                  <div className="contents sm:flex sm:justify-between sm:gap-3">
                    <dt className="text-foreground/45">Last sign-in</dt>
                    <dd>{formatDate(user.last_sign_in_at, "Never")}</dd>
                  </div>
                </dl>

                {user.email ? (
                  <Link
                    href={`/admin/tokens?email=${encodeURIComponent(user.email)}`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-foreground/15 px-3 py-2 text-sm font-medium transition-colors hover:bg-foreground/[0.05]"
                  >
                    <WalletCards className="h-4 w-4" aria-hidden />
                    Top up tokens
                  </Link>
                ) : (
                  <span className="text-center text-xs text-foreground/40">
                    Email required for top-up
                  </span>
                )}
              </article>
            ))}
          </div>
        ) : busy ? (
          <p className="p-8 text-center text-sm text-foreground/50">
            Loading users…
          </p>
        ) : (
          <p className="p-8 text-center text-sm text-foreground/50">
            No users found.
          </p>
        )}
      </section>

      {hasMore ? (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => void load(activeSearch, nextOffset, true)}
            disabled={busy}
            className="rounded-xl border border-foreground/15 px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            {busy ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
    </main>
  );
}
