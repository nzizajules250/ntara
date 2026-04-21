import { GoogleMap, InfoWindowF, CircleF, useJsApiLoader, PolylineF } from '@react-google-maps/api';
import { useState, useEffect, useRef } from 'react';
import { UserProfile } from '../lib/firebase';
import { Satellite, Map as MapIcon } from 'lucide-react';

// TypeScript declarations for AdvancedMarkerElement
declare global {
  namespace google.maps {
    namespace marker {
      class AdvancedMarkerElement {
        constructor(options: any);
        map: any;
        position: any;
        title: string;
        content: HTMLElement;
        addListener(event: string, callback: () => void): void;
      }
    }
  }
}

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

interface MapComponentProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  markers: MapMarker[];
  routes?: MapRoute[];
  showNearbyDrivers?: boolean;
  onMarkerClick?: (marker: MapMarker) => void;
  height?: string;
  showMapTypeControl?: boolean;
}

const GOOGLE_MAPS_API_KEY = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyD7nQp1Ei20IEcsXMFjQKq0ASi8N7ZWcEQ';

const defaultCenter = { lat: 51.5074, lng: -0.1278 }; // London

export default function MapComponent({
  center = defaultCenter,
  zoom = 14,
  markers = [],
  routes = [],
  showNearbyDrivers = true,
  onMarkerClick,
  height = '400px',
  showMapTypeControl = true
}: MapComponentProps) {
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid'>('hybrid');
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'ntwara-google-maps-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: ['marker']
  });

  const getMarkerColor = (type: string) => {
    switch (type) {
      case 'passenger':
        return 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png';
      case 'rider':
        return 'http://maps.google.com/mapfiles/ms/icons/green-dot.png';
      case 'nearby':
        return 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png';
      case 'destination':
        return 'http://maps.google.com/mapfiles/ms/icons/red-dot.png';
      default:
        return 'http://maps.google.com/mapfiles/ms/icons/red-dot.png';
    }
  };

  const handleMarkerClick = (marker: MapMarker) => {
    setSelectedMarker(marker);
    onMarkerClick?.(marker);
  };

  // Create and manage AdvancedMarkerElements
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps?.marker?.AdvancedMarkerElement) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => {
      marker.map = null;
    });
    markersRef.current.clear();

    // Create new markers using AdvancedMarkerElement
    markers.forEach((marker) => {
      try {
        const markerColor = getMarkerColor(marker.type);
        
        // Create a div element for the marker content
        const markerDiv = document.createElement('div');
        markerDiv.style.width = '32px';
        markerDiv.style.height = '32px';
        markerDiv.style.backgroundImage = `url('${markerColor}')`;
        markerDiv.style.backgroundSize = 'contain';
        markerDiv.style.backgroundRepeat = 'no-repeat';
        markerDiv.style.cursor = 'pointer';

        const advancedMarker = new window.google.maps.marker.AdvancedMarkerElement({
          map: mapRef.current,
          position: marker.position,
          title: marker.label,
          content: markerDiv
        });

        advancedMarker.addListener('click', () => handleMarkerClick(marker));
        markersRef.current.set(marker.id, advancedMarker);
      } catch (error) {
        console.error('Error creating marker:', error);
      }
    });
  }, [markers, isLoaded]);

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
        ref={mapRef}
        mapContainerStyle={{
          width: '100%',
          height: '100%',
          borderRadius: '1.5rem'
        }}
        center={center}
        zoom={zoom}
        mapTypeId={mapType}
        options={{
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
      {routes.map((route) => (
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

      {/* AdvancedMarkerElements are now managed via useEffect */}
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
