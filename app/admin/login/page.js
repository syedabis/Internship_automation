'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { INK, STATUS, SURFACE } from '../_components/theme';

// Base path — empty string since basePath is root
const BASE_PATH = '';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(`${BASE_PATH}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        router.replace('/admin');
        router.refresh();
        return;
      }

      const result = await response.json().catch(() => ({}));
      setError(result.error || 'Incorrect email or password.');
    } catch {
      setError('Something went wrong. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div
        className="w-full max-w-sm rounded-2xl border p-6 shadow-xl"
        style={{ background: SURFACE.card, borderColor: SURFACE.border }}
      >
        <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--adm-ink-primary)' }}>
          Sign in to Admin Portal
        </h1>
        <p className="text-sm mb-6" style={{ color: INK.secondary }}>
          Sign in to manage certificate submissions and templates.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoFocus
            required
            className="w-full h-11 rounded-lg text-[var(--adm-ink-primary)] placeholder:text-[rgba(var(--adm-ink-primary-rgb),0.3)]"
            style={{ background: SURFACE.cardAlt, borderColor: SURFACE.border }}
          />
          <Input
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            className="w-full h-11 rounded-lg text-[var(--adm-ink-primary)] placeholder:text-[rgba(var(--adm-ink-primary-rgb),0.3)]"
            style={{ background: SURFACE.cardAlt, borderColor: SURFACE.border }}
          />
          {error && (
            <p className="text-xs" style={{ color: STATUS.critical }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 bg-[var(--adm-btn-primary-bg)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-[var(--adm-btn-primary-fg)] font-semibold py-3 px-4 rounded-lg transition-opacity cursor-pointer"
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
