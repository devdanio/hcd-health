import type { QueryClient } from '@tanstack/react-query'

// ============================================================================
// Export all server functions and schemas
// ============================================================================

export * from './companies'
export * from './contacts'
export * from './tracking'
export * from './patients'
export * from './cms'
export * from './appointments'
export * from './services'
export * from './providers'
export * from './google-ads'

// ============================================================================
// Import collection factory functions
// ============================================================================

import { createCompaniesCollection } from './companies'
import { createContactsCollection } from './contacts'
import { createSessionsCollection } from './tracking'
import { createPatientsCollection } from './patients'
import { createCmsPagesCollection } from './cms'
import { createAppointmentsCollection } from './appointments'
import { createServicesCollection } from './services'
import { createProvidersCollection } from './providers'
import { createCityStateLatLngCollection } from './city-state-lat-lng'

// ============================================================================
// Collection factory function
// ============================================================================

export function createCollections(queryClient: QueryClient) {
  return {
    companiesCollection: createCompaniesCollection(queryClient),
    contactsCollection: createContactsCollection(queryClient),
    sessionsCollection: createSessionsCollection(queryClient),
    patientsCollection: createPatientsCollection(queryClient),
    cmsPagesCollection: createCmsPagesCollection(queryClient),
    appointmentsCollection: createAppointmentsCollection(queryClient),
    servicesCollection: createServicesCollection(queryClient),
    providersCollection: createProvidersCollection(queryClient),
    cityStateLatLngCollection: createCityStateLatLngCollection(queryClient),
  }
}

export type Collections = ReturnType<typeof createCollections>
