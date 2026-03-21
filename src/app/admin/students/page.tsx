"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { adminApi, type StudentListItem } from "@/lib/api/admin-client";
import { ChevronRight, Search, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [studentPendingDelete, setStudentPendingDelete] = useState<StudentListItem | null>(null);
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .getStudents({ limit: 50, offset: 0 })
      .then((res) => setStudents(res.students))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.trim().toLowerCase();
    return students.filter((s) => {
      const email = (s.email ?? s.user_email ?? "").toLowerCase();
      const name = (s.name ?? "").toLowerCase();
      return email.includes(q) || name.includes(q) || s.user_id.toLowerCase().includes(q);
    });
  }, [students, searchQuery]);

  if (loading) return <p className="text-muted-foreground">Loading students…</p>;
  if (error) return <p className="text-destructive">Error: {error}</p>;

  const handleConfirmDelete = async () => {
    if (!studentPendingDelete) return;
    const targetId = studentPendingDelete.user_id;
    setDeletingStudentId(targetId);
    try {
      await adminApi.deleteStudent(targetId);
      setStudents((prev) => prev.filter((s) => s.user_id !== targetId));
      setStudentPendingDelete(null);
      toast.success("Student deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete student");
    } finally {
      setDeletingStudentId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Students</h1>
          <p className="text-muted-foreground mt-1">Manage your students and view their progress</p>
        </div>
        <Link href="/admin/ml">
          <Button variant="outline" className="rounded-xl">
            <Upload className="mr-2 h-4 w-4" />
            ML
          </Button>
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <ul className="space-y-2">
        {filtered.length === 0 ? (
          <li className="text-sm text-muted-foreground">
            {searchQuery.trim() ? "No students match your search." : "No students yet."}
          </li>
        ) : (
          filtered.map((s) => {
            const email = (s.email ?? s.user_email ?? "").trim() || null;
            const displayName = (s.name ?? "").trim();
            const displayLabel = displayName || email || `No email (${s.user_id})`;
            const sessionsCount = s.sessions_count ?? 0;
            const avgPerf = s.avg_performance != null ? Math.round(s.avg_performance) : null;
            const lastActive = s.last_session_at
              ? new Date(s.last_session_at).toLocaleDateString()
              : null;
            const priceLabel =
              s.price_per_live_lesson != null && Number.isFinite(Number(s.price_per_live_lesson))
                ? `$${Number(s.price_per_live_lesson).toFixed(2)} / lesson`
                : null;
            return (
              <li key={s.user_id}>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/students/${s.user_id}`}
                    className="flex min-w-0 flex-1 items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{displayLabel}</p>
                      {email && displayName ? (
                        <p className="text-sm text-muted-foreground truncate">{email}</p>
                      ) : null}
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
                        {priceLabel && <span>{priceLabel}</span>}
                        {sessionsCount > 0 && (
                          <span>{sessionsCount} session{sessionsCount !== 1 ? "s" : ""}</span>
                        )}
                        {avgPerf != null && <span>Avg: {avgPerf}%</span>}
                        {lastActive && <span>Last active: {lastActive}</span>}
                        {sessionsCount === 0 && avgPerf == null && !lastActive && (
                          <span>No sessions yet</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                  <button
                    type="button"
                    aria-label={`Delete ${displayLabel}`}
                    onClick={() => setStudentPendingDelete(s)}
                    className="rounded-md border border-border bg-card p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })
        )}
      </ul>

      {studentPendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-foreground">Are you sure?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This will permanently remove{" "}
              <span className="font-medium text-foreground">
                {(studentPendingDelete.name ?? studentPendingDelete.email ?? studentPendingDelete.user_id).trim()}
              </span>{" "}
              from the students list.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setStudentPendingDelete(null)}
                disabled={deletingStudentId === studentPendingDelete.user_id}
                className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingStudentId === studentPendingDelete.user_id}
                className="rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-50"
              >
                {deletingStudentId === studentPendingDelete.user_id ? "Deleting…" : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
