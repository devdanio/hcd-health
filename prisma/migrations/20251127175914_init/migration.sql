-- CreateEnum
CREATE TYPE "EhrType" AS ENUM ('unified_practice', 'ghl');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('pageview', 'conversion', 'custom_event');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "companyBrief" TEXT,
    "apiKey" TEXT NOT NULL,
    "ehr" "EhrType",
    "googleAdsAccessToken" TEXT,
    "googleAdsRefreshToken" TEXT,
    "googleAdsTokenExpiresAt" TIMESTAMP(3),
    "googleAdsCustomerId" TEXT,
    "googleAdsAccountName" TEXT,
    "googleAdsCurrencyCode" TEXT,
    "googleAdsTimeZone" TEXT,
    "googleAdsConnectedAt" TIMESTAMP(3),
    "googleAdsAccountSelectedAt" TIMESTAMP(3),
    "googleAdsLastSyncedAt" TIMESTAMP(3),
    "googleAdsLastError" TEXT,
    "googleAdsLastErrorAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "fullName" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "ghlContactId" TEXT,
    "chirotouchAccountId" TEXT,
    "firstServiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GhlContact" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "contactName" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "companyName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "dnd" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT,
    "source" TEXT,
    "assignedTo" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "address1" TEXT,
    "dateAdded" TIMESTAMP(3) NOT NULL,
    "dateUpdated" TIMESTAMP(3) NOT NULL,
    "dateOfBirth" JSONB,
    "tags" TEXT[],
    "country" TEXT,
    "website" TEXT,
    "timezone" TEXT,
    "lastActivity" TIMESTAMP(3),
    "customField" JSONB[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "GhlContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "browserSessionId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "screenResolution" TEXT,
    "timezone" TEXT,
    "firstSessionAttribution" JSONB NOT NULL,
    "lastSessionAttribution" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "patientName" TEXT,
    "dateOfService" TIMESTAMP(3) NOT NULL,
    "service" TEXT,
    "serviceId" TEXT,
    "providerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentProcedure" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "procedureCode" TEXT NOT NULL,
    "chargeAmount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentProcedure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "dateOfBirth" TEXT,
    "gender" TEXT,
    "payerName" TEXT,
    "memberId" TEXT,
    "groupId" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "emergencyContactRelation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthState" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsPage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "h1" TEXT NOT NULL,
    "pageTitle" TEXT NOT NULL,
    "pageDescription" TEXT NOT NULL,
    "jsonSchema" JSONB,
    "slug" TEXT NOT NULL,
    "markdownContent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_apiKey_key" ON "Company"("apiKey");

-- CreateIndex
CREATE INDEX "Company_apiKey_idx" ON "Company"("apiKey");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_ghlContactId_key" ON "Contact"("ghlContactId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_chirotouchAccountId_key" ON "Contact"("chirotouchAccountId");

-- CreateIndex
CREATE INDEX "Contact_companyId_email_idx" ON "Contact"("companyId", "email");

-- CreateIndex
CREATE INDEX "Contact_companyId_phone_idx" ON "Contact"("companyId", "phone");

-- CreateIndex
CREATE INDEX "Contact_companyId_ghlContactId_idx" ON "Contact"("companyId", "ghlContactId");

-- CreateIndex
CREATE INDEX "Contact_companyId_idx" ON "Contact"("companyId");

-- CreateIndex
CREATE INDEX "Contact_ghlContactId_idx" ON "Contact"("ghlContactId");

-- CreateIndex
CREATE INDEX "Contact_chirotouchAccountId_idx" ON "Contact"("chirotouchAccountId");

-- CreateIndex
CREATE INDEX "Contact_firstServiceId_idx" ON "Contact"("firstServiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_browserSessionId_key" ON "Session"("browserSessionId");

-- CreateIndex
CREATE INDEX "Session_companyId_contactId_idx" ON "Session"("companyId", "contactId");

-- CreateIndex
CREATE INDEX "Session_companyId_idx" ON "Session"("companyId");

-- CreateIndex
CREATE INDEX "Session_browserSessionId_idx" ON "Session"("browserSessionId");

-- CreateIndex
CREATE INDEX "Event_sessionId_idx" ON "Event"("sessionId");

-- CreateIndex
CREATE INDEX "Event_companyId_type_idx" ON "Event"("companyId", "type");

-- CreateIndex
CREATE INDEX "Event_companyId_idx" ON "Event"("companyId");

-- CreateIndex
CREATE INDEX "Event_createdAt_idx" ON "Event"("createdAt");

-- CreateIndex
CREATE INDEX "Service_companyId_idx" ON "Service"("companyId");

-- CreateIndex
CREATE INDEX "Provider_companyId_idx" ON "Provider"("companyId");

-- CreateIndex
CREATE INDEX "Provider_serviceId_idx" ON "Provider"("serviceId");

-- CreateIndex
CREATE INDEX "Appointment_companyId_dateOfService_idx" ON "Appointment"("companyId", "dateOfService");

-- CreateIndex
CREATE INDEX "Appointment_contactId_idx" ON "Appointment"("contactId");

-- CreateIndex
CREATE INDEX "Appointment_serviceId_idx" ON "Appointment"("serviceId");

-- CreateIndex
CREATE INDEX "AppointmentProcedure_appointmentId_idx" ON "AppointmentProcedure"("appointmentId");

-- CreateIndex
CREATE INDEX "AppointmentProcedure_appointmentId_procedureCode_idx" ON "AppointmentProcedure"("appointmentId", "procedureCode");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_contactId_key" ON "Patient"("contactId");

-- CreateIndex
CREATE INDEX "Patient_contactId_idx" ON "Patient"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthState_state_key" ON "OAuthState"("state");

-- CreateIndex
CREATE INDEX "OAuthState_state_idx" ON "OAuthState"("state");

-- CreateIndex
CREATE INDEX "OAuthState_expiresAt_idx" ON "OAuthState"("expiresAt");

-- CreateIndex
CREATE INDEX "CmsPage_companyId_idx" ON "CmsPage"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CmsPage_companyId_slug_key" ON "CmsPage"("companyId", "slug");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_ghlContactId_fkey" FOREIGN KEY ("ghlContactId") REFERENCES "GhlContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_firstServiceId_fkey" FOREIGN KEY ("firstServiceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GhlContact" ADD CONSTRAINT "GhlContact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Provider" ADD CONSTRAINT "Provider_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Provider" ADD CONSTRAINT "Provider_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentProcedure" ADD CONSTRAINT "AppointmentProcedure_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthState" ADD CONSTRAINT "OAuthState_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsPage" ADD CONSTRAINT "CmsPage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
