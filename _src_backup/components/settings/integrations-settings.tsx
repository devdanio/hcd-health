'use client'

import { useLiveQuery } from '@tanstack/react-db'
import { useCollections } from '@/routes/__root'
import {
  generateOAuthUrl as generateGoogleOAuthUrl,
  disconnectGoogleAds,
  listAccessibleAccounts,
  selectAccount,
  getCampaigns as getGoogleAdsCampaigns,
} from '@/collections'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { CheckCircle2, XCircle, ExternalLink, Loader2, List } from 'lucide-react'
import { useState, useEffect } from 'react'

interface IntegrationsSettingsProps {
  companyId: string
}

export function IntegrationsSettings({ companyId }: IntegrationsSettingsProps) {
  const { companiesCollection } = useCollections()
  const { data: companies } = useLiveQuery((q) =>
    q.from({ company: companiesCollection })
  )
  const company = companies?.find(c => c.id === companyId)

  const [isConnecting, setIsConnecting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false)
  const [isSelectingAccount, setIsSelectingAccount] = useState(false)
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false)
  const [accounts, setAccounts] = useState<Array<{
    customerId: string
    accountName: string
    currencyCode: string
    timeZone: string
    isManager: boolean
  }> | null>(null)
  const [campaigns, setCampaigns] = useState<Array<{
    id: string
    name: string
    status: string
    advertisingChannelType: string
    biddingStrategyType: string
    budget: {
      id: string
      name: string
      amountMicros: number
      deliveryMethod: string
    } | null
    startDate: string
    endDate: string | null
  }> | null>(null)
  const [manualCustomerId, setManualCustomerId] = useState('')
  const [showManualInput, setShowManualInput] = useState(false)

  const hasTokens = !!company?.googleAds
  const hasSelectedAccount = !!company?.googleAds?.customerId
  const isFullyConnected = hasTokens && hasSelectedAccount

  // Auto-load accounts if OAuth completed but no account selected
  useEffect(() => {
    if (hasTokens && !hasSelectedAccount && !accounts && !isLoadingAccounts) {
      loadAccounts()
    }
  }, [hasTokens, hasSelectedAccount, accounts, isLoadingAccounts])

  const loadAccounts = async () => {
    try {
      setIsLoadingAccounts(true)
      const accountList = await listAccessibleAccounts({ data: { companyId } })
      setAccounts(accountList)

      // If no accounts found, show manual input
      if (accountList.length === 0) {
        setShowManualInput(true)
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load Google Ads accounts')
      setAccounts([])
      setShowManualInput(true)
    } finally {
      setIsLoadingAccounts(false)
    }
  }

  const handleConnect = async () => {
    try {
      setIsConnecting(true)
      const { oauthUrl } = await generateGoogleOAuthUrl({ data: { companyId } })
      // Redirect to Google OAuth
      window.location.href = oauthUrl
    } catch (error: any) {
      toast.error(error.message || 'Failed to initiate Google Ads connection')
      setIsConnecting(false)
    }
  }

  const handleSelectAccount = async (customerId: string) => {
    try {
      setIsSelectingAccount(true)
      await selectAccount({ data: { companyId, customerId } })
      toast.success('Google Ads account selected successfully!')
      setAccounts(null) // Clear account list
      setManualCustomerId('')
      setShowManualInput(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to select account')
    } finally {
      setIsSelectingAccount(false)
    }
  }

  const handleManualSubmit = async () => {
    const cleanedId = manualCustomerId.replace(/-/g, '').trim()

    if (!cleanedId || cleanedId.length < 10) {
      toast.error('Please enter a valid Customer ID')
      return
    }

    await handleSelectAccount(cleanedId)
  }

  const handleDisconnect = async () => {
    if (
      !confirm(
        'Are you sure you want to disconnect Google Ads? This will remove all stored credentials.',
      )
    ) {
      return
    }

    try {
      setIsDisconnecting(true)
      await disconnectGoogleAds({ data: { companyId } })
      setAccounts(null) // Clear account list
      setCampaigns(null) // Clear campaigns
      toast.success('Google Ads disconnected successfully')
    } catch (error: any) {
      toast.error(error.message || 'Failed to disconnect Google Ads')
    } finally {
      setIsDisconnecting(false)
    }
  }

  const handleLoadCampaigns = async () => {
    try {
      setIsLoadingCampaigns(true)
      const campaignList = await getGoogleAdsCampaigns({ data: { companyId } })
      setCampaigns(campaignList)
      toast.success(`Loaded ${campaignList.length} campaigns`)
    } catch (error: any) {
      toast.error(error.message || 'Failed to load campaigns')
      setCampaigns([])
    } finally {
      setIsLoadingCampaigns(false)
    }
  }

  if (!company) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-muted-foreground">Loading...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Google Ads
                {isFullyConnected ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : hasTokens ? (
                  <Loader2 className="h-5 w-5 text-yellow-600 animate-spin" />
                ) : (
                  <XCircle className="h-5 w-5 text-gray-400" />
                )}
              </CardTitle>
              <CardDescription>
                Connect your Google Ads account to track campaign performance
                and ROI
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Account selection needed */}
          {hasTokens && !hasSelectedAccount && (
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <h3 className="font-semibold text-blue-900 mb-2">
                  Select Your Google Ads Account
                </h3>
                <p className="text-sm text-blue-700 mb-3">
                  Choose which Google Ads account to connect to this dashboard.
                </p>
              </div>

              {isLoadingAccounts ? (
                <div className="text-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                  <p className="text-sm text-gray-600 mt-2">
                    Loading accounts...
                  </p>
                </div>
              ) : accounts && accounts.length > 0 ? (
                <div className="space-y-2">
                  {accounts.map((account) => (
                    <div
                      key={account.customerId}
                      className="border rounded p-3 hover:border-blue-500 hover:bg-blue-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium">
                            {account.accountName}
                          </div>
                          <div className="text-sm text-gray-600">
                            ID: {account.customerId} • {account.currencyCode} •{' '}
                            {account.timeZone}
                            {account.isManager && (
                              <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                                Manager Account
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() =>
                            handleSelectAccount(account.customerId)
                          }
                          disabled={isSelectingAccount}
                        >
                          {isSelectingAccount ? 'Selecting...' : 'Select'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : accounts && accounts.length === 0 ? (
                <div className="space-y-3">
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                    <p className="text-sm text-yellow-800">
                      <strong>Unable to list accounts automatically.</strong> This
                      typically happens with test developer tokens. Please enter
                      your Google Ads Customer ID manually.
                    </p>
                  </div>

                  {showManualInput && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium block mb-2">
                          Google Ads Customer ID
                        </label>
                        <p className="text-xs text-gray-600 mb-2">
                          Find your Customer ID at{' '}
                          <a
                            href="https://ads.google.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            ads.google.com
                          </a>{' '}
                          (top right corner, format: 123-456-7890)
                        </p>
                        <div className="flex gap-2">
                          <Input
                            type="text"
                            value={manualCustomerId}
                            onChange={(e) => setManualCustomerId(e.target.value)}
                            placeholder="123-456-7890 or 1234567890"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleManualSubmit()
                              }
                            }}
                          />
                          <Button
                            onClick={handleManualSubmit}
                            disabled={isSelectingAccount || !manualCustomerId}
                          >
                            {isSelectingAccount ? 'Connecting...' : 'Connect'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  size="sm"
                >
                  {isDisconnecting ? 'Canceling...' : 'Cancel'}
                </Button>
              </div>
            </div>
          )}

          {/* Fully connected */}
          {isFullyConnected &&
          company.googleAds &&
          company.googleAds.customerId ? (
            <div className="space-y-3">
              <div className="text-sm space-y-1 border-l-4 border-green-500 pl-3">
                <div>
                  <strong>Account:</strong>{' '}
                  {company.googleAds.accountName || 'N/A'}
                </div>
                <div>
                  <strong>Customer ID:</strong> {company.googleAds.customerId}
                </div>
                <div>
                  <strong>Currency:</strong>{' '}
                  {company.googleAds.currencyCode || 'USD'}
                </div>
                <div>
                  <strong>Time Zone:</strong>{' '}
                  {company.googleAds.timeZone || 'N/A'}
                </div>
                <div>
                  <strong>Connected:</strong>{' '}
                  {new Date(company.googleAds.connectedAt).toLocaleDateString()}
                </div>
                {company.googleAds.lastSyncedAt && (
                  <div>
                    <strong>Last synced:</strong>{' '}
                    {new Date(company.googleAds.lastSyncedAt).toLocaleString()}
                  </div>
                )}
              </div>

              {company.googleAds.lastError && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200">
                  <strong>Last error:</strong> {company.googleAds.lastError}
                  {company.googleAds.lastErrorAt && (
                    <div className="text-xs mt-1">
                      {new Date(company.googleAds.lastErrorAt).toLocaleString()}
                    </div>
                  )}
                </div>
              )}

              {/* Campaigns Section */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Campaigns</h3>
                  <Button
                    size="sm"
                    onClick={handleLoadCampaigns}
                    disabled={isLoadingCampaigns}
                  >
                    <List className="mr-2 h-4 w-4" />
                    {isLoadingCampaigns ? 'Loading...' : 'Load Campaigns'}
                  </Button>
                </div>

                {campaigns && campaigns.length > 0 && (
                  <div className="space-y-2">
                    {campaigns.map((campaign) => (
                      <div
                        key={campaign.id}
                        className="border rounded p-3 text-sm"
                      >
                        <div className="font-medium">{campaign.name}</div>
                        <div className="text-gray-600 text-xs mt-1">
                          <span className="mr-3">
                            Status: <span className="font-medium">{campaign.status}</span>
                          </span>
                          <span className="mr-3">
                            Type: {campaign.advertisingChannelType}
                          </span>
                          {campaign.budget && (
                            <span>
                              Budget: ${(campaign.budget.amountMicros / 1000000).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {campaigns && campaigns.length === 0 && (
                  <div className="text-sm text-gray-600 text-center py-4">
                    No campaigns found
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <Button
                  variant="destructive"
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                >
                  {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleConnect}
                  disabled={isConnecting}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {isConnecting ? 'Reconnecting...' : 'Reconnect'}
                </Button>
              </div>
            </div>
          ) : null}

          {/* Not connected */}
          {!hasTokens && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Connect your Google Ads account to import campaign data, track
                conversions, and measure ROI. You'll be redirected to Google to
                authorize access.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <p className="text-sm text-blue-800">
                  <strong>What you'll authorize:</strong>
                </p>
                <ul className="text-sm text-blue-700 list-disc list-inside mt-1 space-y-1">
                  <li>Read campaign performance metrics</li>
                  <li>Access conversion tracking data</li>
                  <li>View account structure</li>
                </ul>
                <p className="text-sm text-blue-800 mt-2">
                  <strong>Next step:</strong> After authorization, you'll choose
                  which Google Ads account to connect.
                </p>
              </div>
              <Button onClick={handleConnect} disabled={isConnecting}>
                <ExternalLink className="mr-2 h-4 w-4" />
                {isConnecting ? 'Connecting...' : 'Connect Google Ads'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Future integrations can be added here as additional cards */}
    </div>
  )
}
