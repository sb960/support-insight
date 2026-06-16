import { z } from "zod";

export const sopFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters long"),
  content: z.string().min(10, "Content must be at least 10 characters long"),
  tags: z
    .union([z.string(), z.array(z.string())])
    .transform((val) => {
      if (Array.isArray(val)) {
        return val.map((t) => t.trim()).filter(Boolean);
      }
      return val
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }),
});
export type SopForm = z.infer<typeof sopFormSchema>;

// Input type for forms (before zod transform). Use this with react-hook-form.
export type SopFormInput = z.input<typeof sopFormSchema>;
