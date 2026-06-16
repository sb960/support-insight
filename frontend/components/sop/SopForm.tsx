import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { sopFormSchema, SopFormInput } from "@/lib/schemas/sop";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export function SopForm({ onClose, onCreated }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    getValues,
    setValue,
  } = useForm<SopFormInput>({
    resolver: zodResolver(sopFormSchema),
    defaultValues: { tags: "" as any }, // keep input as string initially
  });

  const suggestedTags = ["billing", "technical", "refund", "account"];

  // Toggle tag: add if missing, remove if present. Always update the input string.
  const toggleSuggestedTag = (tag: string) => {
    const current = (getValues() as any).tags || "";
    const parts = String(current)
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    const has = parts.includes(tag);
    const next = has ? parts.filter((p) => p !== tag) : [...parts, tag];
    setValue("tags", next.join(", "), { shouldDirty: true, shouldValidate: true });
  };

  const onSubmit = async (data: SopFormInput) => {
    try {
      // Ensure tags are coerced into a string when user typed an array-like value
      const normalizedInput = {
        title: data.title,
        content: data.content,
        // data.tags may be string or array depending on UI; schema handles both
        tags: (data as any).tags,
      };

      // Validate / transform -> parsed.tags will be string[]
      const parsed = sopFormSchema.parse(normalizedInput);

      // Send tags as an array (backend expects array)
      const payload = {
        title: parsed.title,
        content: parsed.content,
        tags: parsed.tags,
      };

      const res = await fetch("http://localhost:8000/api/sops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Create failed (${res.status})`);

      reset();
      onCreated();
      onClose();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : JSON.stringify(err, null, 2));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="relative z-10 bg-white dark:bg-slate-900 rounded-lg p-6 w-full max-w-lg shadow-lg"
      >
        <h2 className="text-lg font-semibold mb-4">Create SOP</h2>

        <div className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Title</label>
            <Input {...register("title")} />
            {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title.message}</p>}
          </div>

          <div>
            <label className="block text-sm mb-1">Tags (comma separated)</label>
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
            <p className="text-xs text-muted-foreground mt-2">
              Click a suggestion to add; click again to remove. Or type tags separated by commas.
            </p>
          </div>

          <div>
            <label className="block text-sm mb-1">Content</label>
            <Textarea {...register("content")} rows={6} />
            {errors.content && <p className="text-xs text-red-600 mt-1">{errors.content.message}</p>}
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Create"}
          </Button>
        </div>
      </form>
    </div>
  );
}