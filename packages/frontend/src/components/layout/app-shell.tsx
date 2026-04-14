'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Users,
  UserCog,
  Truck,
  ClipboardList,
  FileText,
  CalendarClock,
  MapPin,
  Route,
  CalendarOff,
  Calculator,
  BarChart3,
  Settings,
  UserPlus,
  Shield,
  Cog,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Immobilien', href: '/properties', icon: Building2 },
  { name: 'Kunden', href: '/customers', icon: Users },
  { name: 'Personal', href: '/staff', icon: UserCog },
  { name: 'Maschinen & KFZ', href: '/equipment', icon: Truck },
  { name: 'Tätigkeiten', href: '/activities', icon: ClipboardList },
  { name: 'Aufträge', href: '/orders', icon: FileText },
  { name: 'Einsatzplanung', href: '/scheduling/calendar', icon: CalendarClock },
  { name: 'Kartenansicht', href: '/map', icon: MapPin },
  { name: 'Laufzettel', href: '/route-sheets', icon: Route },
  { name: 'Urlaub & Abwesenheit', href: '/absences', icon: CalendarOff },
  { name: 'Formel-Designer', href: '/formula-designer', icon: Calculator },
  { name: 'Berichte', href: '/reports', icon: BarChart3 },
];

const adminNavigation = [
  { name: 'Verwaltung', href: '/admin', icon: Settings },
  { name: 'Benutzer', href: '/admin/users', icon: UserPlus },
  { name: 'Rollen & Gruppen', href: '/admin/roles', icon: Shield },
  { name: 'Systemeinstellungen', href: '/admin/settings', icon: Cog },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Building2 className="h-10 w-10 animate-pulse" />
          <p className="text-sm">Anmeldung wird geprüft …</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar transition-transform duration-300 lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-sidebar-border">
          <span className="text-lg font-bold text-sidebar-foreground">
            IRM System
          </span>
          <button
            className="lg:hidden text-sidebar-foreground"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navigation.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.name}
              </Link>
            );
          })}

          {/* Admin Section */}
          <div className="pt-4">
            <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              Administration
            </p>
            {adminNavigation.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer: User info + Logout */}
        <div className="border-t border-sidebar-border px-4 py-3 space-y-2">
          {user && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground text-xs font-semibold uppercase">
                {user.firstName?.[0] ?? user.username[0]}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-sidebar-foreground">
                  {user.fullName || user.username}
                </p>
                <p className="truncate text-xs text-sidebar-foreground/40">
                  {user.email}
                </p>
              </div>
            </div>
          )}
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            Abmelden
          </button>
          <p className="px-2 text-xs text-sidebar-foreground/30">IRM v0.3.0</p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="flex h-16 items-center gap-4 border-b bg-background px-6 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold">IRM System</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
