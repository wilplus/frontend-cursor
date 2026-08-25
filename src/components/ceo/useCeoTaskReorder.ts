"use client";

import { useRef, useState } from "react";

interface DragState {
  from: number;
  to: number;
  pointerId: number;
}

export function useCeoTaskReorder(
  count: number,
  onMove: (from: number, to: number) => void
) {
  const rows = useRef<(HTMLElement | null)[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;

  function targetAt(clientY: number, fallback: number): number {
    let target = fallback;
    rows.current.slice(0, count).forEach((row, index) => {
      const rect = row?.getBoundingClientRect();
      if (rect && clientY > rect.top + rect.height / 2) target = index;
    });
    return Math.max(0, Math.min(count - 1, target));
  }

  function finish(pointerId: number, commit: boolean) {
    const current = dragRef.current;
    if (!current || current.pointerId !== pointerId) return;
    if (commit && current.from !== current.to) onMove(current.from, current.to);
    setDrag(null);
  }

  return {
    rowProps(index: number) {
      return {
        ref: (element: HTMLElement | null) => {
          rows.current[index] = element;
        },
        className:
          drag?.to === index && drag.from !== index
            ? "border-foreground/40"
            : undefined,
      };
    },
    handleProps(index: number) {
      return {
        "data-drag-handle": true,
        style: { touchAction: "none" as const },
        onPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
          if (count < 2 || (event.button !== undefined && event.button !== 0)) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          setDrag({ from: index, to: index, pointerId: event.pointerId });
        },
        onPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
          const current = dragRef.current;
          if (!current || current.pointerId !== event.pointerId) return;
          const to = targetAt(event.clientY, current.to);
          if (to !== current.to) setDrag({ ...current, to });
        },
        onPointerUp(event: React.PointerEvent<HTMLButtonElement>) {
          finish(event.pointerId, true);
        },
        onPointerCancel(event: React.PointerEvent<HTMLButtonElement>) {
          finish(event.pointerId, false);
        },
        onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
          if (event.key === "ArrowUp" && index > 0) {
            event.preventDefault();
            onMove(index, index - 1);
          } else if (event.key === "ArrowDown" && index < count - 1) {
            event.preventDefault();
            onMove(index, index + 1);
          }
        },
      };
    },
    draggingIndex: drag?.from ?? null,
  };
}
