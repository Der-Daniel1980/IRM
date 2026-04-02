export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Willkommen im IRM — Immobilien &amp; Ressourcenmanagement
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Heutige Aufträge" value="—" description="Wird geladen..." />
        <StatCard title="Verfügbare Mitarbeiter" value="—" description="Wird geladen..." />
        <StatCard title="Offene Aufträge" value="—" description="Wird geladen..." />
        <StatCard title="Abwesende Mitarbeiter" value="—" description="Wird geladen..." />
      </div>

      <div className="rounded-lg border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          Phase 0c: Next.js Frontend gestartet. Weitere Module werden in den
          nächsten Phasen implementiert.
        </p>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex flex-row items-center justify-between space-y-0 pb-2">
        <p className="text-sm font-medium">{title}</p>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
