import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

/** Mutation helper: toast on success/failure and refresh the listed query keys. */
export function useAction<TIn, TOut = unknown>(fn: (opts: { data: TIn }) => Promise<TOut>, success: string, invalidate: string[] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TIn) => fn({ data: input }),
    onSuccess: async () => {
      toast.success(success);
      await Promise.all(invalidate.map((k) => qc.invalidateQueries({ queryKey: [k] })));
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}

export function Section({ title, hint, children, action }: { title: string; hint?: string | undefined; children: ReactNode; action?: ReactNode }) {
  return (
    <Card className="rounded-none">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string | undefined; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

/** Splits a textarea into trimmed, non-empty lines. */
export const lines = (v: string) => v.split("\n").map((x) => x.trim()).filter(Boolean);

/** "2026-10-07T09:00" for <input type=datetime-local> from an ISO string (local time). */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
