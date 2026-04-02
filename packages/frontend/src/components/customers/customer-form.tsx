'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { Customer, CreateCustomerData, UpdateCustomerData } from '@/hooks/use-customers';

// ─── Validierungsschema ───────────────────────────────────────────────────────

const customerSchema = z.object({
  companyName: z.string().min(1, 'Firmenname ist erforderlich').max(255),
  isCompany: z.boolean(),
  addressStreet: z.string().max(255).optional().or(z.literal('')),
  addressZip: z.string().max(10).optional().or(z.literal('')),
  addressCity: z.string().max(100).optional().or(z.literal('')),
  addressCountry: z.string().length(2, 'Ländercode muss 2 Zeichen haben'),
  phone: z.string().max(50).optional().or(z.literal('')),
  email: z
    .string()
    .email('Ungültige E-Mail-Adresse')
    .max(255)
    .optional()
    .or(z.literal('')),
  contactPerson: z.string().max(255).optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  isInternal: z.boolean(),
});

export type CustomerFormValues = z.infer<typeof customerSchema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface CustomerFormProps {
  defaultValues?: Partial<CustomerFormValues>;
  onSubmit: (data: CreateCustomerData | UpdateCustomerData) => void;
  onCancel: () => void;
  isLoading?: boolean;
  submitLabel?: string;
}

// ─── Komponente ───────────────────────────────────────────────────────────────

export function CustomerForm({
  defaultValues,
  onSubmit,
  onCancel,
  isLoading = false,
  submitLabel = 'Speichern',
}: CustomerFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      companyName: '',
      isCompany: true,
      addressCountry: 'DE',
      isInternal: false,
      ...defaultValues,
    },
  });

  const isCompany = watch('isCompany');
  const isInternal = watch('isInternal');

  const handleFormSubmit = (values: CustomerFormValues) => {
    // Leere Strings in undefined umwandeln für optionale Felder
    const data: CreateCustomerData = {
      companyName: values.companyName,
      isCompany: values.isCompany,
      addressStreet: values.addressStreet || undefined,
      addressZip: values.addressZip || undefined,
      addressCity: values.addressCity || undefined,
      addressCountry: values.addressCountry,
      phone: values.phone || undefined,
      email: values.email || undefined,
      contactPerson: values.contactPerson || undefined,
      notes: values.notes || undefined,
      isInternal: values.isInternal,
    };
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Grunddaten */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Grunddaten
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="companyName">
              {isCompany ? 'Firmenname' : 'Name'}{' '}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="companyName"
              {...register('companyName')}
              placeholder={isCompany ? 'Mustermann GmbH' : 'Max Mustermann'}
              aria-invalid={Boolean(errors.companyName)}
            />
            {errors.companyName && (
              <p className="text-sm text-destructive">{errors.companyName.message}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="isCompany"
              checked={isCompany}
              onCheckedChange={(checked) => setValue('isCompany', checked)}
            />
            <Label htmlFor="isCompany">Firma</Label>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="isInternal"
              checked={isInternal}
              onCheckedChange={(checked) => setValue('isInternal', checked)}
            />
            <Label htmlFor="isInternal">Interner Kunde</Label>
          </div>
        </div>
      </div>

      {/* Adresse */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Adresse
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="addressStreet">Straße und Hausnummer</Label>
            <Input
              id="addressStreet"
              {...register('addressStreet')}
              placeholder="Musterstraße 1"
            />
            {errors.addressStreet && (
              <p className="text-sm text-destructive">{errors.addressStreet.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="addressZip">Postleitzahl</Label>
            <Input
              id="addressZip"
              {...register('addressZip')}
              placeholder="12345"
              maxLength={10}
            />
            {errors.addressZip && (
              <p className="text-sm text-destructive">{errors.addressZip.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="addressCity">Stadt</Label>
            <Input
              id="addressCity"
              {...register('addressCity')}
              placeholder="Berlin"
            />
            {errors.addressCity && (
              <p className="text-sm text-destructive">{errors.addressCity.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="addressCountry">
              Ländercode <span className="text-destructive">*</span>
            </Label>
            <Input
              id="addressCountry"
              {...register('addressCountry')}
              placeholder="DE"
              maxLength={2}
              className="uppercase"
            />
            {errors.addressCountry && (
              <p className="text-sm text-destructive">{errors.addressCountry.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Kontakt */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Kontakt
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="phone">Telefon</Label>
            <Input
              id="phone"
              {...register('phone')}
              type="tel"
              placeholder="+49 30 12345678"
            />
            {errors.phone && (
              <p className="text-sm text-destructive">{errors.phone.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              {...register('email')}
              type="email"
              placeholder="info@mustermann.de"
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="contactPerson">Ansprechpartner</Label>
            <Input
              id="contactPerson"
              {...register('contactPerson')}
              placeholder="Max Mustermann"
            />
            {errors.contactPerson && (
              <p className="text-sm text-destructive">{errors.contactPerson.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Notizen */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notizen</Label>
        <Textarea
          id="notes"
          {...register('notes')}
          placeholder="Interne Notizen zum Kunden..."
          rows={3}
        />
      </div>

      {/* Aktionsbuttons */}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Wird gespeichert...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

// ─── Hilfsfunktion: Customer → FormValues ────────────────────────────────────

export function customerToFormValues(customer: Customer): CustomerFormValues {
  return {
    companyName: customer.companyName,
    isCompany: customer.isCompany,
    addressStreet: customer.addressStreet ?? '',
    addressZip: customer.addressZip ?? '',
    addressCity: customer.addressCity ?? '',
    addressCountry: customer.addressCountry,
    phone: customer.phone ?? '',
    email: customer.email ?? '',
    contactPerson: customer.contactPerson ?? '',
    notes: customer.notes ?? '',
    isInternal: customer.isInternal,
  };
}
