import { auth } from '@clerk/tanstack-react-start/server'

import { prisma } from '@/db'
import { UnauthorizedError } from '@/server/ri/errors'

export async function requireSignedInUserId(): Promise<string> {
  const { userId } = await auth()
  if (!userId) throw new UnauthorizedError()
  return userId
}

export async function requireActiveOrganization(opts: {
  orgIdFromParams: string
}): Promise<{ userId: string; organizationId: string }> {
  const { userId, orgId } = await auth()
  if (!userId) throw new UnauthorizedError()
  if (!orgId) throw new UnauthorizedError('No active organization')
  if (orgId !== opts.orgIdFromParams) {
    throw new UnauthorizedError('Wrong organization')
  }

  await prisma.organizations.upsert({
    where: { id: orgId },
    create: { id: orgId },
    update: {},
  })

  await prisma.locations.upsert({
    where: {
      organization_id_name: {
        organization_id: orgId,
        name: 'Main',
      },
    },
    create: {
      organization_id: orgId,
      name: 'Main',
    },
    update: {},
  })

  await prisma.locations.upsert({
    where: {
      organization_id_name: {
        organization_id: orgId,
        name: 'Unassigned/Shared',
      },
    },
    create: {
      organization_id: orgId,
      name: 'Unassigned/Shared',
    },
    update: {},
  })

  return { userId, organizationId: orgId }
}

export async function requireActiveOrganizationFromAuth(): Promise<{
  userId: string
  organizationId: string
}> {
  const { userId, orgId } = await auth()
  if (!userId) throw new UnauthorizedError()
  if (!orgId) throw new UnauthorizedError('No active organization')

  await prisma.organizations.upsert({
    where: { id: orgId },
    create: { id: orgId },
    update: {},
  })

  await prisma.locations.upsert({
    where: {
      organization_id_name: {
        organization_id: orgId,
        name: 'Main',
      },
    },
    create: {
      organization_id: orgId,
      name: 'Main',
    },
    update: {},
  })

  await prisma.locations.upsert({
    where: {
      organization_id_name: {
        organization_id: orgId,
        name: 'Unassigned/Shared',
      },
    },
    create: {
      organization_id: orgId,
      name: 'Unassigned/Shared',
    },
    update: {},
  })

  return { userId, organizationId: orgId }
}
