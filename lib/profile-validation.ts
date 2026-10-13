import { z } from "zod";

/** Display names are not unique handles. Shared by the form and API. */
export const usernameSchema = z.object({
  username: z.string().trim().min(2, "At least 2 characters")
    .max(30, "Max 30 characters")
    .regex(/^[\p{L}\p{N}][\p{L}\p{M}\p{N} ._'-]*$/u, "Start with a letter or number"),
});
