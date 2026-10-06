import { z } from 'zod';

const MAX_LIMIT = 5000;
const iso = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'must be an ISO timestamp')
  .transform((v) => new Date(v).toISOString());

const schema = z.object({
  from: iso.optional(),
  to: iso.optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
});

/** Parses `from`/`to`/`limit` query params; defaults to the last hour. */
export function parseHistoryQuery(params: URLSearchParams, now = new Date()) {
  const parsed = schema.safeParse({
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
    limit: params.get('limit') ?? undefined,
  });
  if (!parsed.success)
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid query.' };
  const to = parsed.data.to ?? now.toISOString();
  const from = parsed.data.from ?? new Date(Date.parse(to) - 3_600_000).toISOString();
  if (from > to) return { ok: false as const, error: '`from` must not be after `to`.' };
  return { ok: true as const, from, to, limit: parsed.data.limit ?? 1000 };
}
