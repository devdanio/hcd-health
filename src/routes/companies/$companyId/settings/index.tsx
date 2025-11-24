import { createFileRoute } from '@tanstack/react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CompanySettings } from '@/components/settings/company-settings'
import { ServicesSettings } from '@/components/settings/services-settings'
import { ProvidersSettings } from '@/components/settings/providers-settings'
import { Id } from 'convex/_generated/dataModel'

export const Route = createFileRoute('/companies/$companyId/settings/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { companyId } = Route.useParams()

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      
      <Tabs defaultValue="company" className="w-full">
        <TabsList>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="providers">Providers</TabsTrigger>
        </TabsList>
        <TabsContent value="company">
          <CompanySettings companyId={companyId as Id<"companies">} />
        </TabsContent>
        <TabsContent value="services">
          <ServicesSettings companyId={companyId as Id<"companies">} />
        </TabsContent>
        <TabsContent value="providers">
          <ProvidersSettings companyId={companyId as Id<"companies">} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
