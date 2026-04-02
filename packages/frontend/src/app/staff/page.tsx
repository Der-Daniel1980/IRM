'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  UserCog,
  Plus,
  Search,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
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
import { StaffForm } from '@/components/staff/staff-form';
import { SkillBadge } from '@/components/skills/skill-badge';
import {
  useStaffList,
  useCreateStaff,
  useDeleteStaff,
  type CreateStaffData,
  type UpdateStaffData,
  type EmploymentType,
} from '@/hooks/use-staff';
import { useDebounce } from '@/hooks/use-debounce';

// ─── Labels ───────────────────────────────────────────────────────────────────

const employmentTypeLabels: Record<EmploymentType, string> = {
  FULL_TIME: 'Vollzeit',
  PART_TIME: 'Teilzeit',
  MINI_JOB: 'Mini-Job',
  FREELANCER: 'Freiberufler',
};

// ─── Komponente ───────────────────────────────────────────────────────────────

export default function PersonalPage() {
  const router = useRouter();

  const [searchInput, setSearchInput] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [filterSkillId, setFilterSkillId] = useState<string>('all');
  const [filterEmployment, setFilterEmployment] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const debouncedSearch = useDebounce(searchInput, 300);

  const query = {
    search: debouncedSearch || undefined,
    isActive: filterStatus === 'active' ? true : filterStatus === 'inactive' ? false : undefined,
    employmentType: filterEmployment !== 'all' ? (filterEmployment as EmploymentType) : undefined,
    skillId: filterSkillId !== 'all' ? filterSkillId : undefined,
    page,
    limit,
  };

  const { data, isLoading, isError } = useStaffList(query);
  const createStaff = useCreateStaff();
  const deleteStaff = useDeleteStaff();

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    setPage(1);
  }, []);

  const handleFilterChange = useCallback((setter: (v: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  }, []);

  const handleCreate = async (formData: CreateStaffData | UpdateStaffData) => {
    await createStaff.mutateAsync(formData as CreateStaffData);
    setIsCreateDialogOpen(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (
      window.confirm(
        `Mitarbeiter "${name}" wirklich deaktivieren?\n\nDer Mitarbeiter wird nicht gelöscht, sondern nur deaktiviert.`,
      )
    ) {
      await deleteStaff.mutateAsync(id);
    }
  };

  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      {/* Seitenheader */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserCog className="h-7 w-7 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Personal</h1>
            <p className="text-sm text-muted-foreground">
              {data ? `${data.total} Mitarbeiter insgesamt` : 'Personalverwaltung'}
            </p>
          </div>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Neuer Mitarbeiter
        </Button>
      </div>

      {/* Filter & Suche */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Suche nach Name, Personalnummer, E-Mail..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={filterStatus} onValueChange={handleFilterChange(setFilterStatus)}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Aktiv</SelectItem>
            <SelectItem value="inactive">Inaktiv</SelectItem>
            <SelectItem value="all">Alle</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterEmployment} onValueChange={handleFilterChange(setFilterEmployment)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Beschäftigungstyp" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            <SelectItem value="FULL_TIME">Vollzeit</SelectItem>
            <SelectItem value="PART_TIME">Teilzeit</SelectItem>
            <SelectItem value="MINI_JOB">Mini-Job</SelectItem>
            <SelectItem value="FREELANCER">Freiberufler</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabelle */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nr.</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Fähigkeiten</TableHead>
              <TableHead className="hidden lg:table-cell">Beschäftigung</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  Daten werden geladen...
                </TableCell>
              </TableRow>
            )}

            {isError && (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-destructive">
                  Fehler beim Laden der Personaldaten. Bitte Seite neu laden.
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !isError && data?.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  {debouncedSearch
                    ? `Keine Mitarbeiter gefunden für "${debouncedSearch}"`
                    : 'Noch keine Mitarbeiter vorhanden.'}
                </TableCell>
              </TableRow>
            )}

            {data?.data.map((member) => {
              const staffWithSkills = member as typeof member & { skills?: { skill: { id: string; name: string; icon: string }; level: string; warningExpiringSoon: boolean }[] };
              const skillList = staffWithSkills.skills ?? [];
              const fullName = `${member.firstName} ${member.lastName}`;

              return (
                <TableRow
                  key={member.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/staff/${member.id}`)}
                >
                  <TableCell className="font-mono text-sm font-medium">
                    {member.staffNumber}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full shrink-0 border border-white ring-1 ring-gray-200"
                        style={{ backgroundColor: member.color }}
                        title={`Farbe: ${member.color}`}
                      />
                      <div>
                        <div className="font-medium">{fullName}</div>
                        {member.email && (
                          <div className="text-xs text-muted-foreground">{member.email}</div>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {skillList.slice(0, 3).map((s) => (
                        <SkillBadge
                          key={s.skill.id}
                          name={s.skill.name}
                          icon={s.skill.icon}
                          expiringSoon={s.warningExpiringSoon}
                        />
                      ))}
                      {skillList.length > 3 && (
                        <span className="text-xs text-muted-foreground self-center">
                          +{skillList.length - 3} weitere
                        </span>
                      )}
                      {skillList.length === 0 && (
                        <span className="text-xs text-muted-foreground">Keine Fähigkeiten</span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="hidden lg:table-cell">
                    <Badge variant="outline">
                      {employmentTypeLabels[member.employmentType as EmploymentType]}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    {member.isActive ? (
                      <Badge variant="success">Aktiv</Badge>
                    ) : (
                      <Badge variant="destructive">Inaktiv</Badge>
                    )}
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
                        onClick={() => router.push(`/staff/${member.id}`)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Deaktivieren"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(member.id, fullName)}
                        disabled={deleteStaff.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
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

      {/* Dialog: Neuer Mitarbeiter */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Neuen Mitarbeiter anlegen</DialogTitle>
            <DialogDescription>
              Füllen Sie die Pflichtfelder aus. Die Personalnummer wird automatisch vergeben.
            </DialogDescription>
          </DialogHeader>
          <StaffForm
            onSubmit={handleCreate}
            onCancel={() => setIsCreateDialogOpen(false)}
            isLoading={createStaff.isPending}
            submitLabel="Mitarbeiter anlegen"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
