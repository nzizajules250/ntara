import { GoogleMap, InfoWindowF, CircleF, useJsApiLoader, PolylineF, MarkerF } from '@react-google-maps/api';
import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { UserProfile } from '../lib/firebase';
import { Satellite, Map as MapIcon, Search, MapPin } from 'lucide-react';

interface MapMarker {
  id: string;
  position: { lat: number; lng: number };
  label: string;
  type: 'passenger' | 'rider' | 'nearby' | 'destination' | 'place';
  profile?: UserProfile;
  placeId?: string;
  icon?: string;
}

interface MapRoute {
  id: string;
  points: { lat: number; lng: number }[];
  color?: string;
  label?: string;
  distance?: number;
  duration?: number;
}

interface Place {
  placeId: string;
  name: string;
  position: { lat: number; lng: number };
  address: string;
  type: string;
  rating?: number;
}

interface MapDirectionsRequest {
  id: string;
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  waypoints?: { lat: number; lng: number }[];
  color?: string;
}

interface MapComponentProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  markers: MapMarker[];
  routes?: MapRoute[];
  directionRequests?: MapDirectionsRequest[];
  autoFit?: boolean;
  freezeViewport?: boolean;
  showNearbyDrivers?: boolean;
  showPlaces?: boolean;
  placeTypes?: string[];
  onMarkerClick?: (marker: MapMarker) => void;
  onMapClick?: (position: { lat: number; lng: number }) => void;
  onPlaceSelected?: (place: Place) => void;
  height?: string;
  showMapTypeControl?: boolean;
}

const GOOGLE_MAPS_API_KEY = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyA0x1maORlZEkKWdFgxDBuDukI4mOMDlb0';
const GOOGLE_MAPS_MAP_ID = (import.meta as any).env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';
const GOOGLE_ROUTES_API_KEY = (import.meta as any).env.VITE_GOOGLE_ROUTES_API_KEY || '';
const MAP_LIBRARIES: ('marker' | 'places')[] = ['marker', 'places'];

const defaultCenter = { lat: 51.5074, lng: -0.1278 }; // London

type AdvancedMarkerInstance = {
  marker: google.maps.marker.AdvancedMarkerElement;
  listener: google.maps.MapsEventListener;
};

export default function MapComponent({
  center = defaultCenter,
  zoom = 14,
  markers = [],
  routes = [],
  directionRequests = [],
  autoFit = false,
  freezeViewport = false,
  showNearbyDrivers = true,
  showPlaces = false,
  placeTypes = ['restaurant', 'cafe', 'gas_station'],
  onMarkerClick,
  onMapClick,
  onPlaceSelected,
  height = '400px',
  showMapTypeControl = true
}: MapComponentProps) {
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid'>('hybrid');
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [cameraCenter, setCameraCenter] = useState(center);
  const [cameraZoom, setCameraZoom] = useState(zoom);
  const [generatedRoutes, setGeneratedRoutes] = useState<MapRoute[]>([]);
  const [nearbyPlaces, setNearbyPlaces] = useState<MapMarker[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const advancedMarkersRef = useRef<AdvancedMarkerInstance[]>([]);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const directionsKey = JSON.stringify(directionRequests);
  const centerKey = JSON.stringify(center);
  const markersKey = JSON.stringify(markers.map((marker) => ({
    id: marker.id,
    position: marker.position
  })));
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'ntwara-google-maps-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: MAP_LIBRARIES,
    mapIds: [GOOGLE_MAPS_MAP_ID]
  });

  const getMarkerColor = (type: string) => {
    switch (type) {
      case 'passenger':
        return '#2563eb';
      case 'rider':
        return '#16a34a';
      case 'nearby':
        return '#eab308';
      case 'destination':
        return '#dc2626';
      case 'place':
        return '#8b5cf6';
      default:
        return '#dc2626';
    }
  };

  const getMarkerGlyph = (type: MapMarker['type']) => {
    switch (type) {
      case 'passenger':
        return 'P';
      case 'rider':
        return 'R';
      case 'nearby':
        return 'N';
      case 'destination':
        return 'D';
      case 'place':
        return '📍';
      default:
        return '';
    }
  };

  // Initialize Places Service
  useEffect(() => {
    if (isLoaded && map && window.google?.maps?.places?.PlacesService) {
      placesServiceRef.current = new window.google.maps.places.PlacesService(map);
      directionsServiceRef.current = new window.google.maps.DirectionsService();
      autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
    }
  }, [isLoaded, map]);

  // Search nearby places
  const searchNearbyPlacesHandler = useCallback(async () => {
    if (!isLoaded || !map || !placesServiceRef.current || placeTypes.length === 0) {
      return;
    }

    try {
      const mapCenter = map.getCenter();
      if (!mapCenter) return;

      const allPlaces: MapMarker[] = [];

      for (const placeType of placeTypes) {
        await new Promise<void>((resolve) => {
          placesServiceRef.current?.nearbySearch(
            {
              location: { lat: mapCenter.lat(), lng: mapCenter.lng() },
              radius: 5000,
              type: placeType
            },
            (results, status) => {
              if (
                status === window.google.maps.places.PlacesServiceStatus.OK &&
                results
              ) {
                const places = results.slice(0, 3).map((place, idx) => ({
                  id: `place-${placeType}-${idx}`,
                  position: {
                    lat: place.geometry?.location?.lat() || 0,
                    lng: place.geometry?.location?.lng() || 0
                  },
                  label: place.name || '',
                  type: 'place' as const,
                  placeId: place.place_id || '',
                  icon: place.types?.[0] || ''
                }));
                allPlaces.push(...places);
              }
              resolve();
            }
          );
        });
      }

      setNearbyPlaces(allPlaces);
    } catch (error) {
      console.error('Error searching nearby places:', error);
    }
  }, [isLoaded, map, placeTypes]);

  // Auto-search places when map center changes
  useEffect(() => {
    if (showPlaces && map) {
      const delayTimer = setTimeout(() => {
        searchNearbyPlacesHandler();
      }, 1000);

      return () => clearTimeout(delayTimer);
    }
  }, [showPlaces, map, searchNearbyPlacesHandler]);

  const handleMarkerClick = (marker: MapMarker) => {
    setSelectedMarker(marker);
    onMarkerClick?.(marker);
    if (marker.type === 'place' && onPlaceSelected) {
      onPlaceSelected({
        placeId: marker.placeId || '',
        name: marker.label,
        position: marker.position,
        address: marker.label,
        type: marker.icon || '',
        rating: undefined
      });
    }
  };

  // Handle text search with autocomplete
  const handlePlaceSearch = useCallback(async (query: string) => {
    if (!query || !map || !placesServiceRef.current) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // First get autocomplete suggestions
    if (autocompleteServiceRef.current) {
      try {
        const predictions = await autocompleteServiceRef.current.getPlacePredictions({
          input: query,
          componentRestrictions: { country: ['rw', 'ug', 'ke', 'tz'] }
        });
        setSearchSuggestions(predictions.predictions || []);
        setShowSuggestions(true);
      } catch (error) {
        console.error('Error getting autocomplete suggestions:', error);
      }
    }

    // Then do text search
    setIsSearching(true);
    try {
      const mapCenter = map.getCenter();
      await new Promise<void>((resolve) => {
        placesServiceRef.current?.textSearch(
          {
            query,
            location: mapCenter ? { lat: mapCenter.lat(), lng: mapCenter.lng() } : undefined,
            radius: 5000
          },
          (results, status) => {
            if (
              status === window.google.maps.places.PlacesServiceStatus.OK &&
              results
            ) {
              const searchResults = results.map((place, idx) => ({
                id: `search-${idx}`,
                position: {
                  lat: place.geometry?.location?.lat() || 0,
                  lng: place.geometry?.location?.lng() || 0
                },
                label: place.name || '',
                type: 'place' as const,
                placeId: place.place_id || '',
                icon: place.types?.[0] || ''
              }));
              setNearbyPlaces(searchResults);
              setShowSuggestions(false);
            }
            setIsSearching(false);
            resolve();
          }
        );
      });
    } catch (error) {
      console.error('Error in place search:', error);
      setIsSearching(false);
    }
  }, [map]);

  // Handle suggestion click
  const handleSuggestionClick = useCallback(
    async (prediction: google.maps.places.AutocompletePrediction) => {
      if (!placesServiceRef.current) return;

      setIsSearching(true);
      setShowSuggestions(false);

      // Get place details
      await new Promise<void>((resolve) => {
        placesServiceRef.current?.getDetails(
          {
            placeId: prediction.place_id,
            fields: ['geometry', 'name', 'formatted_address', 'types']
          },
          (place, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
              const placeMarker: MapMarker = {
                id: `selected-place-${prediction.place_id}`,
                position: {
                  lat: place.geometry.location.lat(),
                  lng: place.geometry.location.lng()
                },
                label: place.name || prediction.main_text,
                type: 'place',
                placeId: prediction.place_id,
                icon: place.types?.[0] || ''
              };

              setNearbyPlaces([placeMarker]);
              handleMarkerClick(placeMarker);

              // Center map on place
              if (map) {
                map.setCenter(placeMarker.position);
                map.setZoom(17);
              }

              // Call callback
              if (onPlaceSelected) {
                onPlaceSelected({
                  placeId: prediction.place_id,
                  name: place.name || prediction.main_text,
                  position: placeMarker.position,
                  address: place.formatted_address || '',
                  type: place.types?.[0] || '',
                  rating: undefined
                });
              }
            }
            setIsSearching(false);
            resolve();
          }
        );
      });
    },
    [map, onPlaceSelected]
  );

  useEffect(() => {
    if (!freezeViewport) {
      setCameraCenter(center);
    }
  }, [freezeViewport, centerKey]);

  useEffect(() => {
    if (!freezeViewport) {
      setCameraZoom(zoom);
    }
  }, [freezeViewport, zoom]);

  useEffect(() => {
    advancedMarkersRef.current.forEach(({ marker, listener }) => {
      listener.remove();
      marker.map = null;
    });
    advancedMarkersRef.current = [];

    if (!isLoaded || !map || !window.google?.maps?.marker?.AdvancedMarkerElement || !window.google?.maps?.marker?.PinElement) {
      return;
    }

    const { AdvancedMarkerElement, PinElement } = window.google.maps.marker;

    advancedMarkersRef.current = markers.map((markerData) => {
      const pin = new PinElement({
        background: getMarkerColor(markerData.type),
        borderColor: '#111827',
        glyphColor: '#ffffff',
        glyph: getMarkerGlyph(markerData.type),
        scale: markerData.type === 'destination' ? 1.1 : 1
      });

      const advancedMarker = new AdvancedMarkerElement({
        map,
        position: markerData.position,
        title: markerData.label,
        content: pin.element
      });

      const listener = advancedMarker.addListener('click', () => handleMarkerClick(markerData));

      return {
        marker: advancedMarker,
        listener
      };
    });

    return () => {
      advancedMarkersRef.current.forEach(({ marker, listener }) => {
        listener.remove();
        marker.map = null;
      });
      advancedMarkersRef.current = [];
    };
  }, [isLoaded, map, markers, onMarkerClick]);

  useEffect(() => {
    let cancelled = false;

    if (!isLoaded || !window.google?.maps?.DirectionsService) {
      setGeneratedRoutes([]);
      return;
    }

    const validRequests = directionRequests.filter((request) =>
      Number.isFinite(request.origin.lat) &&
      Number.isFinite(request.origin.lng) &&
      Number.isFinite(request.destination.lat) &&
      Number.isFinite(request.destination.lng)
    );

    if (validRequests.length === 0) {
      setGeneratedRoutes([]);
      return;
    }

    const directionsService = new window.google.maps.DirectionsService();

    Promise.all(
      validRequests.map(async (request) => {
        const result = await directionsService.route({
          origin: request.origin,
          destination: request.destination,
          waypoints: request.waypoints?.map((point) => ({
            location: point,
            stopover: true
          })),
          travelMode: window.google.maps.TravelMode.DRIVING,
          optimizeWaypoints: true
        });

        if (!result.routes[0]) {
          return null;
        }

        const overviewPath = result.routes[0]?.overview_path ?? [];
        const leg = result.routes[0].legs[0];

        return {
          id: request.id,
          color: request.color,
          points: overviewPath.map((point) => ({
            lat: point.lat(),
            lng: point.lng()
          })),
          distance: leg?.distance?.value || 0,
          duration: leg?.duration?.value || 0
        } as MapRoute;
      })
    )
      .then((nextRoutes) => {
        if (!cancelled) {
          setGeneratedRoutes(nextRoutes.filter((route): route is MapRoute => route !== null && route.points.length > 0));
        }
      })
      .catch((error) => {
        console.error('Error generating map directions:', error);
        if (!cancelled) {
          setGeneratedRoutes([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, directionsKey]);

  const displayedRoutes = [...routes, ...generatedRoutes];
  const displayedRoutesKey = JSON.stringify(
    displayedRoutes.map((route) => ({
      id: route.id,
      color: route.color,
      points: route.points
    }))
  );

  useEffect(() => {
    if (!autoFit || !map || !window.google?.maps) {
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    let hasBounds = false;

    markers.forEach((marker) => {
      bounds.extend(marker.position);
      hasBounds = true;
    });

    displayedRoutes.forEach((route) => {
      route.points.forEach((point) => {
        bounds.extend(point);
        hasBounds = true;
      });
    });

    if (!hasBounds) {
      return;
    }

    const shouldFitBounds =
      markers.length + displayedRoutes.reduce((count, route) => count + route.points.length, 0) > 1;

    if (shouldFitBounds) {
      map.fitBounds(bounds, 64);
    }
  }, [autoFit, map, markersKey, displayedRoutesKey]);

  if (loadError) {
    return (
      <div
        className="flex items-center justify-center rounded-[1.5rem] bg-gray-100 text-sm text-gray-500"
        style={{ height }}
      >
        Unable to load Google Maps right now.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div
        className="flex items-center justify-center rounded-[1.5rem] bg-gray-100 text-sm text-gray-500"
        style={{ height }}
      >
        Loading map...
      </div>
    );
  }

  return (
    <div className="relative" style={{ height }}>
      {/* Place Search Bar with Autocomplete */}
      {showPlaces && (
        <div className="absolute top-4 left-4 z-20 w-80">
          <div className="flex items-center gap-2 bg-white rounded-xl shadow-lg p-3">
            <Search className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search places..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                handlePlaceSearch(e.target.value);
              }}
              onFocus={() => searchQuery && setShowSuggestions(true)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handlePlaceSearch(searchQuery);
                }
              }}
              className="flex-1 text-sm outline-none bg-transparent"
            />
            {isSearching && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />}
          </div>

          {/* Autocomplete Suggestions */}
          {showSuggestions && searchSuggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-30"
            >
              {searchSuggestions.slice(0, 5).map((suggestion) => (
                <button
                  key={suggestion.place_id}
                  onClick={() => {
                    setSearchQuery(suggestion.main_text);
                    handleSuggestionClick(suggestion);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                >
                  <p className="text-sm font-medium text-gray-900">{suggestion.main_text}</p>
                  <p className="text-xs text-gray-500">{suggestion.secondary_text}</p>
                </button>
              ))}
            </motion.div>
          )}
        </div>
      )}

      {/* Show Routes Button */}
      {(directionRequests.length > 0 || displayedRoutes.length > 0) && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-full shadow-lg px-4 py-2 flex items-center gap-2"
          >
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold text-gray-700">
              🛣️ {displayedRoutes.length} Route{displayedRoutes.length !== 1 ? 's' : ''} Showing
            </span>
          </motion.div>
        </div>
      )}

      {/* Map Type Controls */}
      {showMapTypeControl && (
        <div className="absolute top-4 right-4 z-10 flex gap-2 bg-white rounded-2xl shadow-lg p-2">
          <button
            onClick={() => setMapType('roadmap')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              mapType === 'roadmap'
                ? 'bg-black text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } flex items-center gap-1`}
          >
            <MapIcon className="w-4 h-4" />
            Map
          </button>
          <button
            onClick={() => setMapType('hybrid')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              mapType === 'hybrid'
                ? 'bg-black text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } flex items-center gap-1`}
          >
            <Satellite className="w-4 h-4" />
            Hybrid
          </button>
          <button
            onClick={() => setMapType('satellite')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              mapType === 'satellite'
                ? 'bg-black text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } flex items-center gap-1`}
          >
            <Satellite className="w-4 h-4" />
            Satellite
          </button>
        </div>
      )}

      {/* Route Information Panel */}
      {generatedRoutes.length > 0 && (
        <div className="absolute bottom-4 left-4 z-10 bg-white rounded-xl shadow-lg p-4 max-w-xs">
          <h3 className="font-bold text-sm mb-2 text-gray-900">Routes</h3>
          {generatedRoutes.map((route) => (
            <div key={route.id} className="text-xs text-gray-700 mb-2 pb-2 border-b last:border-b-0">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: route.color || '#3b82f6' }} />
                <span className="font-medium">{route.label || 'Route'}</span>
              </div>
              {route.distance && (
                <p className="text-gray-600 mt-1">
                  📏 {(route.distance / 1000).toFixed(1)}km • ⏱️ {Math.ceil(route.duration! / 60)}min
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      <GoogleMap
        onLoad={(mapInstance) => setMap(mapInstance)}
        onUnmount={() => setMap(null)}
        onClick={(event) => {
          if (!event.latLng || !onMapClick) return;
          onMapClick({
            lat: event.latLng.lat(),
            lng: event.latLng.lng()
          });
        }}
        onCenterChanged={() => {
          if (showPlaces && map) {
            const delayTimer = setTimeout(() => {
              searchNearbyPlacesHandler();
            }, 1500);
            return () => clearTimeout(delayTimer);
          }
        }}
        mapContainerStyle={{
          width: '100%',
          height: '100%',
          borderRadius: '1.5rem'
        }}
        center={cameraCenter}
        zoom={cameraZoom}
        mapTypeId={mapType}
        options={{
          mapId: GOOGLE_MAPS_MAP_ID,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          fullscreenControl: true,
          streetViewControl: false,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }]
            }
          ]
        }}
      >
        {/* Show nearby drivers radius circle */}
        {showNearbyDrivers && (
          <CircleF
            center={center}
            radius={10000}
            options={{
              fillColor: '#10b981',
              fillOpacity: 0.1,
              strokeColor: '#10b981',
              strokeOpacity: 0.3,
              strokeWeight: 1,
              editable: false,
              draggable: false
            }}
          />
        )}

        {/* Routes/Polylines */}
        {displayedRoutes.map((route) => (
          <PolylineF
            key={route.id}
            path={route.points}
            options={{
              strokeColor: route.color || '#3b82f6',
              strokeOpacity: 0.7,
              strokeWeight: 3,
              geodesic: true,
              clickable: false
            }}
          />
        ))}

        {/* Place Markers from nearby places search */}
        {nearbyPlaces.map((place) => (
          <MarkerF
            key={place.id}
            position={place.position}
            onClick={() => handleMarkerClick(place)}
            options={{
              icon: {
                path: window.google?.maps?.SymbolPath?.CIRCLE || '',
                scale: 8,
                fillColor: getMarkerColor(place.type),
                fillOpacity: 0.8,
                strokeColor: '#ffffff',
                strokeWeight: 2
              }
            }}
            title={place.label}
          />
        ))}

        {/* InfoWindow for selected marker */}
        {selectedMarker && (
          <InfoWindowF
            position={selectedMarker.position}
            onCloseClick={() => setSelectedMarker(null)}
          >
            <div className="bg-white rounded-lg p-3 shadow-lg max-w-xs">
              <p className="font-bold text-gray-900 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {selectedMarker.label}
              </p>
              {selectedMarker.type === 'place' && (
                <p className="text-xs text-gray-500 mt-1">📍 {selectedMarker.icon}</p>
              )}
              {selectedMarker.profile && selectedMarker.profile.rating && (
                <p className="text-sm text-amber-600 mt-1">⭐ {selectedMarker.profile.rating}</p>
              )}
              {selectedMarker.profile && selectedMarker.profile.phoneNumber && (
                <a
                  href={`tel:${selectedMarker.profile.phoneNumber}`}
                  className="text-blue-600 text-sm hover:underline mt-2 block"
                >
                  📞 Call
                </a>
              )}
            </div>
          </InfoWindowF>
        )}
      </GoogleMap>
    </div>
  );
}