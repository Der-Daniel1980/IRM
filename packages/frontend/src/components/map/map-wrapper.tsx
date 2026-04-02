'use client';

import { usePropertiesGeoJson } from '@/hooks/use-properties';
import { PropertyMap } from './property-map';

export function MapWrapper() {
  const { data, isLoading, isError } = usePropertiesGeoJson();

  if (isLoading) {
    return (
      <div className="flex h-full min-h-[500px] items-center justify-center text-muted-foreground">
        Immobiliendaten werden geladen...
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-full min-h-[500px] items-center justify-center text-destructive">
        Fehler beim Laden der Kartendaten.
      </div>
    );
  }

  return (
    <PropertyMap
      geoData={data}
      className="h-full w-full min-h-[500px]"
    />
  );
}
