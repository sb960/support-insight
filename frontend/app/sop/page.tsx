'use client';

import React, { useEffect, useState } from "react";
import { SopHeader } from "@/components/sop/SopHeader";
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SopForm } from "@/components/sop/SopForm";
import { SopDeleteConfirm } from "@/components/sop/SopDeleteConfirm";
import { SopEditForm } from "@/components/sop/SopEditForm";

interface SOP {
    id: string;
    title: string;
    content: string;
    tags: string[];
    created_at?: string;
    updated_at?: string;
}

/**
 * Live fetching + filtering
 * - Fetches SOPs from your backend on mount
 * - Filters the list using `searchTerm` from `SopHeader`
 */
export default function SopsPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [showCreate, setShowCreate] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<
        { id: string; title: string } | null
    >(null);
    const [deleting, setDeleting] = useState(false);
    const [editTarget, setEditTarget] = useState<SOP | null>(null);

    const [sops, setSops] = useState<SOP[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function fetchSops() {
      setLoading(true);
      setError(null);
      try {
          const res = await fetch("/api/sops");
          if (!res.ok) throw new Error(`Server responded ${res.status}`);
          const data: SOP[] = await res.json();
          setSops(data);
      } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
      } finally {
          setLoading(false);
      }
    }

    // Fetch on mount
    useEffect(() => {
        fetchSops();
    }, []);

    // Simple client-side filter by title or tag
    const filteredSops = sops.filter((s) => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return true;
        return (
            s.title.toLowerCase().includes(q) ||
            s.tags.some((t) => t.toLowerCase().includes(q))
        );
    });

    const openDelete = (id: string, title: string) => {
        setDeleteTarget({ id, title });
    };

    const closeDelete = () => setDeleteTarget(null);

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            // Adjust path if your backend uses a different delete route
            const res = await fetch(`/api/sops/${deleteTarget.id}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const txt = await res.text();
                throw new Error(`Delete failed (${res.status}) ${txt}`);
            }
            await fetchSops();
            closeDelete();
        } catch (err) {
            console.error(err);
            alert(err instanceof Error ? err.message : String(err));
        } finally {
            setDeleting(false);
        }
    };

    const openEdit = (sop: SOP) => setEditTarget(sop);
    const closeEdit = () => setEditTarget(null);
    const handleUpdated = async () => {
        await fetchSops();
        closeEdit();
    };

    function fmt(dt?: string) {
        if (!dt) return "—";

        const hasTZ = /([zZ]|[+\-]\d{2}:\d{2})$/.test(dt);
        const iso = hasTZ ? dt : `${dt.endsWith('Z') ? dt : dt + 'Z'}`;
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return "—";

        // Format using the user's locale (local time)
        return d.toLocaleString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

  return (
      // set 7xl to none for full width
      <div className="p-8 w-full max-w-7xl mx-auto space-y-6">
          <h1 className="text-3xl font-bold">Standard Operating Procedures</h1>

          <SopHeader
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              onCreate={() => setShowCreate(true)}
          />

          {showCreate && (
              <SopForm
                onClose={() => setShowCreate(false)}
                onCreated={() => {
                    fetchSops();
                    setShowCreate(false);
                }}
              />
          )}

        {loading && <p className="text-sm text-slate-500">Loading SOPs…</p>}
        {error && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                Error: {error}
            </div>
        )}

        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Content</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last modified</TableHead>
                    <TableHead>Actions</TableHead>
                </TableRow>
            </TableHeader>

          <TableBody>
            {filteredSops.map((sop) => (
              <TableRow key={sop.id}>
                <TableCell className="max-w-sm truncate">{sop.title}</TableCell>
                <TableCell className="max-w-xl truncate">{sop.content}</TableCell>
                <TableCell>
                    <div className="flex flex-wrap gap-2">
                        {sop.tags.map((tag) => (
                            <Badge key={tag}>{tag}</Badge>
                        ))}
                    </div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">{fmt(sop.created_at)}</TableCell>
                <TableCell className="whitespace-nowrap text-sm">{fmt(sop.updated_at)}</TableCell>
                <TableCell className="w-36">
                  <div className="flex gap-2">
                      <button
                          type="button"
                          onClick={() => openEdit(sop)}
                          className="text-sm text-blue-600 hover:underline"
                      >
                          Edit
                      </button>

                    <button
                      type="button"
                      onClick={() => openDelete(sop.id, sop.title)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredSops.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={6}>
                  <p className="text-sm text-slate-500">No SOPs found.</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {deleteTarget && (
          <SopDeleteConfirm
            open={!!deleteTarget}
            title={deleteTarget?.title}
            onCancel={closeDelete}
            onConfirm={confirmDelete}
          />
        )}

        {editTarget && (
          <SopEditForm
            initial={editTarget}
            onClose={closeEdit}
            onSaved={handleUpdated}
          />
        )}
      </div>
    );
  }

