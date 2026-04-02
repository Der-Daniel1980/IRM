'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─── Typen ──────────────────────────────────────────────────────────────────

export type PropertyType = 'RESIDENTIAL' | 'COMMERCIAL' | 'MIXED' | 'LAND' | 'PARKING';
export type UnitUsageType = 'RESIDENTIAL' | 'COMMERCIAL' | 'COMMON_AREA' | 'TECHNICAL';

export interface Property {
  id: string;
  propertyNumber: string;
  customerId: string;
  name: string;
  addressStreet: string;
  addressZip: string;
  addressCity: string;
  latitude: string | null;
  longitude: string | null;
  propertyType: PropertyType;
  totalAreaSqm: string | null;
  greenAreaSqm: string | null;
  floors: number;
  unitsCount: number;
  notes: string | null;
  isActive: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  customer?: {
    id: string;
    companyName: string;
    customerNumber: string;
  };
}

export interface PropertyUnit {
  id: string;
  propertyId: string;
  unitNumber: string;
  floor: string;
  tenantName: string | null;
  tenantPhone: string | null;
  usageType: UnitUsageType;
  areaSqm: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyWithUnits extends Property {
  units: PropertyUnit[];
}

export interface PaginatedProperties {
  data: Property[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PropertiesQuery {
  search?: string;
  customerId?: string;
  propertyType?: PropertyType;
  city?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface CreatePropertyData {
  customerId: string;
  name: string;
  addressStreet: string;
  addressZip: string;
  addressCity: string;
  latitude?: number;
  longitude?: number;
  propertyType?: PropertyType;
  totalAreaSqm?: number;
  greenAreaSqm?: number;
  floors?: number;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdatePropertyData extends Partial<CreatePropertyData> {
  isActive?: boolean;
}

export interface CreatePropertyUnitData {
  unitNumber: string;
  floor: string;
  tenantName?: string;
  tenantPhone?: string;
  usageType?: UnitUsageType;
  areaSqm?: number;
  notes?: string;
}

export interface UpdatePropertyUnitData extends Partial<CreatePropertyUnitData> {}

// ─── GeoJSON ─────────────────────────────────────────────────────────────────

export interface GeoJsonFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  } | null;
  properties: {
    id: string;
    propertyNumber: string;
    name: string;
    addressStreet: string;
    addressZip: string;
    addressCity: string;
    isActive: boolean;
    propertyType: PropertyType;
    unitsCount: number;
  };
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const propertyKeys = {
  all: ['properties'] as const,
  lists: () => [...propertyKeys.all, 'list'] as const,
  list: (query: PropertiesQuery) => [...propertyKeys.lists(), query] as const,
  details: () => [...propertyKeys.all, 'detail'] as const,
  detail: (id: string) => [...propertyKeys.details(), id] as const,
  units: (propertyId: string) => [...propertyKeys.all, 'units', propertyId] as const,
  geoJson: () => [...propertyKeys.all, 'geojson'] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useProperties(query: PropertiesQuery = {}) {
  return useQuery<PaginatedProperties>({
    queryKey: propertyKeys.list(query),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.search) params.set('search', query.search);
      if (query.customerId) params.set('customerId', query.customerId);
      if (query.propertyType) params.set('propertyType', query.propertyType);
      if (query.city) params.set('city', query.city);
      if (query.isActive !== undefined) params.set('isActive', String(query.isActive));
      if (query.page) params.set('page', String(query.page));
      if (query.limit) params.set('limit', String(query.limit));

      const response = await api.get<PaginatedProperties>(`/properties?${params.toString()}`);
      return response.data;
    },
  });
}

export function useProperty(id: string) {
  return useQuery<PropertyWithUnits>({
    queryKey: propertyKeys.detail(id),
    queryFn: async () => {
      const response = await api.get<PropertyWithUnits>(`/properties/${id}`);
      return response.data;
    },
    enabled: Boolean(id),
  });
}

export function usePropertyUnits(propertyId: string) {
  return useQuery<PropertyUnit[]>({
    queryKey: propertyKeys.units(propertyId),
    queryFn: async () => {
      const response = await api.get<PropertyUnit[]>(`/properties/${propertyId}/units`);
      return response.data;
    },
    enabled: Boolean(propertyId),
  });
}

export function usePropertiesGeoJson() {
  return useQuery<GeoJsonFeatureCollection>({
    queryKey: propertyKeys.geoJson(),
    queryFn: async () => {
      const response = await api.get<GeoJsonFeatureCollection>('/map/properties');
      return response.data;
    },
  });
}

export function useCreateProperty() {
  const queryClient = useQueryClient();

  return useMutation<Property, Error, CreatePropertyData>({
    mutationFn: async (data) => {
      const response = await api.post<Property>('/properties', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.lists() });
      queryClient.invalidateQueries({ queryKey: propertyKeys.geoJson() });
    },
  });
}

export function useUpdateProperty(id: string) {
  const queryClient = useQueryClient();

  return useMutation<Property, Error, UpdatePropertyData>({
    mutationFn: async (data) => {
      const response = await api.patch<Property>(`/properties/${id}`, data);
      return response.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.lists() });
      queryClient.setQueryData(propertyKeys.detail(id), updated);
      queryClient.invalidateQueries({ queryKey: propertyKeys.geoJson() });
    },
  });
}

export function useDeleteProperty() {
  const queryClient = useQueryClient();

  return useMutation<Property, Error, string>({
    mutationFn: async (propertyId) => {
      const response = await api.delete<Property>(`/properties/${propertyId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.lists() });
      queryClient.invalidateQueries({ queryKey: propertyKeys.geoJson() });
    },
  });
}

export function useCreatePropertyUnit(propertyId: string) {
  const queryClient = useQueryClient();

  return useMutation<PropertyUnit, Error, CreatePropertyUnitData>({
    mutationFn: async (data) => {
      const response = await api.post<PropertyUnit>(`/properties/${propertyId}/units`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.units(propertyId) });
      queryClient.invalidateQueries({ queryKey: propertyKeys.detail(propertyId) });
    },
  });
}

export function useUpdatePropertyUnit(propertyId: string) {
  const queryClient = useQueryClient();

  return useMutation<PropertyUnit, Error, { unitId: string; data: UpdatePropertyUnitData }>({
    mutationFn: async ({ unitId, data }) => {
      const response = await api.patch<PropertyUnit>(
        `/properties/${propertyId}/units/${unitId}`,
        data,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.units(propertyId) });
    },
  });
}

export function useDeletePropertyUnit(propertyId: string) {
  const queryClient = useQueryClient();

  return useMutation<PropertyUnit, Error, string>({
    mutationFn: async (unitId) => {
      const response = await api.delete<PropertyUnit>(
        `/properties/${propertyId}/units/${unitId}`,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.units(propertyId) });
      queryClient.invalidateQueries({ queryKey: propertyKeys.detail(propertyId) });
    },
  });
}
