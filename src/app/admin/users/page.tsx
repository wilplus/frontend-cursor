"use client";

import Link from "next/link";
import { Search, UserRound, WalletCards } from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import AdminGate from "@/components/admin/AdminGate";
import SignupCounts from "@/components/admin/SignupCounts";
import {
  cancelDeletion,
  ConfirmDelete,
  type DeleteResult,
  deleteAccounts,
  DeletedToast,
  RowMenu,
  SelectionBar,
} from "./DeleteUsers";

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
  next_offset?: number;
  has_more?: boolean;
  error?: string;
}

interface Toast {
  at: number;
  completesAfter: string | null;
  undo: { userId: string; requestId: string }[];
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

function toastFor(done: DeleteResult[]): Toast {
  const undo = done.flatMap(({ userId, deletion }) =>
    deletion?.request_id && deletion.cancellable ? [{ userId, requestId: deletion.request_id }] : []
  );
  const completesAfter = done.find((d) => d.deletion?.completes_after)?.deletion?.completes_after ?? null;
  return { at: Date.now(), completesAfter, undo };
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
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [confirmIds, setConfirmIds] = useState<string[] | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

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
        setNextOffset(body.next_offset ?? offset + incoming.length);
        setHasMore(Boolean(body.has_more));
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
    void load(activeSearch, 0, false);
  }, [load, activeSearch]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const target = query.trim();
    if (target === activeSearch) void load(target, 0, false);
    else setActiveSearch(target);
  };

  const clearSearch = () => {
    setQuery("");
    setActiveSearch("");
  };

  const selectable = users.filter((user) => !user.is_admin);

  const togglePick = (id: string) =>
    setPicked((current) => (current?.includes(id) ? current.filter((p) => p !== id) : [...(current ?? []), id]));

  const confirmDelete = async () => {
    if (!confirmIds) return;
    setBusy(true);
    const { done, failed } = await deleteAccounts(confirmIds);
    setBusy(false);
    setConfirmIds(null);
    setPicked(null);
    const gone = new Set(done.map((d) => d.userId));
    setUsers((current) => current.filter((user) => !gone.has(user.user_id)));
    setError(failed.length ? "Could not do that. Try again." : null);
    if (done.length) setToast(toastFor(done));
  };

  const undo = async () => {
    const pending = toast?.undo ?? [];
    setToast(null);
    const results = await Promise.all(pending.map((p) => cancelDeletion(p.userId, p.requestId)));
    if (results.some((ok) => !ok)) setError("Could not do that. Try again.");
    void load(activeSearch, 0, false);
  };

  const closeToast = useCallback(() => setToast(null), []);
  const emailOf = (id: string) => {
    const user = users.find((u) => u.user_id === id);
    return user?.email || user?.name || id;
  };

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-foreground/60">
          Review registered accounts. Open a profile to add tokens.
        </p>
      </div>

      <SignupCounts />

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

      {picked ? (
        <div className="mt-5 flex min-h-11 flex-wrap items-center gap-2">
          <SelectionBar
            count={picked.length}
            busy={busy}
            onSelectAll={() => setPicked(selectable.map((user) => user.user_id))}
            onCancel={() => setPicked(null)}
            onDelete={() => setConfirmIds(picked)}
          />
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-xl bg-destructive/[0.12] px-4 py-3 text-sm">
          {error}
        </p>
      ) : null}

      <section className={`${picked ? "mt-3" : "mt-5"} rounded-2xl border border-foreground/12`}>
        {users.length ? (
          <div className="divide-y divide-foreground/10">
            {users.map((user) => (
              <UserRow
                key={user.user_id}
                user={user}
                menuOpen={menuFor === user.user_id}
                picked={picked ? picked.includes(user.user_id) : null}
                onToggleMenu={() => setMenuFor((open) => (open === user.user_id ? null : user.user_id))}
                onStartSelect={() => {
                  setMenuFor(null);
                  setPicked([user.user_id]);
                }}
                onAskDelete={() => {
                  setMenuFor(null);
                  setConfirmIds([user.user_id]);
                }}
                onTogglePick={() => togglePick(user.user_id)}
              />
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

      {confirmIds ? (
        <ConfirmDelete
          emails={confirmIds.map(emailOf)}
          busy={busy}
          onCancel={() => setConfirmIds(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}

      {toast ? (
        <DeletedToast
          key={toast.at}
          completesAfter={toast.completesAfter}
          canUndo={toast.undo.length > 0}
          onUndo={() => void undo()}
          onClose={closeToast}
        />
      ) : null}
    </main>
  );
}

function UserRow({
  user,
  menuOpen,
  picked,
  onToggleMenu,
  onStartSelect,
  onAskDelete,
  onTogglePick,
}: {
  user: AdminUser;
  menuOpen: boolean;
  /** null while not choosing several people. */
  picked: boolean | null;
  onToggleMenu: () => void;
  onStartSelect: () => void;
  onAskDelete: () => void;
  onTogglePick: () => void;
}) {
  const label = user.name || user.email || "Unnamed account";
  const canDelete = !user.is_admin;

  return (
    <article
      className={`grid grid-cols-[32px_minmax(0,1fr)] gap-4 p-4 first:rounded-t-2xl last:rounded-b-2xl sm:grid-cols-[32px_minmax(0,1.6fr)_minmax(0,1fr)_auto] sm:items-center ${picked ? "bg-foreground/[0.035]" : ""}`}
    >
      <div className="h-8 w-8">
        {canDelete && picked !== null ? (
          <input
            type="checkbox"
            checked={picked}
            onChange={onTogglePick}
            aria-label={`Select ${label}`}
            className="m-[7px] h-[18px] w-[18px] cursor-pointer accent-foreground"
          />
        ) : canDelete ? (
          <RowMenu label={label} open={menuOpen} onToggle={onToggleMenu} onSelect={onStartSelect} onDelete={onAskDelete} />
        ) : null}
      </div>

      <div className="flex min-w-0 gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06]">
          <UserRound className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-sm font-medium">{label}</h2>
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

      <dl className="col-start-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:col-start-auto sm:block sm:space-y-1">
        <div className="contents sm:flex sm:justify-between sm:gap-3">
          <dt className="text-foreground/45">Joined</dt>
          <dd>{formatDate(user.created_at, "—")}</dd>
        </div>
        <div className="contents sm:flex sm:justify-between sm:gap-3">
          <dt className="text-foreground/45">Last sign-in</dt>
          <dd>{formatDate(user.last_sign_in_at, "Never")}</dd>
        </div>
      </dl>

      <div className="col-start-2 flex flex-wrap gap-2 sm:col-start-auto">
        <Link
          href={`/admin/users/${encodeURIComponent(user.user_id)}`}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-foreground/15 px-3 py-2 text-sm font-medium transition-colors hover:bg-foreground/[0.05]"
        >
          <WalletCards className="h-4 w-4" aria-hidden />
          Open profile
        </Link>
      </div>
    </article>
  );
}
