// analyticsPlugin.ts
import type { AnalyticsPlugin } from 'analytics'
import Analytics from 'analytics'

export function hchTrackerPlugin(): AnalyticsPlugin {
  return {
    name: 'hch-tracker',

    initialize(options) {
      console.log('initialize', options)
      // runs once
    },

    page(options) {
      console.log('page', options)
      //   send('page_view', options.paylo    ad)
    },

    track(options) {
      console.log('track', options)
      //   send(payload.event, payload)
    },

    identify(options) {
      console.log('identify', options)
      //   send('identify', payload)
    },

    reset() {
      console.log('reset')
      // optional: clear client state
    },
  }
}

const analytics = Analytics({
  app: 'hch-analytics',
  plugins: [hchTrackerPlugin()],
})

/* export the instance for usage in your app */
export default analytics
