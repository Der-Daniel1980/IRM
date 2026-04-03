'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('http://localhost:3001/api/v1/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password }),
      });

      if (!res.ok) {
        setError('Ungültige Zugangsdaten');
        return;
      }

      const data = await res.json();
      sessionStorage.setItem('irm_token', data.access_token);
      router.push('/');
    } catch {
      setError('Server nicht erreichbar. Bitte versuchen Sie es erneut.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <Card className="w-full max-w-sm shadow-md">
        <CardHeader className="space-y-3 text-center">
          <div className="flex items-center justify-center gap-2 text-primary">
            <Building2 className="h-8 w-8" />
            <span className="text-2xl font-bold tracking-tight">IRM System</span>
          </div>
          <CardTitle className="text-lg font-medium">Anmelden</CardTitle>
          <CardDescription>
            Melden Sie sich mit Ihren Zugangsdaten an
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Benutzername</Label>
              <Input
                id="email"
                type="text"
                autoComplete="username"
                placeholder="Benutzername"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="animate-spin" />
                  Anmelden …
                </>
              ) : (
                'Anmelden'
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Demo:{' '}
              <span className="font-mono">admin</span>
              {' / '}
              <span className="font-mono">admin</span>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
