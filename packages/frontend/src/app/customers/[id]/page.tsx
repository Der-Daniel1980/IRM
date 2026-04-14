'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Users, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CustomerForm, customerToFormValues } from '@/components/customers/customer-form';
import { useCustomer, useUpdateCustomer, type UpdateCustomerData } from '@/hooks/use-customers';
import { useProperties } from '@/hooks/use-properties';

// ─── Komponente ───────────────────────────────────────────────────────────────

export default function KundenDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const { data: customer, isLoading, isError } = useCustomer(id);
  const updateCustomer = useUpdateCustomer(id);
  const { data: propertiesData } = useProperties({ customerId: id, limit: 100 });

  const handleSubmit = async (data: UpdateCustomerData) => {
    await updateCustomer.mutateAsync(data);
    router.push('/customers');
  };

  const handleCancel = () => {
    router.push('/customers');
  };

  // Ladezustand
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleCancel}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Kunde laden...</h1>
        </div>
        <div className="h-64 rounded-md border flex items-center justify-center text-muted-foreground">
          Kundendaten werden geladen...
        </div>
      </div>
    );
  }

  // Fehlerfall
  if (isError || !customer) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleCancel}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Fehler</h1>
        </div>
        <div className="rounded-md border border-destructive p-6 text-destructive">
          Kunde wurde nicht gefunden oder es ist ein Fehler aufgetreten.
        </div>
        <Button variant="outline" onClick={handleCancel}>
          Zurück zur Kundenliste
        </Button>
      </div>
    );
  }

  const formattedDate = new Date(customer.createdAt).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Seitenheader */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={handleCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Users className="h-6 w-6 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight truncate">
              {customer.companyName}
            </h1>
            <span className="font-mono text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {customer.customerNumber}
            </span>
            {customer.isInternal && <Badge variant="warning">Intern</Badge>}
            {!customer.isActive && (
              <Badge variant="destructive">Inaktiv</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Angelegt am {formattedDate}
          </p>
        </div>
      </div>

      {/* Stammdaten-Formular */}
      <div className="rounded-md border p-6">
        <h2 className="text-base font-semibold mb-6">Stammdaten</h2>
        <CustomerForm
          defaultValues={customerToFormValues(customer)}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={updateCustomer.isPending}
          submitLabel="Änderungen speichern"
        />
      </div>

      {/* Zugehörige Immobilien */}
      <div className="rounded-md border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">
            Zugehörige Immobilien
            {propertiesData && propertiesData.total > 0 && (
              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal">
                {propertiesData.total}
              </span>
            )}
          </h2>
        </div>
        {!propertiesData ? (
          <div className="text-sm text-muted-foreground">Lade Immobilien...</div>
        ) : propertiesData.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 text-muted-foreground text-sm border border-dashed rounded-md">
            <Building2 className="h-6 w-6 mb-2 opacity-40" />
            <p>Keine Immobilien für diesen Kunden hinterlegt.</p>
          </div>
        ) : (
          <ul className="divide-y rounded-md border">
            {propertiesData.data.map((p) => (
              <li key={p.id} className="flex items-center justify-between p-3 hover:bg-muted/30">
                <div>
                  <div className="font-medium text-sm">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    <span className="font-mono">{p.propertyNumber}</span>
                    {' · '}
                    {p.addressStreet}, {p.addressZip} {p.addressCity}
                  </div>
                </div>
                <Link href={`/properties/${p.id}`}>
                  <Button variant="ghost" size="sm">Details</Button>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
