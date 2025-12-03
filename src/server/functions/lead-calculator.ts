import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '@/server/db/client'

// ============================================================================
// Schemas
// ============================================================================

export const createLeadCalculatorSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email is required'),
  revenue: z.number().positive(),
  patients: z.number().int().positive(),
  newPatients: z.number().int().positive(),
  avgVisits: z.number().positive(),
  marketingCosts: z.number().nonnegative(),
  directCareCosts: z.number().nonnegative(),
  overheadCosts: z.number().nonnegative(),
})

export const getLeadCalculatorSchema = z.object({
  id: z.string(),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Create a new calculator entry
 */
export const createLeadCalculator = createServerFn({ method: 'POST' })
  .validator(createLeadCalculatorSchema)
  .handler(async ({ data }) => {
    return await prisma.leadCalculator.create({
      data,
    })
  })

/**
 * Get a calculator entry by ID
 */
export const getLeadCalculator = createServerFn({ method: 'GET' })
  .validator(getLeadCalculatorSchema)
  .handler(async ({ data }) => {
    return await prisma.leadCalculator.findUnique({
      where: { id: data.id },
    })
  })
