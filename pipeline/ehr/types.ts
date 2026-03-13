export type PreprocessContext = {
  sourceSystem: string
  sourceFileName: string
  sourceFileDate: string | null
}

export type EHRPatientJsonld = {
  firstName: string | null
  lastName: string | null
  phone: string | null
  email: string | null
  firstApt: string | null
  lastApt: string | null
  cashCollectedCents: number | null
  insuranceBalanceCents: number | null
  patientBalanceCents: number | null
  externalId: string | null
}

export type RejectedRow = {
  reason: string
  row: Record<string, unknown>
}

export type PreprocessResult = {
  normalized: EHRPatientJsonld[]
  rejected: RejectedRow[]
}
