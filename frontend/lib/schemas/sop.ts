import { z } from "zod";

export const sopFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters long"),
  content: z.string().min(10, "Content must be at least 10 characters long"),
  tags: z
    .string()
    .transform((val) =>
      val
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    ),
});
export type SopForm = z.infer<typeof sopFormSchema>;

export type SopFormInput = z.input<typeof sopFormSchema>;
