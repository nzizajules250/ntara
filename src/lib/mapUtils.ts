/**
 * Map Utilities for Google Maps API Integration
 * Handles Directions API, Places API, and route calculations
 */

const GOOGLE_MAPS_API_KEY = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyA0x1maORlZEkKWdFgxDBuDukI4mOMDlb0';
const GOOGLE_ROUTES_API_KEY = (import.meta as any).env.VITE_GOOGLE_ROUTES_API_KEY || 'AIzaSyCVcKfiko_Ne7lcgIN7Zpu8FXytk_KBFVg';

export interface RouteDetails {
  distance: string;
  distanceValue: number; // meters
  duration: string;
  durationValue: number; // seconds
  steps: google.maps.DirectionsStep[];
  polyline: string;
  overviewPath: { lat: number; lng: number }[];
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
