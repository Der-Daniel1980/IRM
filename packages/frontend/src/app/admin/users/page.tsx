'use client';

import { useState } from 'react';
import { UserPlus, Plus, Pencil, UserX, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  useAdminUsers,
  useAdminRoles,
  useCreateAdminUser,
  useUpdateAdminUser,
  useDeactivateAdminUser,
  useAssignAdminRoles,
  type CreateUserData,
  type KeycloakUser,
  type KeycloakRole,
} from '@/hooks/use-admin';

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

const IRM_ROLES = [
  'irm-admin',
  'irm-disponent',
  'irm-objektverwalter',
  'irm-mitarbeiter',
  'irm-readonly',
];

function getRoleBadgeVariant(role: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (role === 'irm-admin') return 'destructive';
  if (role === 'irm-disponent') return 'default';
  return 'secondary';
}

// ─── Benutzer-Formular ───────────────────────────────────────────────────────

interface UserFormProps {
  onSubmit: (data: CreateUserData) => Promise<void>;
  onClose: () => void;
  isLoading: boolean;
}

function CreateUserForm({ onSubmit, onClose, isLoading }: UserFormProps) {
  const [formData, setFormData] = useState<CreateUserData>({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    initialPassword: '',
    roles: [],
    enabled: true,
  });

  const toggleRole = (role: string) => {
    setFormData((prev) => ({
      ...prev,
      roles: prev.roles?.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...(prev.roles ?? []), role],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">Vorname *</Label>
          <Input
            id="firstName"
            value={formData.firstName}
            onChange={(e) => setFormData((p) => ({ ...p, firstName: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Nachname *</Label>
          <Input
            id="lastName"
            value={formData.lastName}
            onChange={(e) => setFormData((p) => ({ ...p, lastName: e.target.value }))}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Benutzername *</Label>
        <Input
          id="username"
          value={formData.username}
          onChange={(e) => setFormData((p) => ({ ...p, username: e.target.value }))}
          placeholder="max.mustermann"
          required
          minLength={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">E-Mail *</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
          placeholder="max.mustermann@firma.de"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="initialPassword">Initialkennwort (temporar)</Label>
        <Input
          id="initialPassword"
          type="password"
          value={formData.initialPassword ?? ''}
          onChange={(e) => setFormData((p) => ({ ...p, initialPassword: e.target.value }))}
          placeholder="Mindestens 8 Zeichen"
          minLength={8}
        />
        <p className="text-xs text-muted-foreground">
          Der Benutzer muss das Kennwort beim ersten Login andern.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Rollen</Label>
        <div className="grid grid-cols-2 gap-2">
          {IRM_ROLES.map((role) => (
            <div key={role} className="flex items-center gap-2">
              <Checkbox
                id={`role-${role}`}
                checked={formData.roles?.includes(role) ?? false}
                onCheckedChange={() => toggleRole(role)}
              />
              <Label htmlFor={`role-${role}`} className="font-mono text-sm font-normal cursor-pointer">
                {role}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Wird erstellt...' : 'Benutzer erstellen'}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ─── Rollen-Zuweisung Dialog ─────────────────────────────────────────────────

interface AssignRolesDialogProps {
  user: KeycloakUser;
  onClose: () => void;
}

function AssignRolesDialog({ user, onClose }: AssignRolesDialogProps) {
  const { data: allRoles } = useAdminRoles();
  const assignRoles = useAssignAdminRoles(user.id);

  const irmRolesAvailable = allRoles
    ? allRoles.filter((r) => r.name.startsWith('irm-'))
    : IRM_ROLES.map((name): KeycloakRole => ({ id: name, name, composite: false, clientRole: false, containerId: '' }));

  const [selectedRoles, setSelectedRoles] = useState<string[]>(
    user.realmRoles?.filter((r) => r.startsWith('irm-')) ?? [],
  );

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  const handleSave = async () => {
    await assignRoles.mutateAsync(selectedRoles);
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Rollen zuweisen</DialogTitle>
        <DialogDescription>
          Rollen fur {user.firstName} {user.lastName} ({user.username})
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 py-4">
        {irmRolesAvailable.map((role) => (
          <div key={role.name} className="flex items-center gap-3">
            <Checkbox
              id={`assign-${role.name}`}
              checked={selectedRoles.includes(role.name)}
              onCheckedChange={() => toggleRole(role.name)}
            />
            <div>
              <Label
                htmlFor={`assign-${role.name}`}
                className="font-mono text-sm cursor-pointer"
              >
                {role.name}
              </Label>
              {role.description && (
                <p className="text-xs text-muted-foreground">{role.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Abbrechen
        </Button>
        <Button onClick={handleSave} disabled={assignRoles.isPending}>
          {assignRoles.isPending ? 'Wird gespeichert...' : 'Rollen speichern'}
        </Button>
      </DialogFooter>
    </>
  );
}

// ─── Hauptkomponente ─────────────────────────────────────────────────────────

export default function BenutzerVerwaltungPage() {
  const { data: users, isLoading, isError, error } = useAdminUsers();
  const createUser = useCreateAdminUser();
  const deactivateUser = useDeactivateAdminUser();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [assignRolesUser, setAssignRolesUser] = useState<KeycloakUser | null>(null);
  const [editUser, setEditUser] = useState<KeycloakUser | null>(null);

  // Update-Mutation wird inline definiert, um den User-Hook korrekt aufzurufen
  const updateUser = useUpdateAdminUser(editUser?.id ?? '');

  const handleCreate = async (data: CreateUserData) => {
    await createUser.mutateAsync(data);
    setIsCreateOpen(false);
  };

  const handleDeactivate = async (user: KeycloakUser) => {
    if (
      window.confirm(
        `Benutzer "${user.username}" wirklich deaktivieren?\n\nDer Benutzer kann sich danach nicht mehr anmelden.`,
      )
    ) {
      await deactivateUser.mutateAsync(user.id);
    }
  };

  const handleUpdateEnabled = async (user: KeycloakUser) => {
    await updateUser.mutateAsync({ enabled: !user.enabled });
  };

  const isKeycloakUnavailable =
    isError && (error as Error)?.message?.includes('nicht erreichbar');

  return (
    <div className="space-y-6">
      {/* Seitenheader */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserPlus className="h-7 w-7 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Benutzerverwaltung</h1>
            <p className="text-sm text-muted-foreground">
              {users ? `${users.length} Benutzer im System` : 'Keycloak-Benutzer verwalten'}
            </p>
          </div>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Neuer Benutzer
        </Button>
      </div>

      {/* Keycloak-Fehlerhinweis */}
      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            {isKeycloakUnavailable
              ? 'Keycloak ist derzeit nicht erreichbar. Bitte spater erneut versuchen.'
              : 'Fehler beim Laden der Benutzerdaten. Bitte Seite neu laden.'}
          </p>
        </div>
      )}

      {/* Tabelle */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Benutzername</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">E-Mail</TableHead>
              <TableHead>Rollen</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  Benutzer werden geladen...
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !isError && users?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  Keine Benutzer gefunden.
                </TableCell>
              </TableRow>
            )}

            {users?.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-mono text-sm font-medium">
                  {user.username}
                </TableCell>
                <TableCell>
                  <div className="font-medium">
                    {user.firstName} {user.lastName}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                  {user.email}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {user.realmRoles
                      ?.filter((r) => r.startsWith('irm-'))
                      .map((role) => (
                        <Badge key={role} variant={getRoleBadgeVariant(role)} className="text-xs">
                          {role.replace('irm-', '')}
                        </Badge>
                      ))}
                    {(!user.realmRoles || user.realmRoles.filter((r) => r.startsWith('irm-')).length === 0) && (
                      <span className="text-xs text-muted-foreground">Keine IRM-Rollen</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={user.enabled ? 'default' : 'outline'}>
                    {user.enabled ? 'Aktiv' : 'Deaktiviert'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Rollen zuweisen"
                      onClick={() => setAssignRolesUser(user)}
                    >
                      <ShieldCheck className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Benutzer bearbeiten"
                      onClick={() => setEditUser(user)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {user.enabled && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Benutzer deaktivieren"
                        onClick={() => handleDeactivate(user)}
                      >
                        <UserX className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                    {!user.enabled && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Benutzer aktivieren"
                        onClick={() => handleUpdateEnabled(user)}
                      >
                        <UserPlus className="h-4 w-4 text-green-600" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Neuer-Benutzer-Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Neuen Benutzer erstellen</DialogTitle>
            <DialogDescription>
              Legt einen neuen Benutzer in Keycloak an.
            </DialogDescription>
          </DialogHeader>
          <CreateUserForm
            onSubmit={handleCreate}
            onClose={() => setIsCreateOpen(false)}
            isLoading={createUser.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Rollen-Zuweisung-Dialog */}
      <Dialog
        open={Boolean(assignRolesUser)}
        onOpenChange={(open) => { if (!open) setAssignRolesUser(null); }}
      >
        <DialogContent className="max-w-sm">
          {assignRolesUser && (
            <AssignRolesDialog
              user={assignRolesUser}
              onClose={() => setAssignRolesUser(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Bearbeiten-Dialog */}
      <Dialog
        open={Boolean(editUser)}
        onOpenChange={(open) => { if (!open) setEditUser(null); }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Benutzer bearbeiten</DialogTitle>
            <DialogDescription>
              {editUser && `${editUser.firstName} ${editUser.lastName} (${editUser.username})`}
            </DialogDescription>
          </DialogHeader>
          {editUser && (
            <EditUserForm
              user={editUser}
              onClose={() => setEditUser(null)}
              onSave={async (data) => {
                await updateUser.mutateAsync(data);
                setEditUser(null);
              }}
              isLoading={updateUser.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Bearbeiten-Formular ─────────────────────────────────────────────────────

interface EditUserFormProps {
  user: KeycloakUser;
  onClose: () => void;
  onSave: (data: { email?: string; firstName?: string; lastName?: string }) => Promise<void>;
  isLoading: boolean;
}

function EditUserForm({ user, onClose, onSave, isLoading }: EditUserFormProps) {
  const [email, setEmail] = useState(user.email);
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({ email, firstName, lastName });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-firstName">Vorname</Label>
          <Input
            id="edit-firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-lastName">Nachname</Label>
          <Input
            id="edit-lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-email">E-Mail</Label>
        <Input
          id="edit-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Wird gespeichert...' : 'Speichern'}
        </Button>
      </DialogFooter>
    </form>
  );
}
