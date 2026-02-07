"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PoolItem {
  id: string;
  label: string;
}

interface SelectFromPoolModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  pool: PoolItem[];
  selectedIds: string[];
  onConfirm: (selectedIds: string[]) => void;
  allowCreate?: boolean;
  /** Create new item; return the new PoolItem to show in list and add to selection. */
  onCreateNew?: (text: string) => Promise<PoolItem | void>;
  maxSelection?: number;
  /** When true and pool is empty, show "Loading..." instead of "No items in pool yet". */
  poolLoading?: boolean;
}

export default function SelectFromPoolModal({
  open,
  onOpenChange,
  title,
  pool,
  selectedIds,
  onConfirm,
  allowCreate = false,
  onCreateNew,
  maxSelection,
  poolLoading = false,
}: SelectFromPoolModalProps) {
  const [search, setSearch] = useState("");
  const [newItemText, setNewItemText] = useState("");
  const [creating, setCreating] = useState(false);
  const [localSelected, setLocalSelected] = useState<Set<string>>(() => new Set(selectedIds));
  const [localAppends, setLocalAppends] = useState<PoolItem[]>([]);

  useEffect(() => {
    if (open) {
      setLocalSelected(new Set(selectedIds));
      setLocalAppends([]);
    }
  }, [open, selectedIds]);

  const displayPool = useMemo(() => [...pool, ...localAppends], [pool, localAppends]);

  const filtered = useMemo(() => {
    if (!search.trim()) return displayPool;
    const q = search.trim().toLowerCase();
    return displayPool.filter((i) => i.label.toLowerCase().includes(q));
  }, [displayPool, search]);

  const toggle = (id: string) => {
    setLocalSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (maxSelection == null || next.size < maxSelection) next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm(Array.from(localSelected));
    onOpenChange(false);
    setSearch("");
    setNewItemText("");
  };

  const handleCancel = () => {
    setLocalSelected(new Set(selectedIds));
    setSearch("");
    setNewItemText("");
    onOpenChange(false);
  };

  const handleCreate = async () => {
    if (!newItemText.trim() || !onCreateNew) return;
    setCreating(true);
    try {
      const added = await onCreateNew(newItemText.trim());
      if (added) {
        setLocalAppends((prev) => [...prev, added]);
        setLocalSelected((prev) => new Set([...prev, added.id]));
      }
      setNewItemText("");
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  const selectedCount = localSelected.size;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="select-from-pool-title"
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 id="select-from-pool-title" className="text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="max-h-[280px] overflow-y-auto space-y-1 rounded-md border border-border bg-muted/30 p-2">
            {filtered.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {search.trim() ? "No items match your search." : poolLoading ? "Loading…" : "No items in pool yet."}
              </p>
            ) : (
              filtered.map((item) => {
                const isSelected = localSelected.has(item.id);
                return (
                  <label
                    key={item.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      "hover:bg-muted/50",
                      isSelected && "bg-primary/10"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-primary/50 bg-background"
                      )}
                    >
                      {isSelected && (
                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 12 12">
                          <path d="M10 3L4.5 8.5 2 6" stroke="currentColor" strokeWidth="2" fill="none" />
                        </svg>
                      )}
                    </span>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(item.id)}
                      className="sr-only"
                    />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  </label>
                );
              })
            )}
          </div>

          {allowCreate && onCreateNew && (
            <div className="flex gap-2">
              <Input
                placeholder="Enter new item..."
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="flex-1"
              />
              <Button type="button" onClick={handleCreate} disabled={creating || !newItemText.trim()}>
                Add
              </Button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border p-4">
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm}>
            Confirm Selection ({selectedCount})
          </Button>
        </div>
      </div>
    </div>
  );
}
