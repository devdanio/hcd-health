// Channel definition type matching PostHog's format
// [domain, kind, domain_type, type_if_paid, type_if_organic, is_app]
export type ChannelDefinition = [
  string, // domain
  'source' | 'medium', // kind
  string | null, // domain_type
  string | null, // type_if_paid
  string | null, // type_if_organic
  boolean, // is_app
]

// Import the channel definitions from JSON
import channelDefinitionsJson from './channel_definitions.json'

export const CHANNEL_DEFINITIONS: ChannelDefinition[] =
  channelDefinitionsJson as ChannelDefinition[]

// Create lookup maps for fast access
export const SOURCE_DEFINITIONS = new Map<string, ChannelDefinition>()
export const MEDIUM_DEFINITIONS = new Map<string, ChannelDefinition>()

// Index definitions by domain/medium for O(1) lookup
CHANNEL_DEFINITIONS.forEach((def) => {
  const [domain] = def
  if (def[1] === 'source') {
    SOURCE_DEFINITIONS.set(domain.toLowerCase(), def)
  } else if (def[1] === 'medium') {
    MEDIUM_DEFINITIONS.set(domain.toLowerCase(), def)
  }
})

