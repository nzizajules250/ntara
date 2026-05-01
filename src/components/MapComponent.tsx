import { GoogleMap, InfoWindowF, CircleF, useJsApiLoader, PolylineF, MarkerF } from '@react-google-maps/api';
import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../lib/firebase';
import { Satellite, Map as MapIcon, Search, MapPin, Navigation, Clock, Route, ChevronDown, ChevronUp, AlertTriangle, Car, Bike, Footprints } from 'lucide-react';

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
  summary?: string;
  warnings?: string[];
  isActive?: boolean;
  steps?: RouteStep[];
}

interface RouteStep {
  instructions: string;
  distance: string;
  duration: string;
  maneuver?: string;
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
  travelMode?: google.maps.TravelMode;
  provideRouteAlternatives?: boolean;
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
  onRouteSelected?: (route: MapRoute) => void;
  onRoutesGenerated?: (routes: MapRoute[]) => void;
  height?: string;
  showMapTypeControl?: boolean;
  showRouteControls?: boolean;
}

const GOOGLE_MAPS_API_KEY = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyDD3klnDaCOHb2HoUFSPeiumFZxMneuA10';
const GOOGLE_MAPS_MAP_ID = (import.meta as any).env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';
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
  onRouteSelected,
  height = '400px',
  showMapTypeControl = true,
  showRouteControls = true,
  onRoutesGenerated
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
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const [showRouteSteps, setShowRouteSteps] = useState(false);
  const [selectedTravelMode, setSelectedTravelMode] = useState<google.maps.TravelMode>('DRIVING' as google.maps.TravelMode);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [showRouteAlternatives, setShowRouteAlternatives] = useState(true);
  const [trafficLayer, setTrafficLayer] = useState<google.maps.TrafficLayer | null>(null);
  const [showTraffic, setShowTraffic] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [is3DMode, setIs3DMode] = useState(true); // Default to 3D mode if possible
  
  const advancedMarkersRef = useRef<AdvancedMarkerInstance[]>([]);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  
  const directionsKey = JSON.stringify(directionRequests.map(dr => ({
    ...dr,
    travelMode: dr.travelMode || selectedTravelMode,
    provideRouteAlternatives: dr.provideRouteAlternatives ?? showRouteAlternatives
  })));
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

  // Traffic layer management
  useEffect(() => {
    if (!isLoaded || !map || !window.google?.maps) return;

    if (showTraffic && !trafficLayer) {
      const layer = new window.google.maps.TrafficLayer();
      layer.setMap(map);
      setTrafficLayer(layer);
    } else if (!showTraffic && trafficLayer) {
      trafficLayer.setMap(null);
      setTrafficLayer(null);
    }
  }, [showTraffic, map, isLoaded]);

  const handleLocateMe = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(pos);
          if (map) {
            map.panTo(pos);
            map.setZoom(17);
            if (is3DMode) {
              map.setTilt(45);
              map.setHeading(90);
            }
          }
        },
        () => {
          console.error('Error: The Geolocation service failed.');
        }
      );
    } else {
      console.error("Error: Your browser doesn't support geolocation.");
    }
  }, [map, is3DMode]);

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

  // Route color palette for alternatives
  const getRouteColor = (index: number, baseColor?: string): string => {
    if (index === 0) return baseColor || '#3b82f6';
    const alternativeColors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b'];
    return alternativeColors[(index - 1) % alternativeColors.length];
  };

  // Format distance
  const formatDistance = (meters: number): string => {
    if (meters < 1000) return `${meters}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  // Format duration
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}min`;
    return `${minutes}min`;
  };

  const requestDirections = useCallback(
    async (
      directionsService: google.maps.DirectionsService,
      request: MapDirectionsRequest,
      travelMode: google.maps.TravelMode,
      provideAlternatives: boolean
    ) => {
      const routeRequest: google.maps.DirectionsRequest = {
        origin: request.origin,
        destination: request.destination,
        waypoints: request.waypoints?.map((point) => ({
          location: point,
          stopover: true
        })),
        travelMode,
        optimizeWaypoints: true,
        provideRouteAlternatives: provideAlternatives
      };

      try {
        return await directionsService.route(routeRequest);
      } catch (error) {
        const shouldFallbackToDriving =
          travelMode === window.google.maps.TravelMode.BICYCLING ||
          travelMode === ('BICYCLING' as google.maps.TravelMode);

        if (!shouldFallbackToDriving) {
          throw error;
        }

        console.warn('Bicycling directions unavailable, retrying with driving directions.', error);
        return directionsService.route({
          ...routeRequest,
          travelMode: window.google.maps.TravelMode.DRIVING
        });
      }
    },
    []
  );

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
                label: place.name || prediction.structured_formatting?.main_text || prediction.description,
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
                  name: place.name || prediction.structured_formatting?.main_text || prediction.description,
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

  // Handle route selection
  const handleRouteSelect = (routeId: string) => {
    setActiveRouteId(routeId === activeRouteId ? null : routeId);
    const selectedRoute = generatedRoutes.find(r => r.id === routeId);
    if (selectedRoute && onRouteSelected) {
      onRouteSelected(selectedRoute);
    }
    if (selectedRoute?.steps && selectedRoute.steps.length > 0) {
      setShowRouteSteps(true);
    }
  };

  // Clear route selection
  const clearRouteSelection = () => {
    setActiveRouteId(null);
    setShowRouteSteps(false);
  };

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
        glyphText: getMarkerGlyph(markerData.type),
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

  // Enhanced route generation with alternatives and step-by-step directions
  useEffect(() => {
    let cancelled = false;

    if (!isLoaded || !window.google?.maps?.DirectionsService) {
      setIsLoadingRoutes(false);
      setGeneratedRoutes([]);
      return;
    }

    const hasValidPoint = (point: { lat: number; lng: number }) =>
      Number.isFinite(point.lat) &&
      Number.isFinite(point.lng) &&
      (point.lat !== 0 || point.lng !== 0);

    const validRequests = directionRequests.filter((request) =>
      hasValidPoint(request.origin) &&
      hasValidPoint(request.destination) &&
      (request.origin.lat !== request.destination.lat ||
        request.origin.lng !== request.destination.lng)
    );

    if (validRequests.length === 0) {
      setIsLoadingRoutes(false);
      setActiveRouteId(null);
      setGeneratedRoutes([]);
      return;
    }

    const directionsService = new window.google.maps.DirectionsService();
    setIsLoadingRoutes(true);

    Promise.all(
      validRequests.map(async (request) => {
        const travelMode = request.travelMode || selectedTravelMode;
        const provideAlternatives = request.provideRouteAlternatives ?? showRouteAlternatives;

        const result = await requestDirections(
          directionsService,
          request,
          travelMode,
          provideAlternatives
        );

        if (!result || result.routes.length === 0) {
          return [];
        }

        // Process all routes (including alternatives)
        return result.routes.map((route, routeIndex) => {
          const overviewPath = route.overview_path ?? [];
          const leg = route.legs[0];
          
          // Extract step-by-step directions
          const steps: RouteStep[] = (leg?.steps || []).map(step => ({
            instructions: step.instructions || '',
            distance: step.distance?.text || '',
            duration: step.duration?.text || '',
            maneuver: step.maneuver || ''
          }));

          return {
            id: routeIndex === 0 ? request.id : `${request.id}-alt-${routeIndex}`,
            color: getRouteColor(routeIndex, request.color),
            points: overviewPath.map((point) => ({
              lat: point.lat(),
              lng: point.lng()
            })),
            distance: leg?.distance?.value || 0,
            duration: leg?.duration?.value || 0,
            summary: route.summary || '',
            warnings: route.warnings || [],
            steps: steps,
            label: routeIndex === 0 ? 'Fastest Route' : `Alternative ${routeIndex}`,
            isActive: false
          } as MapRoute;
        });
      })
    )
      .then((routeArrays) => {
        if (!cancelled) {
          // Flatten array of arrays and filter valid routes
          const allRoutes = routeArrays
            .flat()
            .filter((route): route is MapRoute => 
              route !== null && route.points.length > 0
            );
          
          // Sort by duration (fastest first)
          allRoutes.sort((a, b) => (a.duration || 0) - (b.duration || 0));
          
          setGeneratedRoutes(allRoutes);

          if (allRoutes.length === 0) {
            setActiveRouteId(null);
            return;
          }

          const nextActiveRoute =
            allRoutes.find((route) => route.id === activeRouteId) || allRoutes[0];

          setActiveRouteId(nextActiveRoute.id);
          onRouteSelected?.(nextActiveRoute);
          onRoutesGenerated?.(allRoutes);
        }
      })
      .catch((error) => {
        console.error('Error generating map directions:', error);
        if (!cancelled) {
          setActiveRouteId(null);
          setGeneratedRoutes([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingRoutes(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, directionsKey, selectedTravelMode, showRouteAlternatives, activeRouteId, onRouteSelected, requestDirections]);

  const displayedRoutes = [...routes, ...generatedRoutes];
  const displayedRoutesKey = JSON.stringify(
    displayedRoutes.map((route) => ({
      id: route.id,
      color: route.color,
      points: route.points
    }))
  );

  // Active route for display
  const activeRoute = generatedRoutes.find(r => r.id === activeRouteId);

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

    // Only fit routes if there are active ones
    const activeRoutes = displayedRoutes.filter(r => r.isActive || r.id === activeRouteId);
    if (activeRoutes.length > 0) {
      activeRoutes.forEach((route) => {
        route.points.forEach((point) => {
          bounds.extend(point);
          hasBounds = true;
        });
      });
    }

    if (!hasBounds) {
      return;
    }

    const shouldFitBounds =
      markers.length + activeRoutes.reduce((count, route) => count + route.points.length, 0) > 1;

    if (shouldFitBounds) {
      map.fitBounds(bounds, 64);
    }
  }, [autoFit, map, markersKey, displayedRoutesKey, activeRouteId]);

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
    <div className="relative" style={{ height, touchAction: 'pan-x pan-y' }}>
      {/* Place Search Bar with Autocomplete */}
      {showPlaces && (
        <div className="absolute top-4 left-4 z-20 w-80">
          <div className="flex items-center gap-2 rounded-xl bg-white/95 p-3 shadow-lg backdrop-blur-sm dark:bg-zinc-900/95 dark:shadow-black/30">
            <Search className="w-4 h-4 flex-shrink-0 text-gray-500 dark:text-zinc-400" />
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
              className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-zinc-500"
            />
            {isSearching && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />}
          </div>

          {/* Autocomplete Suggestions */}
          <AnimatePresence>
            {showSuggestions && searchSuggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 z-30 mt-2 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
              >
                {searchSuggestions.slice(0, 5).map((suggestion) => (
                  <button
                    key={suggestion.place_id}
                    onClick={() => {
                      setSearchQuery(suggestion.structured_formatting?.main_text || suggestion.description);
                      handleSuggestionClick(suggestion);
                    }}
                    className="w-full border-b border-gray-100 px-4 py-3 text-left transition-colors hover:bg-blue-50 dark:border-zinc-800 dark:hover:bg-zinc-800 last:border-b-0"
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{suggestion.structured_formatting?.main_text || suggestion.description}</p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400">{suggestion.structured_formatting?.secondary_text || suggestion.description}</p>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Route Controls Panel */}
      {showRouteControls && directionRequests.length > 0 && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1 rounded-2xl bg-white/95 p-2 shadow-xl backdrop-blur-sm dark:bg-zinc-900/95 dark:shadow-black/30"
          >
            {/* Travel Mode Selection */}
            {[
              { mode: 'DRIVING' as google.maps.TravelMode, icon: Car, label: 'Drive' },
              { mode: 'WALKING' as google.maps.TravelMode, icon: Footprints, label: 'Walk' },
              { mode: 'BICYCLING' as google.maps.TravelMode, icon: Bike, label: 'Moto' }
            ].map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setSelectedTravelMode(mode)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  selectedTravelMode === mode
                    ? 'bg-blue-500 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}

            <div className="mx-1 h-6 w-px bg-gray-200 dark:bg-zinc-700" />

            {/* Route Alternatives Toggle */}
            <button
              onClick={() => setShowRouteAlternatives(!showRouteAlternatives)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                showRouteAlternatives
                  ? 'bg-purple-500 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              <Route className="w-3.5 h-3.5 inline mr-1" />
              {isLoadingRoutes
                ? 'Loading...'
                : generatedRoutes.length === 0
                  ? 'No route'
                  : generatedRoutes.length === 1
                    ? '1 Route'
                    : `${generatedRoutes.length} Routes`}
            </button>

            {/* Traffic Toggle */}
            <button
              onClick={() => setShowTraffic(!showTraffic)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                showTraffic
                  ? 'bg-red-500 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
              Traffic
            </button>
          </motion.div>
        </div>
      )}

      {/* Map Type Controls */}
      {showMapTypeControl && (
        <div className="absolute left-3 right-3 top-3 z-10 flex flex-wrap justify-end gap-2 rounded-2xl bg-white/95 p-2 shadow-lg backdrop-blur-sm dark:bg-zinc-900/95 dark:shadow-black/30 sm:left-auto sm:right-4 sm:top-4 sm:flex-nowrap sm:justify-start">
          <button
            onClick={handleLocateMe}
            className="px-3 py-2 rounded-lg text-[11px] font-bold transition-all bg-blue-500 text-white shadow-lg hover:bg-blue-600 flex items-center gap-1"
          >
            <MapPin className="w-4 h-4" />
            My Location
          </button>
          <button
            onClick={() => setIs3DMode(!is3DMode)}
            className={`px-3 py-2 rounded-lg text-[11px] font-bold transition-all ${
              is3DMode
                ? 'bg-purple-500 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
            } flex items-center gap-1`}
          >
            3D View
          </button>
          <button
            onClick={() => setMapType('roadmap')}
            className={`px-3 py-2 rounded-lg text-[11px] font-bold transition-all ${
              mapType === 'roadmap'
                ? 'bg-black text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
            } flex items-center gap-1`}
          >
            <MapIcon className="w-4 h-4" />
            Map
          </button>
          <button
            onClick={() => setMapType('hybrid')}
            className={`px-3 py-2 rounded-lg text-[11px] font-bold transition-all ${
              mapType === 'hybrid'
                ? 'bg-black text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
            } flex items-center gap-1`}
          >
            <Satellite className="w-4 h-4" />
            Hybrid
          </button>
          <button
            onClick={() => setMapType('satellite')}
            className={`px-3 py-2 rounded-lg text-[11px] font-bold transition-all ${
              mapType === 'satellite'
                ? 'bg-black text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
            } flex items-center gap-1`}
          >
            <Satellite className="w-4 h-4" />
            Satellite
          </button>
        </div>
      )}

      {/* Enhanced Route Information Panel */}
      {generatedRoutes.length > 0 && (
        <div className="absolute bottom-4 left-3 right-3 z-10 overflow-hidden rounded-2xl bg-white/95 shadow-xl backdrop-blur-sm dark:bg-zinc-900/95 dark:shadow-black/30 sm:left-4 sm:right-auto sm:max-w-sm">
          {/* Panel Header */}
          <div className="border-b border-gray-100 p-4 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
                <Route className="w-4 h-4 text-blue-500" />
                Available Routes
              </h3>
              <button
                onClick={clearRouteSelection}
                className="text-xs font-medium text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Route List */}
          <div className="max-h-64 overflow-y-auto">
            {generatedRoutes.map((route, index) => (
              <motion.button
                key={route.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => handleRouteSelect(route.id)}
                className={`w-full border-b border-gray-50 px-4 py-3 text-left transition-all dark:border-zinc-800 last:border-b-0 ${
                  route.id === activeRouteId
                    ? 'bg-blue-50 border-l-4 border-l-blue-500 dark:bg-blue-500/10'
                    : 'hover:bg-gray-50 border-l-4 border-l-transparent dark:hover:bg-zinc-800/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: route.color || '#3b82f6' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {route.label || `Route ${index + 1}`}
                      </span>
                      {index === 0 && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                          Fastest
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-zinc-400">
                      {route.distance && (
                        <span className="flex items-center gap-1">
                          <Navigation className="w-3 h-3" />
                          {formatDistance(route.distance)}
                        </span>
                      )}
                      {route.duration && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(route.duration)}
                        </span>
                      )}
                    </div>
                    {route.summary && (
                      <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">{route.summary}</p>
                    )}
                    {route.warnings && route.warnings.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 text-amber-600">
                        <AlertTriangle className="w-3 h-3" />
                        <span className="text-xs">{route.warnings[0]}</span>
                      </div>
                    )}
                  </div>
                  {route.id === activeRouteId && (
                    <ChevronDown className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  )}
                </div>

                {/* Expandable Route Steps */}
                <AnimatePresence>
                  {route.id === activeRouteId && showRouteSteps && route.steps && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-3 pt-3 border-t border-gray-100 overflow-hidden"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowRouteSteps(false);
                        }}
                        className="text-xs text-blue-500 font-medium mb-2 flex items-center gap-1"
                      >
                        <ChevronUp className="w-3 h-3" />
                        Hide directions
                      </button>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {route.steps.map((step, stepIndex) => (
                          <div key={stepIndex} className="flex items-start gap-2 text-xs">
                            <div className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="font-bold text-[10px]">{stepIndex + 1}</span>
                            </div>
                            <div className="flex-1">
                              <p 
                                className="text-gray-700 leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: step.instructions }}
                              />
                              <div className="flex items-center gap-2 mt-0.5 text-gray-400">
                                <span>{step.distance}</span>
                                <span>•</span>
                                <span>{step.duration}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            ))}
          </div>

          {/* Active Route Summary */}
          {activeRoute && !showRouteSteps && (
            <div className="p-4 bg-blue-50 border-t border-blue-100">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowRouteSteps(true);
                }}
                className="w-full text-center text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                Show step-by-step directions
              </button>
            </div>
          )}
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
          gestureHandling: 'greedy',
          draggable: true,
          scrollwheel: true,
          tilt: is3DMode ? 45 : 0,
          heading: is3DMode ? 90 : 0,
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

        {/* Routes/Polylines with enhanced styling */}
        {displayedRoutes.map((route) => (
          <PolylineF
            key={route.id}
            path={route.points}
            options={{
              strokeColor: route.color || '#3b82f6',
              strokeOpacity: route.id === activeRouteId ? 1 : 0.5,
              strokeWeight: route.id === activeRouteId ? 5 : 3,
              geodesic: true,
              clickable: true,
              zIndex: route.id === activeRouteId ? 10 : 1
            }}
          />
        ))}

        {/* User Location Marker */}
        {userLocation && (
          <MarkerF
            position={userLocation}
            options={{
              icon: {
                path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
                scale: 10,
                fillColor: '#3b82f6',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 3
              },
              zIndex: 100
            }}
            title="You are here"
          />
        )}

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
            <div className="max-w-xs rounded-lg bg-white p-3 shadow-lg dark:bg-zinc-900 dark:shadow-black/30">
              <p className="flex items-center gap-2 font-bold text-gray-900 dark:text-white">
                <MapPin className="w-4 h-4" />
                {selectedMarker.label}
              </p>
              {selectedMarker.type === 'place' && (
                <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">📍 {selectedMarker.icon}</p>
              )}
              {selectedMarker.profile && selectedMarker.profile.rating && (
                <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">⭐ {selectedMarker.profile.rating}</p>
              )}
              {selectedMarker.profile && selectedMarker.profile.phoneNumber && (
                <a
                  href={`tel:${selectedMarker.profile.phoneNumber}`}
                  className="mt-2 block text-sm text-blue-600 hover:underline dark:text-blue-400"
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
