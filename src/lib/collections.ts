import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import type { QueryClient } from '@tanstack/react-query'

// Import server functions - these are safe because they're created with createServerFn
// TanStack Start handles the client/server boundary automatically
import * as companyFns from '@/server/functions/companies'
import * as contactFns from '@/server/functions/contacts'
import * as trackingFns from '@/server/functions/tracking'
import * as patientFns from '@/server/functions/patients'
import * as cmsFns from '@/server/functions/cms'

export function createCollections(queryClient: QueryClient) {
  // Companies Collection
  const companiesCollection = createCollection(
    queryCollectionOptions({
      id: 'companies',
      queryKey: ['companies'],
      queryFn: async () => {
        const result = await companyFns.getCompanies({ data: {} })
        return result
      },
      queryClient,
      getKey: (item) => item.id,
      onInsert: async ({ transaction }) => {
        const { modified } = transaction.mutations[0]
        await companyFns.createCompany({
          data: {
            name: modified.name,
            domain: modified.domain,
          },
        })
      },
      onUpdate: async ({ transaction }) => {
        const { original, modified } = transaction.mutations[0]
        await companyFns.updateCompany({
          data: {
            companyId: original.id,
            name: modified.name,
            domain: modified.domain,
          },
        })
      },
      onDelete: async ({ transaction }) => {
        const { original } = transaction.mutations[0]
        await companyFns.deleteCompany({ data: { companyId: original.id } })
      },
    }),
  )

  // Contacts Collection
  const contactsCollection = createCollection(
    queryCollectionOptions({
      id: 'contacts',
      queryKey: ['contacts'],
      queryFn: async (ctx) => {
        const companyId = ctx.meta?.companyId as string | undefined
        if (!companyId) return []
        return await contactFns.getContacts({ data: { companyId } })
      },
      queryClient,
      getKey: (item) => item.id,
      onInsert: async ({ transaction }) => {
        const { modified } = transaction.mutations[0]
        await contactFns.createContact({
          data: {
            companyId: modified.companyId,
            email: modified.email,
            phone: modified.phone,
            fullName: modified.fullName,
            firstName: modified.firstName,
            lastName: modified.lastName,
          },
        })
      },
      onUpdate: async ({ transaction }) => {
        const { original, modified } = transaction.mutations[0]
        await contactFns.updateContact({
          data: {
            contactId: original.id,
            email: modified.email,
            phone: modified.phone,
            fullName: modified.fullName,
            firstName: modified.firstName,
            lastName: modified.lastName,
          },
        })
      },
      onDelete: async ({ transaction }) => {
        const { original } = transaction.mutations[0]
        await contactFns.deleteContact({ data: { contactId: original.id } })
      },
    }),
  )

  // Patients Collection
  const patientsCollection = createCollection(
    queryCollectionOptions({
      id: 'patients',
      queryKey: ['patients'],
      queryFn: async (ctx) => {
        const companyId = ctx.meta?.companyId as string | undefined
        if (!companyId) return []
        return await patientFns.getPatients({ data: { companyId } })
      },
      queryClient,
      getKey: (item) => item.id,
      onInsert: async ({ transaction }) => {
        const { modified } = transaction.mutations[0]
        await patientFns.createPatient({
          data: {
            companyId: modified.contact.companyId,
            email: modified.contact.email,
            phone: modified.contact.phone,
            fullName: modified.contact.fullName,
            firstName: modified.contact.firstName,
            lastName: modified.contact.lastName,
            dateOfBirth: modified.dateOfBirth,
            gender: modified.gender,
            address: modified.address,
            city: modified.city,
            state: modified.state,
            zipCode: modified.zipCode,
            insuranceProvider: modified.insuranceProvider,
            insurancePolicyNumber: modified.insurancePolicyNumber,
          },
        })
      },
      onUpdate: async ({ transaction }) => {
        const { original, modified } = transaction.mutations[0]
        await patientFns.updatePatient({
          data: {
            patientId: original.id,
            email: modified.contact?.email,
            phone: modified.contact?.phone,
            fullName: modified.contact?.fullName,
            firstName: modified.contact?.firstName,
            lastName: modified.contact?.lastName,
            dateOfBirth: modified.dateOfBirth,
            gender: modified.gender,
            address: modified.address,
            city: modified.city,
            state: modified.state,
            zipCode: modified.zipCode,
            insuranceProvider: modified.insuranceProvider,
            insurancePolicyNumber: modified.insurancePolicyNumber,
          },
        })
      },
      onDelete: async ({ transaction }) => {
        const { original } = transaction.mutations[0]
        await patientFns.deletePatient({ data: { patientId: original.id } })
      },
    }),
  )

  // CMS Pages Collection
  const cmsPagesCollection = createCollection(
    queryCollectionOptions({
      id: 'cmsPages',
      queryKey: ['cmsPages'],
      queryFn: async (ctx) => {
        const companyId = ctx.meta?.companyId as string | undefined
        if (!companyId) return []
        return await cmsFns.getPages({ data: { companyId } })
      },
      queryClient,
      getKey: (item) => item.id,
      onInsert: async ({ transaction }) => {
        const { modified } = transaction.mutations[0]
        await cmsFns.createPage({
          data: {
            companyId: modified.companyId,
            h1: modified.h1,
            pageTitle: modified.pageTitle,
            pageDescription: modified.pageDescription,
            slug: modified.slug,
            markdownContent: modified.markdownContent,
            jsonSchema: modified.jsonSchema,
          },
        })
      },
      onUpdate: async ({ transaction }) => {
        const { original, modified } = transaction.mutations[0]
        await cmsFns.updatePage({
          data: {
            pageId: original.id,
            h1: modified.h1,
            pageTitle: modified.pageTitle,
            pageDescription: modified.pageDescription,
            slug: modified.slug,
            markdownContent: modified.markdownContent,
            jsonSchema: modified.jsonSchema,
          },
        })
      },
      onDelete: async ({ transaction }) => {
        const { original } = transaction.mutations[0]
        await cmsFns.deletePage({ data: { pageId: original.id } })
      },
    }),
  )

  // Sessions Collection (read-only for tracking)
  const sessionsCollection = createCollection(
    queryCollectionOptions({
      id: 'sessions',
      queryKey: ['sessions'],
      queryFn: async (ctx) => {
        const companyId = ctx.meta?.companyId as string | undefined
        const limit = ctx.meta?.limit as number | undefined
        if (!companyId) return []
        return await trackingFns.getSessions({ data: { companyId, limit: limit || 500 } })
      },
      queryClient,
      getKey: (item) => item.id,
    }),
  )

  return {
    companiesCollection,
    contactsCollection,
    patientsCollection,
    cmsPagesCollection,
    sessionsCollection,
  }
}

export type Collections = ReturnType<typeof createCollections>
