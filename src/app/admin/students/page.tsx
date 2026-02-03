"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { adminApi, type StudentListItem } from "@/lib/api/admin-client";
import { ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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
      return email.includes(q) || s.user_id.toLowerCase().includes(q);
    });
  }, [students, searchQuery]);

  if (loading) return <p className="text-muted-foreground">Loading students…</p>;
  if (error) return <p className="text-destructive">Error: {error}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Students</h1>
        <p className="text-muted-foreground mt-1">Manage your students and view their progress</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by email..."
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
            const displayLabel = email ?? `No email (${s.user_id})`;
            const sessionsCount = s.sessions_count ?? 0;
            const avgPerf = s.avg_performance != null ? Math.round(s.avg_performance) : null;
            const lastActive = s.last_session_at
              ? new Date(s.last_session_at).toLocaleDateString()
              : null;
            return (
              <li key={s.user_id}>
                <Link
                  href={`/admin/students/${s.user_id}`}
                  className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">{displayLabel}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
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
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
