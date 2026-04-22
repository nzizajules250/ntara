import { GoogleMap, InfoWindowF, CircleF, useJsApiLoader, PolylineF } from '@react-google-maps/api';
import { useEffect, useRef, useState } from 'react';
import { UserProfile } from '../lib/firebase';
import { Satellite, Map as MapIcon } from 'lucide-react';

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
}

const GOOGLE_MAPS_API_KEY = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyA0x1maORlZEkKWdFgxDBuDukI4mOMDlb0';
const GOOGLE_MAPS_MAP_ID = (import.meta as any).env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';
const MAP_LIBRARIES: ('marker')[] = ['marker'];

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
  onMarkerClick,
  onMapClick,
  height = '400px',
  showMapTypeControl = true
}: MapComponentProps) {
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid'>('hybrid');
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [cameraCenter, setCameraCenter] = useState(center);
  const [cameraZoom, setCameraZoom] = useState(zoom);
  const [generatedRoutes, setGeneratedRoutes] = useState<MapRoute[]>([]);
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
        return '#2563eb';
      case 'rider':
        return '#16a34a';
      case 'nearby':
        return '#eab308';
      case 'destination':
        return '#dc2626';
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
      default:
        return '';
    }
  };

  const handleMarkerClick = (marker: MapMarker) => {
    setSelectedMarker(marker);
    onMarkerClick?.(marker);
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

      {/* InfoWindow for selected marker */}
      {selectedMarker?.profile && (
        <InfoWindowF
          position={selectedMarker.position}
          onCloseClick={() => setSelectedMarker(null)}
        >
          <div className="bg-white rounded-lg p-3 shadow-lg max-w-xs">
            <p className="font-bold text-gray-900">{selectedMarker.profile.name}</p>
            {selectedMarker.profile.rating && (
              <p className="text-sm text-amber-600">⭐ {selectedMarker.profile.rating}</p>
            )}
            {selectedMarker.profile.phoneNumber && (
              <a
                href={`tel:${selectedMarker.profile.phoneNumber}`}
                className="text-blue-600 text-sm hover:underline"
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
