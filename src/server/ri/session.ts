import { auth } from '@clerk/tanstack-react-start/server'
import { UnauthorizedError } from '@/server/ri/errors'

export async function requireUserId(): Promise<string> {
  const { userId } = await auth()
  if (!userId) throw new UnauthorizedError()
  return userId
}

export async function getOrCreateOrganizationForUser(opts: {
  userId: string
}): Promise<{
  organizationId: string
}> {
  const { prisma } = await import('@/db')

  const existing = await prisma.users.findUnique({
    where: { id: opts.userId },
    select: { organization_id: true },
  })

  if (existing) {
    return { organizationId: existing.organization_id }
  }

  const created = await prisma.organizations.create({
    data: {
      name: 'New Organization',
      locations: {
        create: [{ name: 'Main' }, { name: 'Unassigned/Shared' }],
      },
      users: {
        create: { id: opts.userId },
      },
    },
    select: { id: true },
  })

  return { organizationId: created.id }
}
