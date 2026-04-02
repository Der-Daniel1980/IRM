import dynamic from 'next/dynamic';
import { MapPin } from 'lucide-react';

// Leaflet funktioniert nicht mit SSR — dynamischer Import erforderlich
const PropertyMapWrapper = dynamic(
  () => import('@/components/map/map-wrapper').then((m) => m.MapWrapper),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[500px] items-center justify-center rounded-md border bg-muted/20 text-muted-foreground">
        Karte wird geladen...
      </div>
    ),
  },
);

export default function KartenansichtPage() {
  return (
    <div className="flex h-full flex-col space-y-4">
      {/* Seitenheader */}
      <div className="flex items-center gap-3">
        <MapPin className="h-7 w-7 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kartenansicht</h1>
          <p className="text-sm text-muted-foreground">
            Alle Immobilien auf einen Blick — OpenStreetMap
          </p>
        </div>
      </div>

      {/* Legende */}
      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
          Aktiv
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-gray-400" />
          Inaktiv
        </div>
      </div>

      {/* Karte */}
      <div className="flex-1 min-h-[500px] rounded-md border overflow-hidden">
        <PropertyMapWrapper />
      </div>
    </div>
  );
}
