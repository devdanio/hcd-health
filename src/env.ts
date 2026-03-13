import { z } from 'zod'

const serverSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  DATABASE_URL: z.string().min(1),

  // Optional: protect internal sync endpoints
  CRON_SECRET: z.string().min(1).optional(),

  // Optional until Google Ads sync is enabled
  GOOGLE_ADS_ENCRYPTION_KEY: z.string().min(1).optional(),
  GOOGLE_ADS_DEVELOPER_TOKEN: z.string().min(1).optional(),
  GOOGLE_ADS_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_ADS_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_ADS_REFRESH_TOKEN: z.string().min(1).optional(),
  GOOGLE_ADS_LOGIN_CUSTOMER_ID: z.string().min(1).optional(),

  // Optional until Facebook Ads sync is enabled
  FACEBOOK_ADS_ACCESS_TOKEN: z.string().min(1).optional(),
  FACEBOOK_GRAPH_VERSION: z.string().min(1).optional(),

  // Facebook Conversions API — per-company pixel credentials
  FB_ADS_PAOM_PIXEL_ID: z.string().min(1).optional(),
  FB_ADS_PAOM_ACCESS_TOKEN: z.string().min(1).optional(),
})

const clientSchema = z.object({
  // Add client env vars here (must be VITE_*)
  VITE_API_HOST_URL: z.string().min(1).optional(),
})

const isServer = typeof window === 'undefined'

const serverEnv = isServer ? serverSchema.parse(process.env) : {}
const viteEnv = (() => {
  if (typeof import.meta === 'undefined') return {}
  if (!('env' in import.meta)) return {}
  const env = (import.meta as unknown as { env?: Record<string, string> }).env
  return env ?? {}
})()

const clientEnv = clientSchema.parse(viteEnv)

export const env = {
  ...serverEnv,
  ...clientEnv,
} as z.infer<typeof serverSchema> & z.infer<typeof clientSchema>
