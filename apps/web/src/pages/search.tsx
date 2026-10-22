/* ------------------------------------------------------------------
   Car‑wash‑SaaS – Search page (placeholder)
   ------------------------------------------------------------------ */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { useNavigate } from '@tanstack/react-router';

export function SearchPage() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = (e.target as HTMLFormElement).querySelector('input')!.value.trim();
    // TODO: integrate Typesense search here.
    // e.g. client.documents.search({ collection: 'customers', q });
    alert(`Searching for: ${q}`);
    navigate({ to: '/' });
  }

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">Search Customers</h1>
      <form onSubmit={handleSearch} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="search-input">Search customer name, email or phone</Label>
          <Input
            id="search-input"
            type="text"
            placeholder="Type a name, email or phone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            required
          />
        </div>
        <Button type="submit">Search</Button>
      </form>
      <p className="text-sm text-muted-foreground">
        Typesense search integration coming soon. This page currently acts as a placeholder.
      </p>
    </div>
  );
}