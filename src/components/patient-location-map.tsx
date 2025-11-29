'use client'

import { useEffect, useRef, useMemo } from 'react'
import mapboxgl from 'mapbox-gl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useCollections } from '@/routes/__root'
import { useLiveQuery } from '@tanstack/react-db'
import { CityLatLng } from '@/generated/prisma/client'
import { distance } from '@turf/turf'

interface Patient {
  id: string
  address1?: string | null
  address2?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
}

interface PatientLocationMapProps {
  patients: Patient[]
}

// Clinic location: 166 Bunn Dr STE 109, Princeton, NJ 08540
const CLINIC_LOCATION = {
  longitude: -74.6672,
  latitude: 40.3573,
  address: '166 Bunn Dr STE 109, Princeton, NJ 08540',
}

// Origin point for distance filtering
const ORIGIN_LOCATION = {
  latitude: 40.3504,
  longitude: -74.6571,
}

// Simple geocoding function using approximate coordinates for demonstration
// In production, you'd want to use a proper geocoding service
function geocodeAddress({
  origin,
  patient,
  cityStateLatLngs,
}: {
  origin: { longitude: number; latitude: number }
  patient: Patient
  cityStateLatLngs: CityLatLng[]
}): { longitude: number; latitude: number } | null {
  if (!patient.city || !patient.state) return null

  const cityStateLatLng = cityStateLatLngs.find(
    (c) => c.city === patient.city && c.state === patient.state,
  )
  if (!cityStateLatLng) return null

  // Calculate distance from origin using Turf.js
  // Turf.js expects points as [longitude, latitude]
  const originPoint: [number, number] = [origin.longitude, origin.latitude]
  const patientPoint: [number, number] = [
    cityStateLatLng.longitude,
    cityStateLatLng.latitude,
  ]
  const distanceInMiles = distance(originPoint, patientPoint, {
    units: 'miles',
  })

  // Return null if distance is roughly 50 miles or more
  if (distanceInMiles >= 50) {
    return null
  }

  return {
    longitude: cityStateLatLng.longitude,
    latitude: cityStateLatLng.latitude,
  }
}

export function PatientLocationMap({ patients }: PatientLocationMapProps) {
  const { cityStateLatLngCollection } = useCollections()
  const { data: cityStateLatLng } = useLiveQuery((q) =>
    q.from({ cityStateLatLng: cityStateLatLngCollection }),
  )
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)

  console.log('patients', patients)
  // Get Mapbox token from environment
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN

  // Convert patient addresses to coordinates
  const patientLocations = useMemo(() => {
    return patients
      .map((patient) => {
        const coords = geocodeAddress({
          origin: ORIGIN_LOCATION,
          patient,
          cityStateLatLngs: cityStateLatLng || [],
        })
        if (!coords) return null
        return {
          type: 'Feature' as const,
          properties: {
            id: patient.id,
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [coords.longitude, coords.latitude],
          },
        }
      })
      .filter((loc): loc is NonNullable<typeof loc> => loc !== null)
  }, [patients, cityStateLatLng])

  // Create GeoJSON for heatmap
  const heatmapData = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: patientLocations,
    }),
    [patientLocations],
  )

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return
    if (map.current) return // Initialize map only once

    mapboxgl.accessToken = mapboxToken

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [CLINIC_LOCATION.longitude, CLINIC_LOCATION.latitude],
      zoom: 8,
    })

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

    // Add clinic marker
    const el = document.createElement('div')
    el.className = 'clinic-marker'
    el.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center;">
        <div style="background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); border-radius: 9999px; padding: 12px; box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </div>
        <div style="margin-top: 4px; font-size: 12px; font-weight: 500; background: hsl(var(--background)); padding: 4px 8px; border-radius: 4px; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); border: 1px solid hsl(var(--border));">
          Clinic
        </div>
      </div>
    `

    new mapboxgl.Marker({ element: el })
      .setLngLat([CLINIC_LOCATION.longitude, CLINIC_LOCATION.latitude])
      .addTo(map.current)

    // Wait for map to load before adding heatmap layer
    // Wait for map to load before adding heatmap layer
    map.current.on('load', () => {
      if (!map.current) return

      // Add heatmap source
      map.current.addSource('patients', {
        type: 'geojson',
        data: heatmapData,
      })

      // Add heatmap layer
      map.current.addLayer({
        id: 'patient-heatmap',
        type: 'heatmap',
        source: 'patients',
        maxzoom: 15,
        paint: {
          // Reduce weight significantly for less intense clusters
          'heatmap-weight': 0.4,

          // Much lower intensity for smoother appearance
          'heatmap-intensity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0,
            0.15,
            15,
            0.4,
          ],

          // Adjusted color ramp - red appears much later in the density scale
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(33,102,172,0)', // Transparent dark blue
            0.2,
            'rgba(103,169,207,0.3)', // Light blue with low opacity
            0.4,
            'rgba(209,229,240,0.5)', // Very light blue
            0.6,
            'rgba(253,219,199,0.6)', // Peach/light orange
            0.75,
            'rgba(239,138,98,0.7)', // Medium orange
            0.85,
            'rgba(253,141,60,0.8)', // Orange
            0.92,
            'rgba(227,74,51,0.85)', // Red-orange
            0.97,
            'rgba(189,0,38,0.9)', // Deep red
            1,
            'rgba(178,24,43,1)', // Darkest red only at absolute peak
          ],

          // Significantly increase radius for much more blur/spread
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0,
            50, // Much larger at low zoom
            10,
            80,
            15,
            120, // Even larger at high zoom
          ],

          // Higher opacity for better visibility but still smooth
          'heatmap-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7,
            0.9,
            15,
            0.6,
          ],
        },
      })

      // Add circle layer for individual points at high zoom
      map.current.addLayer({
        id: 'patient-points',
        type: 'circle',
        source: 'patients',
        minzoom: 13,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 3, 15, 6],
          'circle-color': 'rgb(227,74,51)',
          'circle-stroke-color': 'white',
          'circle-stroke-width': 1,
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14, 1],
        },
      })
    })
    // Cleanup
    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [mapboxToken, heatmapData])

  if (!mapboxToken) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Patient Locations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[400px] items-center justify-center text-muted-foreground">
            Mapbox token not configured. Please set VITE_MAPBOX_TOKEN
            environment variable.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Patient Locations</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div ref={mapContainer} className="h-[400px] w-full rounded-b-lg" />
      </CardContent>
    </Card>
  )
}
