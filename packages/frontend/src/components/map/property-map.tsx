'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Link from 'next/link';
import type { GeoJsonFeatureCollection } from '@/hooks/use-properties';

// Fix für Leaflet-Icons in Next.js (webpack bundling problem)
// Muss hinter typeof window check, da Leaflet beim Import window referenziert
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)['_getIconUrl'];
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

// Farbige Icons für Immobilien
function createColoredIcon(color: 'green' | 'orange' | 'red' | 'gray'): L.DivIcon {
  const colorMap: Record<string, string> = {
    green: '#22c55e',
    orange: '#f97316',
    red: '#ef4444',
    gray: '#9ca3af',
  };

  const svgColor = colorMap[color] ?? colorMap['green'];

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 41" width="25" height="41">
      <path fill="${svgColor}" stroke="#fff" stroke-width="1.5"
        d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z"/>
      <circle fill="white" cx="12.5" cy="12.5" r="5"/>
    </svg>
  `;

  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });
}

const greenIcon: L.DivIcon = createColoredIcon('green');
const grayIcon: L.DivIcon = createColoredIcon('gray');

// ─── Props ────────────────────────────────────────────────────────────────────

interface PropertyMapProps {
  geoData: GeoJsonFeatureCollection;
  center?: [number, number];
  zoom?: number;
  className?: string;
}

// ─── Komponente ───────────────────────────────────────────────────────────────

export function PropertyMap({
  geoData,
  center = [51.1657, 10.4515],
  zoom = 6,
  className = 'h-full w-full',
}: PropertyMapProps) {
  useEffect(() => {
    // Leaflet CSS in <head> wird automatisch durch den Import geladen
  }, []);

  const features = geoData.features.filter((f) => f.geometry !== null);

  // Wenn Marker vorhanden, Karte auf diese zentrieren
  const mapCenter =
    features.length === 1 && features[0].geometry
      ? ([features[0].geometry.coordinates[1], features[0].geometry.coordinates[0]] as [number, number])
      : center;

  const mapZoom = features.length === 1 ? 15 : zoom;

  return (
    <MapContainer
      center={mapCenter}
      zoom={mapZoom}
      className={className}
      style={{ minHeight: '400px' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {features.map((feature) => {
        if (!feature.geometry) return null;
        const [lng, lat] = feature.geometry.coordinates;
        const props = feature.properties;
        const icon = props.isActive ? greenIcon : grayIcon;

        return (
          <Marker key={props.id} position={[lat, lng]} icon={icon}>
            <Popup>
              <div className="min-w-[180px]">
                <p className="font-semibold text-sm">{props.name}</p>
                <p className="text-xs text-gray-500 font-mono">{props.propertyNumber}</p>
                <p className="text-xs mt-1">
                  {props.addressStreet}
                  <br />
                  {props.addressZip} {props.addressCity}
                </p>
                {props.unitsCount > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {props.unitsCount} Einheit{props.unitsCount !== 1 ? 'en' : ''}
                  </p>
                )}
                <Link
                  href={`/properties/${props.id}`}
                  className="text-xs text-blue-600 hover:underline mt-2 block"
                >
                  Details anzeigen
                </Link>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
