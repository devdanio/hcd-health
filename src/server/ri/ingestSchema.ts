import { z } from 'zod'

export const ingestEventSchema = z
  .object({
    organization_id: z.string().min(1).optional(),
    event_type: z.enum(['form', 'chat', 'booking', 'call', 'import']),
    occurred_at: z.string().datetime().optional(),
    phone: z.string().min(1),
    name: z.string().min(1).optional(),

    platform: z.string().min(1).optional(),
    campaign_id: z
      .string()
      .min(1)
      .refine((v) => /^\d+$/.test(v), 'campaign_id must be digits-only')
      .optional(),
    gclid: z.string().min(1).optional(),

    utm_source: z.string().min(1).optional(),
    utm_medium: z.string().min(1).optional(),
    utm_campaign: z.string().min(1).optional(),
    utm_content: z.string().min(1).optional(),
    utm_term: z.string().min(1).optional(),

    referrer: z.string().min(1).optional(),
    landing_page: z.string().min(1).optional(),

    call: z
      .object({
        duration_sec: z.number().int().nonnegative().optional(),
      })
      .optional(),
  })
  .passthrough()

export type IngestEventInput = z.infer<typeof ingestEventSchema>

