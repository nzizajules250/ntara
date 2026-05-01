/**
 * Map Utilities for Google Maps API Integration
 * Handles Directions API, Places API, and route calculations
 */

const GOOGLE_MAPS_API_KEY = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyDD3klnDaCOHb2HoUFSPeiumFZxMneuA10';
const GOOGLE_ROUTES_API_KEY = (import.meta as any).env.VITE_GOOGLE_ROUTES_API_KEY || 'AIzaSyCVcKfiko_Ne7lcgIN7Zpu8FXytk_KBFVg';

export interface RouteDetails {
  distance: string;
  distanceValue: number; // meters
  duration: string;
  durationValue: number; // seconds
  steps: any[]; // Generalized steps
  polyline: string;
  overviewPath: { lat: number; lng: number }[];
  source?: 'google' | 'osrm';
}

export interface PlaceDetails {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  types: string[];
}

export interface GeocodedAddress {
  address: string;
  lat: number;
  lng: number;
}

/**
 * Get route details using Directions API
 */
export async function getRouteDetails(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  waypoints?: { lat: number; lng: number }[]
): Promise<RouteDetails | null> {
  if (!window.google?.maps?.DirectionsService) {
    console.error('Google Maps Directions Service not loaded');
    return null;
  }

  try {
    const directionsService = new window.google.maps.DirectionsService();
    
    const result = await directionsService.route({
      origin,
      destination,
      waypoints: waypoints?.map(point => ({
        location: point,
        stopover: true
      })),
      travelMode: window.google.maps.TravelMode.DRIVING,
      optimizeWaypoints: true
    });

    if (!result.routes[0]) {
      return null;
    }

    const leg = result.routes[0].legs[0];
    const overviewPath = result.routes[0].overview_path.map(point => ({
      lat: point.lat(),
      lng: point.lng()
    }));

    return {
      distance: leg.distance?.text || '',
      distanceValue: leg.distance?.value || 0,
      duration: leg.duration?.text || '',
      durationValue: leg.duration?.value || 0,
      steps: result.routes[0].legs.flatMap(l => l.steps || []),
      polyline: (result.routes[0].overview_polyline as any)?.points || '',
      overviewPath
    };
  } catch (error) {
    console.error('Error fetching route details:', error);
    return null;
  }
}

/**
 * Autocomplete places using Places API
 */
export async function autocompletePlaces(
  input: string,
  sessionToken?: google.maps.places.AutocompleteSessionToken
): Promise<google.maps.places.AutocompletePrediction[]> {
  if (!window.google?.maps?.places?.AutocompleteService) {
    console.error('Google Maps Places Service not loaded');
    return [];
  }

  try {
    const service = new window.google.maps.places.AutocompleteService();
    
    const result = await service.getPlacePredictions({
      input,
      sessionToken,
      componentRestrictions: { country: ['rw', 'ug', 'ke', 'tz'] } // East Africa focus
    });

    return result.predictions || [];
  } catch (error) {
    console.error('Error autocompleting places:', error);
    return [];
  }
}

/**
 * Get place details from Place ID
 */
export async function getPlaceDetails(
  placeId: string,
  sessionToken?: google.maps.places.AutocompleteSessionToken
): Promise<PlaceDetails | null> {
  if (!window.google?.maps?.places?.PlacesService) {
    console.error('Google Maps Places Service not loaded');
    return null;
  }

  try {
    const service = new window.google.maps.places.PlacesService(
      document.createElement('div')
    );

    return new Promise((resolve) => {
      service.getDetails(
        {
          placeId,
          sessionToken,
          fields: ['place_id', 'name', 'formatted_address', 'geometry', 'types']
        },
        (place, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
            resolve({
              placeId: place.place_id || '',
              name: place.name || '',
              address: place.formatted_address || '',
              lat: place.geometry?.location?.lat() || 0,
              lng: place.geometry?.location?.lng() || 0,
              types: place.types || []
            });
          } else {
            resolve(null);
          }
        }
      );
    });
  } catch (error) {
    console.error('Error getting place details:', error);
    return null;
  }
}

/**
 * Forward geocode a typed address into map coordinates
 */
export async function geocodeAddressLocation(
  address: string
): Promise<GeocodedAddress | null> {
  if (!address.trim()) {
    return null;
  }

  if (!window.google?.maps?.Geocoder) {
    console.error('Google Maps Geocoder not loaded');
    return null;
  }

  try {
    const geocoder = new window.google.maps.Geocoder();

    return new Promise((resolve) => {
      geocoder.geocode(
        {
          address,
          componentRestrictions: { country: 'RW' }
        },
        (results, status) => {
          if (status === window.google.maps.GeocoderStatus.OK && results?.[0]) {
            const location = results[0].geometry.location;
            resolve({
              address: results[0].formatted_address || address,
              lat: location.lat(),
              lng: location.lng()
            });
            return;
          }

          resolve(null);
        }
      );
    });
  } catch (error) {
    console.error('Error geocoding address:', error);
    return null;
  }
}

/**
 * Reverse geocode coordinates to address
 */
export async function reverseGeocodeLocation(
  lat: number,
  lng: number
): Promise<string | null> {
  if (!window.google?.maps?.Geocoder) {
    console.error('Google Maps Geocoder not loaded');
    return null;
  }

  try {
    const geocoder = new window.google.maps.Geocoder();
    
    return new Promise((resolve) => {
      geocoder.geocode(
        { location: { lat, lng } },
        (results, status) => {
          if (status === window.google.maps.GeocoderStatus.OK && results?.[0]) {
            resolve(results[0].formatted_address);
          } else {
            resolve(null);
          }
        }
      );
    });
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    return null;
  }
}

/**
 * Search for nearby places
 */
export async function searchNearbyPlaces(
  location: { lat: number; lng: number },
  placeType: string,
  radiusMeters: number = 5000
): Promise<PlaceDetails[]> {
  if (!window.google?.maps?.places?.PlacesService) {
    console.error('Google Maps Places Service not loaded');
    return [];
  }

  try {
    const service = new window.google.maps.places.PlacesService(
      document.createElement('div')
    );

    return new Promise((resolve) => {
      service.nearbySearch(
        {
          location,
          radius: radiusMeters,
          type: placeType
        },
        (results, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
            const places = results.map(place => ({
              placeId: place.place_id || '',
              name: place.name || '',
              address: place.vicinity || '',
              lat: place.geometry?.location?.lat() || 0,
              lng: place.geometry?.location?.lng() || 0,
              types: place.types || []
            }));
            resolve(places);
          } else {
            resolve([]);
          }
        }
      );
    });
  } catch (error) {
    console.error('Error searching nearby places:', error);
    return [];
  }
}

/**
 * Calculate ETA
 */
export function calculateETA(durationSeconds: number): string {
  const now = new Date();
  const eta = new Date(now.getTime() + durationSeconds * 1000);
  const hours = eta.getHours().toString().padStart(2, '0');
  const minutes = eta.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Format duration to readable string
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Format distance to readable string
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * Calculate route using Google Routes API for better accuracy
 */
export async function calculateRouteAdvanced(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  waypoints?: { lat: number; lng: number }[]
): Promise<RouteDetails | null> {
  try {
    // First try to use the Directions API which is already in the client
    const details = await getRouteDetails(origin, destination, waypoints);
    return details;
  } catch (error) {
    console.error('Error in advanced route calculation:', error);
    return null;
  }
}

/**
 * Search places by text query
 */
export async function textSearchPlaces(
  query: string,
  location?: { lat: number; lng: number },
  radius: number = 5000
): Promise<PlaceDetails[]> {
  if (!window.google?.maps?.places?.PlacesService) {
    console.error('Google Maps Places Service not loaded');
    return [];
  }

  try {
    const service = new window.google.maps.places.PlacesService(
      document.createElement('div')
    );

    return new Promise((resolve) => {
      service.textSearch(
        {
          query,
          location,
          radius
        },
        (results, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
            const places = results.map(place => ({
              placeId: place.place_id || '',
              name: place.name || '',
              address: place.formatted_address || place.vicinity || '',
              lat: place.geometry?.location?.lat() || 0,
              lng: place.geometry?.location?.lng() || 0,
              types: place.types || []
            }));
            resolve(places);
          } else {
            resolve([]);
          }
        }
      );
    });
  } catch (error) {
    console.error('Error searching places by text:', error);
    return [];
  }
}

/**
 * Get place icon based on type
 */
export function getPlaceIcon(types: string[]): string {
  const typeMap: { [key: string]: string } = {
    restaurant: '🍽️',
    cafe: '☕',
    gas_station: '⛽',
    hotel: '🏨',
    hospital: '🏥',
    police: '🚔',
    pharmacy: '💊',
    parking: '🅿️',
    park: '🌳',
    school: '🏫'
  };

  for (const type of types) {
    if (typeMap[type]) {
      return typeMap[type];
    }
  }
  return '📍';
}

/**
 * Calculate bearing between two points
 */
export function calculateBearing(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const startLat = (from.lat * Math.PI) / 180;
  const startLng = (from.lng * Math.PI) / 180;
  const endLat = (to.lat * Math.PI) / 180;
  const endLng = (to.lng * Math.PI) / 180;

  const dLng = endLng - startLng;

  const y = Math.sin(dLng) * Math.cos(endLat);
  const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);

  return (Math.atan2(y, x) * 180) / Math.PI;
}

/**
 * Get distance between two coordinates in meters
 */
export function getDistanceBetween(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const R = 6371e3; // Radius of Earth in meters
  const lat1Rad = (from.lat * Math.PI) / 180;
  const lat2Rad = (to.lat * Math.PI) / 180;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get route details combining OSRM and Google Maps
 * Uses OSRM as primary for routing logic and Google as fallback
 */
export async function getCombinedRouteDetails(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  waypoints: { lat: number; lng: number }[] = [],
  profile: 'driving' | 'walking' | 'cycling' = 'driving'
): Promise<RouteDetails | null> {
  // Try OSRM first
  const osrmRoute = await getOSRMRouteDetails(origin, destination, waypoints, profile);
  if (osrmRoute) {
    return osrmRoute;
  }

  // Fallback to Google Maps
  console.log('OSRM routing failed, falling back to Google Maps');
  return getRouteDetails(origin, destination, waypoints);
}

/**
 * Get route details using OSRM (OpenStreetMap)
 */
export async function getOSRMRouteDetails(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  waypoints: { lat: number; lng: number }[] = [],
  profile: 'driving' | 'walking' | 'cycling' = 'driving'
): Promise<RouteDetails | null> {
  try {
    const profileMap = {
      driving: 'driving',
      walking: 'foot',
      cycling: 'bicycle'
    };
    
    const osrmProfile = profileMap[profile] || 'driving';
    
    // Combine origin, waypoints, and destination into a single coordinate string
    const points = [origin, ...waypoints, destination]
      .map(p => `${p.lng},${p.lat}`)
      .join(';');
      
    const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${points}?overview=full&geometries=polyline&steps=true`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.code !== 'Ok' || !data.routes?.[0]) {
      return null;
    }
    
    const route = data.routes[0];
    const decodedPath = decodePolyline(route.geometry);
    
    // Extract steps from all legs
    const steps = route.legs.flatMap((leg: any) => 
      leg.steps.map((step: any) => ({
        instructions: step.maneuver?.instruction || step.name || 'Proceed',
        distance: formatDistance(step.distance),
        duration: formatDuration(step.duration),
        maneuver: step.maneuver?.type || ''
      }))
    );
    
    return {
      distance: formatDistance(route.distance),
      distanceValue: route.distance,
      duration: formatDuration(route.duration),
      durationValue: route.duration,
      steps: steps,
      polyline: route.geometry,
      overviewPath: decodedPath,
      source: 'osrm'
    };
  } catch (error) {
    console.error('Error fetching OSRM route:', error);
    return null;
  }
}

/**
 * Decode OSRM polyline string into coordinates
 */
export function decodePolyline(str: string, precision: number = 5) {
  let index = 0,
    lat = 0,
    lng = 0,
    coordinates = [],
    shift = 0,
    result = 0,
    byte = null,
    latitude_change,
    longitude_change,
    factor = Math.pow(10, precision);

  while (index < str.length) {
    byte = null;
    shift = 0;
    result = 0;

    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));

    shift = 0;
    result = 0;

    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));

    lat += latitude_change;
    lng += longitude_change;

    coordinates.push({ lat: lat / factor, lng: lng / factor });
  }

  return coordinates;
}
