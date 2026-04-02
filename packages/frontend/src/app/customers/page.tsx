'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Plus, Search, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CustomerForm } from '@/components/customers/customer-form';
import {
  useCustomers,
  useCreateCustomer,
  useDeleteCustomer,
  type CreateCustomerData,
  type UpdateCustomerData,
} from '@/hooks/use-customers';
import { useDebounce } from '@/hooks/use-debounce';

// ─── Komponente ───────────────────────────────────────────────────────────────

export default function KundenPage() {
  const router = useRouter();

  // Filter & Pagination State
  const [searchInput, setSearchInput] = useState('');
  const [filterInternal, setFilterInternal] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Dialog State
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Suche debounced
  const debouncedSearch = useDebounce(searchInput, 300);

  // Query Parameter zusammenbauen
  const query = {
    search: debouncedSearch || undefined,
    isInternal:
      filterInternal === 'internal'
        ? true
        : filterInternal === 'external'
          ? false
          : undefined,
    page,
    limit,
  };

  // Hooks
  const { data, isLoading, isError } = useCustomers(query);
  const createCustomer = useCreateCustomer();
  const deleteCustomer = useDeleteCustomer();

  // Seitenreset bei Filteränderung
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    setPage(1);
  }, []);

  const handleFilterChange = useCallback((value: string) => {
    setFilterInternal(value);
    setPage(1);
  }, []);

  const handleCreate = async (data: CreateCustomerData | UpdateCustomerData) => {
    await createCustomer.mutateAsync(data as CreateCustomerData);
    setIsCreateDialogOpen(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (
      window.confirm(
        `Kunden "${name}" wirklich deaktivieren?\n\nDer Kunde wird nicht gelöscht, sondern nur deaktiviert.`,
      )
    ) {
      await deleteCustomer.mutateAsync(id);
    }
  };

  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      {/* Seitenheader */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-7 w-7 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Kunden</h1>
            <p className="text-sm text-muted-foreground">
              {data ? `${data.total} Kunden insgesamt` : 'Kundenverwaltung'}
            </p>
          </div>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Neuer Kunde
        </Button>
      </div>

      {/* Filter & Suche */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Suche nach Name, Ansprechpartner, Kundennummer..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterInternal} onValueChange={handleFilterChange}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Alle Kunden" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Kunden</SelectItem>
            <SelectItem value="internal">Nur interne</SelectItem>
            <SelectItem value="external">Nur externe</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabelle */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kundennummer</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Ort</TableHead>
              <TableHead className="hidden lg:table-cell">Telefon</TableHead>
              <TableHead className="hidden lg:table-cell">E-Mail</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  Daten werden geladen...
                </TableCell>
              </TableRow>
            )}

            {isError && (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-destructive">
                  Fehler beim Laden der Kundendaten. Bitte Seite neu laden.
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !isError && data?.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  {debouncedSearch
                    ? `Keine Kunden gefunden für "${debouncedSearch}"`
                    : 'Noch keine Kunden vorhanden.'}
                </TableCell>
              </TableRow>
            )}

            {data?.data.map((customer) => (
              <TableRow
                key={customer.id}
                className="cursor-pointer"
                onClick={() => router.push(`/customers/${customer.id}`)}
              >
                <TableCell className="font-mono text-sm font-medium">
                  {customer.customerNumber}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{customer.companyName}</div>
                  {customer.contactPerson && (
                    <div className="text-xs text-muted-foreground">
                      {customer.contactPerson}
                    </div>
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">
                  {customer.addressCity
                    ? `${customer.addressZip ?? ''} ${customer.addressCity}`.trim()
                    : '—'}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-muted-foreground">
                  {customer.phone ?? '—'}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-muted-foreground">
                  {customer.email ?? '—'}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={customer.isCompany ? 'secondary' : 'outline'}>
                      {customer.isCompany ? 'Firma' : 'Privat'}
                    </Badge>
                    {customer.isInternal && (
                      <Badge variant="warning">Intern</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell
                  className="text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Bearbeiten"
                      onClick={() => router.push(`/customers/${customer.id}`)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Deaktivieren"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(customer.id, customer.companyName)}
                      disabled={deleteCustomer.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Seite {page} von {totalPages} ({data.total} Einträge)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Zurück
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Weiter
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialog: Neuer Kunde */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Neuen Kunden anlegen</DialogTitle>
            <DialogDescription>
              Füllen Sie die Pflichtfelder aus. Die Kundennummer wird automatisch vergeben.
            </DialogDescription>
          </DialogHeader>
          <CustomerForm
            onSubmit={handleCreate}
            onCancel={() => setIsCreateDialogOpen(false)}
            isLoading={createCustomer.isPending}
            submitLabel="Kunde anlegen"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
