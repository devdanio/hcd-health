import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { AppLayout } from '@/components/app/AppLayout'
import { RequireSignedIn } from '@/components/app/RequireSignedIn'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { listCampaignSettings, upsertCampaignSetting } from '@/server/ri/serverFns'
import { formatCents } from '@/utils/money'

export const Route = createFileRoute('/settings/campaigns')({
  component: RouteComponent,
})

function RouteComponent() {
  const queryClient = useQueryClient()

  const settingsQuery = useQuery({
    queryKey: ['campaign-settings'],
    queryFn: () => listCampaignSettings(),
  })

  const updateMutation = useMutation({
    mutationFn: (input: {
      campaign_id: string
      location_id: string | null
      include_in_reporting: boolean
      campaign_category: 'branded' | 'non_branded' | 'other' | null
    }) => upsertCampaignSetting(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['campaign-settings'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const data = settingsQuery.data

  return (
    <RequireSignedIn>
      <AppLayout>
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Campaign Settings</h1>
          <p className="text-sm text-gray-600">
            Map campaigns to locations and include/exclude them from reporting.
          </p>
        </div>

        <Card>
          <CardContent className="p-4">
            <CardTitle className="text-base mb-3">Google Ads Campaigns</CardTitle>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 pr-4">Campaign</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Last 7d Spend</th>
                    <th className="py-2 pr-4">Location</th>
                    <th className="py-2 pr-4">Include</th>
                    <th className="py-2 pr-4">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.campaigns ?? []).map((c) => (
                    <tr key={c.campaign_id} className="border-b">
                      <td className="py-2 pr-4">
                        <div className="flex flex-col">
                          <span className="text-gray-900">
                            {c.campaign_name ?? c.campaign_id}
                          </span>
                          <span className="text-xs text-gray-600">
                            id: {c.campaign_id}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 pr-4">{c.status}</td>
                      <td className="py-2 pr-4">
                        {formatCents(c.last_7d_spend_cents)}
                      </td>
                      <td className="py-2 pr-4">
                        <select
                          value={c.location_id ?? ''}
                          onChange={(e) =>
                            updateMutation.mutate({
                              campaign_id: c.campaign_id,
                              location_id: e.target.value || null,
                              include_in_reporting: c.include_in_reporting,
                              campaign_category: c.campaign_category,
                            })
                          }
                          className="border rounded-md px-2 py-1 text-sm bg-white"
                        >
                          <option value="">Unassigned/Shared</option>
                          {(data?.locations ?? []).map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-4">
                        <input
                          type="checkbox"
                          checked={c.include_in_reporting}
                          onChange={(e) =>
                            updateMutation.mutate({
                              campaign_id: c.campaign_id,
                              location_id: c.location_id,
                              include_in_reporting: e.target.checked,
                              campaign_category: c.campaign_category,
                            })
                          }
                        />
                      </td>
                      <td className="py-2 pr-4">
                        <select
                          value={c.campaign_category ?? ''}
                          onChange={(e) =>
                            updateMutation.mutate({
                              campaign_id: c.campaign_id,
                              location_id: c.location_id,
                              include_in_reporting: c.include_in_reporting,
                              campaign_category:
                                (e.target.value as
                                  | 'branded'
                                  | 'non_branded'
                                  | 'other'
                                  | '') || null,
                            })
                          }
                          className="border rounded-md px-2 py-1 text-sm bg-white"
                        >
                          <option value="">—</option>
                          <option value="branded">branded</option>
                          <option value="non_branded">non_branded</option>
                          <option value="other">other</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                  {(data?.campaigns.length ?? 0) === 0 ? (
                    <tr>
                      <td className="py-3 text-gray-600" colSpan={6}>
                        No campaigns yet. Run a Google Ads sync or ingest leads with a
                        `campaign_id`.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
    </RequireSignedIn>
  )
}
