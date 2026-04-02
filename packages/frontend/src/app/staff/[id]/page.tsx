'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  UserCog,
  Plus,
  Trash2,
  CalendarClock,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { StaffForm, staffToFormValues } from '@/components/staff/staff-form';
import { SkillBadge } from '@/components/skills/skill-badge';
import {
  useStaff,
  useUpdateStaff,
  useAssignSkill,
  useRemoveSkill,
  type UpdateStaffData,
  type SkillLevel,
} from '@/hooks/use-staff';
import { useSkills } from '@/hooks/use-skills';

// ─── Level-Labels ─────────────────────────────────────────────────────────────

const skillLevelLabels: Record<SkillLevel, string> = {
  BASIC: 'Basis',
  INTERMEDIATE: 'Fortgeschritten',
  EXPERT: 'Experte',
};

const employmentTypeLabels: Record<string, string> = {
  FULL_TIME: 'Vollzeit',
  PART_TIME: 'Teilzeit',
  MINI_JOB: 'Mini-Job',
  FREELANCER: 'Freiberufler',
};

// ─── Komponente ───────────────────────────────────────────────────────────────

export default function PersonalDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const { data: staff, isLoading, isError } = useStaff(id);
  const { data: allSkills } = useSkills();
  const updateStaff = useUpdateStaff(id);
  const assignSkill = useAssignSkill(id);
  const removeSkill = useRemoveSkill(id);

  // Skill-Zuordnungs-Dialog State
  const [isSkillDialogOpen, setIsSkillDialogOpen] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<SkillLevel>('BASIC');
  const [certifiedUntil, setCertifiedUntil] = useState<string>('');

  const handleUpdate = async (data: UpdateStaffData) => {
    await updateStaff.mutateAsync(data);
  };

  const handleAssignSkill = async () => {
    if (!selectedSkillId) return;

    await assignSkill.mutateAsync({
      skillId: selectedSkillId,
      level: selectedLevel,
      certifiedUntil: certifiedUntil || undefined,
    });

    setIsSkillDialogOpen(false);
    setSelectedSkillId('');
    setSelectedLevel('BASIC');
    setCertifiedUntil('');
  };

  const handleRemoveSkill = async (skillId: string, skillName: string) => {
    if (
      window.confirm(`Fähigkeit "${skillName}" wirklich vom Mitarbeiter entfernen?`)
    ) {
      await removeSkill.mutateAsync(skillId);
    }
  };

  // Bereits zugeordnete Skill-IDs (für Dropdown-Filter)
  const assignedSkillIds = new Set(staff?.skills?.map((s) => s.skillId) ?? []);

  // Verfügbare Skills (noch nicht zugeordnet)
  const availableSkills = allSkills?.filter((s) => !assignedSkillIds.has(s.id)) ?? [];

  // Ladezustand
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/staff')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Mitarbeiter laden...</h1>
        </div>
        <div className="h-64 rounded-md border flex items-center justify-center text-muted-foreground">
          Daten werden geladen...
        </div>
      </div>
    );
  }

  // Fehlerfall
  if (isError || !staff) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/staff')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Fehler</h1>
        </div>
        <div className="rounded-md border border-destructive p-6 text-destructive">
          Mitarbeiter wurde nicht gefunden oder es ist ein Fehler aufgetreten.
        </div>
        <Button variant="outline" onClick={() => router.push('/staff')}>
          Zurück zur Personalliste
        </Button>
      </div>
    );
  }

  const fullName = `${staff.firstName} ${staff.lastName}`;
  const formattedDate = new Date(staff.createdAt).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Seitenheader */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/staff')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <UserCog className="h-6 w-6 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="h-4 w-4 rounded-full shrink-0 border border-white ring-1 ring-gray-200"
              style={{ backgroundColor: staff.color }}
            />
            <h1 className="text-2xl font-bold tracking-tight truncate">{fullName}</h1>
            <span className="font-mono text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {staff.staffNumber}
            </span>
            <Badge variant="outline">
              {employmentTypeLabels[staff.employmentType] ?? staff.employmentType}
            </Badge>
            {!staff.isActive && <Badge variant="destructive">Inaktiv</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">Angelegt am {formattedDate}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="stammdaten">
        <TabsList>
          <TabsTrigger value="stammdaten">Stammdaten</TabsTrigger>
          <TabsTrigger value="faehigkeiten">
            Fähigkeiten
            {staff.skills && staff.skills.length > 0 && (
              <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 text-xs font-medium">
                {staff.skills.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="kalender">Kalender</TabsTrigger>
        </TabsList>

        {/* Tab: Stammdaten */}
        <TabsContent value="stammdaten" className="mt-4">
          <div className="rounded-md border p-6">
            <StaffForm
              defaultValues={staffToFormValues(staff)}
              onSubmit={handleUpdate}
              onCancel={() => router.push('/staff')}
              isLoading={updateStaff.isPending}
              submitLabel="Änderungen speichern"
            />
          </div>
        </TabsContent>

        {/* Tab: Fähigkeiten */}
        <TabsContent value="faehigkeiten" className="mt-4">
          <div className="rounded-md border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Zugeordnete Fähigkeiten</h2>
              <Button
                size="sm"
                onClick={() => setIsSkillDialogOpen(true)}
                disabled={availableSkills.length === 0}
                title={availableSkills.length === 0 ? 'Alle verfügbaren Fähigkeiten bereits zugeordnet' : undefined}
              >
                <Plus className="h-4 w-4" />
                Fähigkeit hinzufügen
              </Button>
            </div>

            {staff.skills && staff.skills.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fähigkeit</TableHead>
                      <TableHead>Kategorie</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Zertifikat gültig bis</TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staff.skills.map((s) => (
                      <TableRow key={s.skillId}>
                        <TableCell>
                          <SkillBadge
                            name={s.skill.name}
                            icon={s.skill.icon}
                            expiringSoon={s.warningExpiringSoon}
                          />
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {s.skill.category}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {skillLevelLabels[s.level]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {s.certifiedUntil ? (
                            <span
                              className={
                                s.warningExpiringSoon
                                  ? 'flex items-center gap-1 text-red-600 font-medium text-sm'
                                  : 'text-sm'
                              }
                            >
                              {s.warningExpiringSoon && (
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                              )}
                              {new Date(s.certifiedUntil).toLocaleDateString('de-DE')}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              {s.skill.requiresCertification ? 'Kein Zertifikat hinterlegt' : '—'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Fähigkeit entfernen"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleRemoveSkill(s.skillId, s.skill.name)}
                            disabled={removeSkill.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-24 text-muted-foreground text-sm border border-dashed rounded-md">
                <p>Noch keine Fähigkeiten zugeordnet.</p>
                <p className="text-xs mt-1">
                  Klicken Sie auf "Fähigkeit hinzufügen", um eine Fähigkeit zuzuordnen.
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab: Kalender */}
        <TabsContent value="kalender" className="mt-4">
          <div className="rounded-md border p-6">
            <div className="flex items-center gap-2 mb-4">
              <CalendarClock className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-base font-semibold">Verfügbarkeitskalender</h2>
            </div>
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm border border-dashed rounded-md">
              <CalendarClock className="h-8 w-8 mb-2 opacity-30" />
              <p>FullCalendar wird in Phase 3 implementiert.</p>
              <p className="text-xs mt-1">
                Hier werden Abwesenheiten und Aufträge als Kalender dargestellt.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog: Fähigkeit zuordnen */}
      <Dialog open={isSkillDialogOpen} onOpenChange={setIsSkillDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Fähigkeit zuordnen</DialogTitle>
            <DialogDescription>
              Wählen Sie eine Fähigkeit, das Kompetenzniveau und optional ein Zertifikatsdatum aus.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="skillSelect">
                Fähigkeit <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedSkillId} onValueChange={setSelectedSkillId}>
                <SelectTrigger id="skillSelect">
                  <SelectValue placeholder="Fähigkeit auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {availableSkills.map((skill) => (
                    <SelectItem key={skill.id} value={skill.id}>
                      {skill.name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({skill.category})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="levelSelect">
                Level <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedLevel}
                onValueChange={(v) => setSelectedLevel(v as SkillLevel)}
              >
                <SelectTrigger id="levelSelect">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BASIC">Basis</SelectItem>
                  <SelectItem value="INTERMEDIATE">Fortgeschritten</SelectItem>
                  <SelectItem value="EXPERT">Experte</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="certifiedUntil">Zertifikat gültig bis (optional)</Label>
              <input
                id="certifiedUntil"
                type="date"
                value={certifiedUntil}
                onChange={(e) => setCertifiedUntil(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsSkillDialogOpen(false)}
                disabled={assignSkill.isPending}
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleAssignSkill}
                disabled={!selectedSkillId || assignSkill.isPending}
              >
                {assignSkill.isPending ? 'Wird zugeordnet...' : 'Zuordnen'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
