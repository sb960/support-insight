import * as React from "react";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  title?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function SopDeleteConfirm({ open, title, onCancel, onConfirm }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative z-10 bg-white dark:bg-slate-900 rounded-lg p-6 w-full max-w-md shadow-lg">
        <h3 className="text-lg font-semibold mb-2">Confirm delete</h3>
        <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">
          This action cannot be undone. Are you sure you want to permanently delete{" "}
          <strong>{title ?? "this SOP"}</strong>?
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete (cannot undo)
          </Button>
        </div>
      </div>
    </div>
  );
}