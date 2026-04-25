import { GoogleMap, InfoWindowF, CircleF, useJsApiLoader, PolylineF } from '@react-google-maps/api';
import { useEffect, useRef, useState } from 'react';
import { UserProfile } from '../lib/firebase';
import { Satellite, Map as MapIcon, Layers, Compass, Maximize2, Minimize2 } from 'lucide-react';

interface MapMarker {
  id: string;
  position: { lat: number; lng: number };
  label: string;
  type: 'passenger' | 'rider' | 'nearby' | 'destination';
  profile?: UserProfile;
}

interface MapRoute {
  id: string;
  points: { lat: number; lng: number }[];
  color?: string;
  label?: string;
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
  onMarkerClick?: (marker: MapMarker) => void;
  onMapClick?: (position: { lat: number; lng: number }) => void;
  height?: string;
  showMapTypeControl?: boolean;
  fullscreen?: boolean;
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

const GOOGLE_MAPS_API_KEY = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyA0x1maORlZEkKWdFgxDBuDukI4mOMDlb0';
const GOOGLE_MAPS_MAP_ID = (import.meta as any).env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';
const MAP_LIBRARIES: ('marker')[] = ['marker'];

const defaultCenter = { lat: -1.9441, lng: 30.0619 }; // Kigali, Rwanda

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
  onMarkerClick,
  onMapClick,
  height = '400px',
  showMapTypeControl = true,
  fullscreen = false,
  onFullscreenChange
}: MapComponentProps) {
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid'>('hybrid');
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [cameraCenter, setCameraCenter] = useState(center);
  const [cameraZoom, setCameraZoom] = useState(zoom);
  const [isFullscreen, setIsFullscreen] = useState(fullscreen);
  const [generatedRoutes, setGeneratedRoutes] = useState<MapRoute[]>([]);
  const [showControls, setShowControls] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const advancedMarkersRef = useRef<AdvancedMarkerInstance[]>([]);
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
        return '#f97316';
      case 'rider':
        return '#10b981';
      case 'nearby':
        return '#eab308';
      case 'destination':
        return '#ef4444';
      default:
        return '#f97316';
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
      default:
        return '';
    }
  };

  const handleMarkerClick = (marker: MapMarker) => {
    setSelectedMarker(marker);
    onMarkerClick?.(marker);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const handleFullscreenChange = () => {
    const newFullscreen = !!document.fullscreenElement;
    setIsFullscreen(newFullscreen);
    onFullscreenChange?.(newFullscreen);
    
    // Delay resize to ensure fullscreen transition completes
    setTimeout(() => {
      if (map) {
        google.maps.event.trigger(map, 'resize');
        map.setCenter(cameraCenter);
        map.setZoom(cameraZoom);
      }
    }, 100);
  };

  const recenterMap = () => {
    if (map) {
      map.setCenter(center);
      map.setZoom(zoom);
    }
  };

  useEffect(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

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
        borderColor: '#1f2937',
        glyphColor: '#ffffff',
        glyph: getMarkerGlyph(markerData.type),
        scale: markerData.type === 'destination' ? 1.2 : 1
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
          travelMode: window.google.maps.TravelMode.DRIVING
        });

        const overviewPath = result.routes[0]?.overview_path ?? [];

        return {
          id: request.id,
          color: request.color,
          points: overviewPath.map((point) => ({
            lat: point.lat(),
            lng: point.lng()
          }))
        } as MapRoute;
      })
    )
      .then((nextRoutes) => {
        if (!cancelled) {
          setGeneratedRoutes(nextRoutes.filter((route) => route.points.length > 0));
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

  // Auto-hide controls after inactivity on mobile
  useEffect(() => {
    if (!containerRef.current) return;
    
    let timeoutId: NodeJS.Timeout;
    
    const handleUserInteraction = () => {
      setShowControls(true);
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    };
    
    const container = containerRef.current;
    container.addEventListener('touchstart', handleUserInteraction);
    container.addEventListener('mousedown', handleUserInteraction);
    
    return () => {
      container.removeEventListener('touchstart', handleUserInteraction);
      container.removeEventListener('mousedown', handleUserInteraction);
      clearTimeout(timeoutId);
    };
  }, []);

  if (loadError) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl bg-gray-100/90 dark:bg-gray-800/90 backdrop-blur-sm text-sm text-gray-500"
        style={{ height }}
      >
        <div className="text-center p-4">
          <p className="font-semibold mb-2">Unable to load Google Maps</p>
          <p className="text-xs">Please check your internet connection</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl bg-gray-100/90 dark:bg-gray-800/90 backdrop-blur-sm text-sm text-gray-500"
        style={{ height }}
      >
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`relative ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}
      style={{ height: isFullscreen ? '100vh' : height }}
    >
      {/* Map Type Controls - Floating Action Buttons */}
      {showMapTypeControl && (
        <div 
          className={`absolute top-4 right-4 z-10 transition-all duration-300 ${
            showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-[-10px] pointer-events-none'
          }`}
        >
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setMapType(mapType === 'roadmap' ? 'hybrid' : 'roadmap')}
              className="w-12 h-12 rounded-full bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm shadow-lg flex items-center justify-center active:scale-95 transition-all border border-gray-200 dark:border-gray-700"
              title="Toggle map type"
            >
              {mapType === 'roadmap' ? (
                <Satellite className="w-5 h-5 text-orange-500" />
              ) : (
                <MapIcon className="w-5 h-5 text-orange-500" />
              )}
            </button>
            
            <button
              onClick={recenterMap}
              className="w-12 h-12 rounded-full bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm shadow-lg flex items-center justify-center active:scale-95 transition-all border border-gray-200 dark:border-gray-700"
              title="Recentermap"
            >
              <Compass className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
            
            <button
              onClick={toggleFullscreen}
              className="w-12 h-12 rounded-full bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm shadow-lg flex items-center justify-center active:scale-95 transition-all border border-gray-200 dark:border-gray-700"
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? (
                <Minimize2 className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              ) : (
                <Maximize2 className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Map Type Indicator - Bottom Center */}
      <div 
        className={`absolute bottom-20 left-1/2 -translate-x-1/2 z-10 transition-all duration-300 ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-[10px] pointer-events-none'
        }`}
      >
        <div className="bg-black/70 backdrop-blur-md rounded-full px-4 py-2">
          <p className="text-white text-[10px] font-semibold uppercase tracking-wider">
            {mapType === 'roadmap' ? 'Map View' : mapType === 'satellite' ? 'Satellite View' : 'Hybrid View'}
          </p>
        </div>
      </div>

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
        mapContainerStyle={{
          width: '100%',
          height: '100%',
          borderRadius: isFullscreen ? '0' : '1.5rem'
        }}
        center={cameraCenter}
        zoom={cameraZoom}
        mapTypeId={mapType}
        options={{
          mapId: GOOGLE_MAPS_MAP_ID,
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
          zoomControlOptions: {
            position: google.maps.ControlPosition.RIGHT_BOTTOM
          },
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
            radius={5000}
            options={{
              fillColor: '#f97316',
              fillOpacity: 0.08,
              strokeColor: '#f97316',
              strokeOpacity: 0.3,
              strokeWeight: 1.5,
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
              strokeColor: route.color || '#f97316',
              strokeOpacity: 0.9,
              strokeWeight: 4,
              geodesic: true,
              clickable: false
            }}
          />
        ))}

        {/* InfoWindow for selected marker */}
        {selectedMarker?.profile && (
          <InfoWindowF
            position={selectedMarker.position}
            onCloseClick={() => setSelectedMarker(null)}
          >
            <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-xl p-3 shadow-lg max-w-[220px] border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2 mb-2">
                {selectedMarker.profile.avatarUrl ? (
                  <img src={selectedMarker.profile.avatarUrl} className="w-8 h-8 rounded-full object-cover" alt="" />
                ) : (
                  <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">
                      {selectedMarker.profile.name?.charAt(0) || 'U'}
                    </span>
                  </div>
                )}
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">
                    {selectedMarker.profile.name}
                  </p>
                  {selectedMarker.profile.rating && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <Star className="w-3 h-3 fill-current" />
                      {selectedMarker.profile.rating}
                    </p>
                  )}
                </div>
              </div>
              {selectedMarker.profile.phoneNumber && (
                <a
                  href={`tel:${selectedMarker.profile.phoneNumber}`}
                  className="inline-flex items-center gap-1 text-orange-500 text-xs font-medium hover:underline"
                >
                  <Phone className="w-3 h-3" />
                  Call Driver
                </a>
              )}
            </div>
          </InfoWindowF>
        )}
      </GoogleMap>

      {/* Bottom Menu Bar - iOS Style */}
      <div className={`absolute bottom-0 left-0 right-0 z-20 transition-all duration-300 ${
        showControls ? 'translate-y-0' : 'translate-y-full'
      }`}>
        <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-t border-gray-200 dark:border-gray-800 shadow-lg">
          <div className="max-w-md mx-auto px-4 py-2">
            <div className="flex items-center justify-around">
              {/* Home Button */}
              <button 
                className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl active:scale-95 transition-all"
                onClick={() => window.location.href = '/'}
              >
                <MapIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Map</span>
              </button>
              
              {/* Search Button */}
              <button 
                className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl active:scale-95 transition-all"
                onClick={() => {
                  // Trigger search
                  const searchInput = document.querySelector('input[placeholder*="Where to"]') as HTMLInputElement;
                  if (searchInput) searchInput.focus();
                }}
              >
                <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                  <span className="text-white text-[10px] font-bold">?</span>
                </div>
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Search</span>
              </button>
              
              {/* Profile Button */}
              <button 
                className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl active:scale-95 transition-all"
                onClick={() => {
                  // Navigate to profile
                  const profileTab = document.querySelector('[data-tab="profile"]') as HTMLElement;
                  if (profileTab) profileTab.click();
                }}
              >
                <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <span className="text-gray-600 dark:text-gray-300 text-[10px] font-bold">U</span>
                </div>
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Profile</span>
              </button>
            </div>
          </div>
          
          {/* Home Indicator for iOS */}
          <div className="pb-2 flex justify-center">
            <div className="w-32 h-1 bg-gray-300 dark:bg-gray-700 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
