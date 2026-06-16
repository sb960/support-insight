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
  const [editTarget, setEditTarget] = useState<
    { id: string; title: string; content: string; tags: string[] } | null
  >(null);

  const [sops, setSops] = useState<SOP[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchSops() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("http://localhost:8000/api/sops");
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
      const res = await fetch(
        `http://localhost:8000/api/sops/${deleteTarget.id}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        }
      );
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

  const openEdit = (sop: SOP) => {
    setEditTarget({
      id: sop.id,
      title: sop.title,
      content: sop.content,
      tags: sop.tags,
    });
  };

  const closeEdit = () => setEditTarget(null);

  const handleUpdated = async () => {
    if (!editTarget) return;
    setDeleting(true);
    try {
      // Adjust path if your backend uses a different update route
      const res = await fetch(
        `http://localhost:8000/api/sops/${editTarget.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editTarget),
        }
      );
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Update failed (${res.status}) ${txt}`);
      }
      await fetchSops();
      closeEdit();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
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
              <TableCell colSpan={3}>
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

