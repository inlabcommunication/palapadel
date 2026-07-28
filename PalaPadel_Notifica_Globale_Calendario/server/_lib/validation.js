import { z } from "zod";
import { HttpError } from "./auth.js";

export { z };

export const documentId = z.string().trim().min(1).max(200).regex(/^[^/]+$/, "ID non valido");
export const optionalDate = z.union([z.string().date(), z.literal(""), z.null()]).optional();
export const optionalTime = z
  .union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Ora non valida"), z.literal(""), z.null()])
  .optional();

export const notificationType = z.enum(["match_result", "standings_update", "correction", "winner", "news"]);
export const notificationMode = z.enum(["disabled", "ask", "automatic", "draft"]);
export const notificationEventSchema = z.object({
  type: notificationType,
  title: z.string().trim().min(1).max(90),
  body: z.string().trim().min(1).max(220),
  url: z.string().trim().min(1).max(300),
  editionId: z.union([documentId, z.null()]).optional(),
}).strict();
export const notificationTopicsSchema = z.object({
  match_result: z.boolean().optional(),
  standings_update: z.boolean().optional(),
  correction: z.boolean().optional(),
  winner: z.boolean().optional(),
  news: z.boolean().optional(),
}).strict();

export function parseBody(schema, body) {
  const parsed = schema.safeParse(body ?? {});
  if (parsed.success) return parsed.data;

  const fields = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.join(".") || "_root";
    if (!fields[key]) fields[key] = issue.message;
  }
  throw new HttpError(400, "Dati non validi", {
    code: "VALIDATION_ERROR",
    fields,
  });
}
