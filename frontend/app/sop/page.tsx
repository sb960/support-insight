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

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Standard Operating Procedures</h1>

      <SopHeader
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onCreate={() => setShowCreate(true)}
      />

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
    </div>
  );
}

