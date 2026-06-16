import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { sopFormSchema, SopFormInput } from "@/lib/schemas/sop";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface Props {
  initial: { id: string; title: string; content: string; tags: string[] };
  onClose: () => void;
  onSaved: () => void;
}

export function SopEditForm({ initial, onClose, onSaved }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    getValues,
    setValue,
  } = useForm<SopFormInput>({
    resolver: zodResolver(sopFormSchema),
    defaultValues: {
      title: initial.title,
      content: initial.content,
      // present tags as comma string for the input
      tags: (initial.tags || []).join(", "),
    } as any,
  });

  const suggestedTags = ["billing", "technical", "refund", "account"];

  const toggleSuggestedTag = (tag: string) => {
    const current = (getValues() as any).tags || "";
    const parts = String(current).split(",").map((p) => p.trim()).filter(Boolean);
    const next = parts.includes(tag) ? parts.filter((p) => p !== tag) : [...parts, tag];
    setValue("tags", next.join(", "), { shouldDirty: true, shouldValidate: true });
  };

  const onSubmit = async (data: SopFormInput) => {
    try {
      // normalize input and validate -> parsed.tags will be string[]
      const parsed = sopFormSchema.parse({
        title: data.title,
        content: data.content,
        tags: (data as any).tags,
      });

      const payload = {
        title: parsed.title,
        content: parsed.content,
        tags: parsed.tags,
      };

      const res = await fetch(`http://localhost:8000/api/sops/${initial.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Update failed (${res.status})`);

      onSaved();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : JSON.stringify(err, null, 2));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="relative z-10 bg-white dark:bg-slate-900 rounded-lg p-6 w-full max-w-lg shadow-lg"
      >
        <h2 className="text-lg font-semibold mb-4">Edit SOP</h2>

        <div className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Title</label>
            <Input {...register("title")} />
            {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title.message}</p>}
          </div>

          <div>
            <label className="block text-sm mb-1">Tags</label>
            <Input {...register("tags" as any)} placeholder="e.g. billing, technical" />
            {errors.tags && <p className="text-xs text-red-600 mt-1">{errors.tags.message}</p>}

            <div className="mt-2 flex flex-wrap gap-2">
              {suggestedTags.map((t) => {
                const current = (getValues() as any).tags || "";
                const parts = String(current).split(",").map((p) => p.trim()).filter(Boolean);
                const active = parts.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleSuggestedTag(t)}
                    className={`rounded-full px-2 py-0.5 text-sm ${
                      active ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-800"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1">Content</label>
            <Textarea {...register("content")} rows={6} />
            {errors.content && <p className="text-xs text-red-600 mt-1">{errors.content.message}</p>}
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}