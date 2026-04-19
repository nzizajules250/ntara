import { GoogleMap, LoadScript, MarkerF, InfoWindowF, CircleF } from '@react-google-maps/api';
import { useState, useEffect } from 'react';
import { UserProfile } from '../lib/firebase';

interface MapMarker {
  id: string;
  position: { lat: number; lng: number };
  label: string;
  type: 'passenger' | 'rider' | 'nearby';
  profile?: UserProfile;
}

interface MapComponentProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  markers: MapMarker[];
  showNearbyDrivers?: boolean;
  onMarkerClick?: (marker: MapMarker) => void;
  height?: string;
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyD7nQp1Ei20IEcsXMFjQKq0ASi8N7ZWcEQ';

const defaultCenter = { lat: 51.5074, lng: -0.1278 }; // London

export default function MapComponent({
  center = defaultCenter,
  zoom = 14,
  markers = [],
  showNearbyDrivers = true,
  onMarkerClick,
  height = '400px'
}: MapComponentProps) {
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);

  const getMarkerColor = (type: string) => {
    switch (type) {
      case 'passenger':
        return 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png';
      case 'rider':
        return 'http://maps.google.com/mapfiles/ms/icons/green-dot.png';
      case 'nearby':
        return 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png';
      default:
        return 'http://maps.google.com/mapfiles/ms/icons/red-dot.png';
    }
  };

  const handleMarkerClick = (marker: MapMarker) => {
    setSelectedMarker(marker);
    onMarkerClick?.(marker);
  };

  return (
    <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
      <GoogleMap
        mapContainerStyle={{
          width: '100%',
          height: height,
          borderRadius: '1.5rem'
        }}
        center={center}
        zoom={zoom}
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

        {/* Markers */}
        {markers.map((marker) => (
          <MarkerF
            key={marker.id}
            position={marker.position}
            title={marker.label}
            icon={{
              url: getMarkerColor(marker.type),
              scaledSize: new (window as any).google.maps.Size(32, 32)
            }}
            onClick={() => handleMarkerClick(marker)}
          >
            {selectedMarker?.id === marker.id && marker.profile && (
              <InfoWindowF
                position={marker.position}
                onCloseClick={() => setSelectedMarker(null)}
                options={{
                  pixelOffset: new (window as any).google.maps.Size(0, -32)
                }}
              >
                <div className="bg-white rounded-lg p-3 shadow-lg max-w-xs">
                  <p className="font-bold text-gray-900">{marker.profile.name}</p>
                  {marker.profile.rating && (
                    <p className="text-sm text-amber-600">⭐ {marker.profile.rating}</p>
                  )}
                  {marker.profile.phoneNumber && (
                    <a
                      href={`tel:${marker.profile.phoneNumber}`}
                      className="text-blue-600 text-sm hover:underline"
                    >
                      📞 Call
                    </a>
                  )}
                </div>
              </InfoWindowF>
            )}
          </MarkerF>
        ))}
      </GoogleMap>
    </LoadScript>
  );
}
