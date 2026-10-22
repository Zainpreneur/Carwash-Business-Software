/* ------------------------------------------------------------------
   Car‑wash‑SaaS – Login page with a one‑click Demo Login
   ------------------------------------------------------------------ */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useSignIn } from '@/lib/auth';

export function LoginPage() {
  const navigate = useNavigate();
  const signIn = useSignIn();

  const [email, setEmail] = useState('owner@example.com');
  const [password, setPassword] = useState('Password123!');

  const error = signIn.error;

  function handleDemoLogin() {
    signIn.mutate({ email, password }, {
      onSuccess: () => navigate({ to: '/' }),
      onError: (err) => {
        // keep the form visible; the error will appear under the button
        console.error('Demo login failed', err);
      },
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Access your car wash business</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ----- Email field (pre‑filled with demo address) ----- */}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* ----- Password field (pre‑filled with demo password) ----- */}
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {/* ----- Demo login button (primary) ----- */}
          <Button
            type="button"
            className="w-full"
            onClick={handleDemoLogin}
            disabled={signIn.isPending}
          >
            {signIn.isPending ? 'Signing in…' : 'Demo Login'}
          </Button>

          {/* ----- Manual sign‑in form (optional) ----- */}
          {error && <p className="text-sm text-destructive">{error.message}</p>}

          {/* ----- Divider ----- */}
          <div className="border-t p-2 text-xs text-muted-foreground">
            Or sign in manually
          </div>

          {/* ----- Manual sign‑in form ----- */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              signIn.mutate({ email, password }, {
                onSuccess: () => navigate({ to: '/' }),
                onError: () => {},
              });
            }}
            className="mt-4 space-y-3"
          >
            <Button type="submit" className="w-full">
              Manual Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}