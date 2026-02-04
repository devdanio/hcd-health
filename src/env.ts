import { z } from 'zod'

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
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
})

const clientSchema = z.object({
  // Add client env vars here (must be VITE_*)
})

const isServer = typeof window === 'undefined'

const serverEnv = isServer ? serverSchema.parse(process.env) : {}
const clientEnv = clientSchema.parse(import.meta.env)

export const env = {
  ...serverEnv,
  ...clientEnv,
} as z.infer<typeof serverSchema> & z.infer<typeof clientSchema>
