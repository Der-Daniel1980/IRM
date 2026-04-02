import dynamic from 'next/dynamic';

// FullCalendar nutzt Browser-APIs und muss ohne SSR geladen werden
const SchedulingCalendar = dynamic(
  () => import('@/components/scheduling/scheduling-calendar'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-96 items-center justify-center">
        <div className="text-muted-foreground text-sm">Kalender wird geladen…</div>
      </div>
    ),
  },
);

export default function EinsatzplanungKalenderPage() {
  return <SchedulingCalendar />;
}
