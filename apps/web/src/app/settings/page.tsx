'use client';

import {
  fetchMeThunk,
  selectUser,
  useAppDispatch,
  useAppSelector,
} from '@org/store';
import { Button, Card, UserAvatar } from '@org/ui';
import { startRegistration } from '@simplewebauthn/browser';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { WEB_ENV } from '../../config';

const API_BASE_URL = WEB_ENV.apiUrl;

interface Identity {
  id: string;
  provider: string;
  email: string | null;
  createdAt: string;
}

interface PasskeyInfo {
  id: string;
  label: string | null;
  deviceType: string | null;
  createdAt: string;
}

export default function SettingsPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    if (!user) void dispatch(fetchMeThunk());
  }, [dispatch, user]);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE_URL}/user/identities`, { credentials: 'include' }).then(
        (r) => r.json(),
      ),
      fetch(`${API_BASE_URL}/auth/passkeys`, { credentials: 'include' }).then(
        (r) => r.json(),
      ),
    ])
      .then(([ids, pks]) => {
        setIdentities(ids);
        setPasskeys(pks);
      })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const unlinkProvider = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/user/identities/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message);
      }
      setIdentities((prev) => prev.filter((i) => i.id !== id));
      toast.success('Provider disconnected');
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to unlink');
    }
  };

  const linkProvider = (provider: string) => {
    window.location.href = `${API_BASE_URL}/auth/${provider}`;
  };

  const registerPasskey = async () => {
    setRegistering(true);
    try {
      const optionsRes = await fetch(
        `${API_BASE_URL}/auth/passkey/register/options`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        },
      );
      if (!optionsRes.ok) throw new Error('Failed to get options');
      const options = await optionsRes.json();

      const credential = await startRegistration({ optionsJSON: options });

      const label = prompt('Name this passkey (optional):') ?? undefined;
      const verifyRes = await fetch(
        `${API_BASE_URL}/auth/passkey/register/verify`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential, label }),
        },
      );
      if (!verifyRes.ok) throw new Error('Verification failed');

      toast.success('Passkey registered!');
      const pks = await fetch(`${API_BASE_URL}/auth/passkeys`, {
        credentials: 'include',
      }).then((r) => r.json());
      setPasskeys(pks);
    } catch (e: any) {
      if (e.name === 'NotAllowedError') {
        toast.error('Passkey registration cancelled');
      } else {
        toast.error(e.message ?? 'Failed to register passkey');
      }
    } finally {
      setRegistering(false);
    }
  };

  const deletePasskey = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/passkey/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete');
      setPasskeys((prev) => prev.filter((p) => p.id !== id));
      toast.success('Passkey removed');
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to delete passkey');
    }
  };

  const allProviders = ['google', 'github', 'linkedin'];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <div className="mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-foreground">Settings</h1>
          <Link
            href="/"
            className="text-sm text-foreground/60 hover:text-foreground transition-colors"
          >
            ← Back
          </Link>
        </div>
      </header>

      <main className="mx-auto px-4 py-8 space-y-6">
        {/* Profile */}
        <Card className="rounded-xl p-6">
          <h3 className="font-medium text-foreground mb-4">Profile</h3>
          <div className="flex items-center gap-4">
            <UserAvatar name={user?.name} src={user?.picture} size="lg" />
            <div>
              <p className="font-medium text-foreground">{user?.name}</p>
              <p className="text-sm text-foreground/60">{user?.email}</p>
              <p className="text-xs text-foreground/40 mt-0.5">
                @{user?.username}
              </p>
              <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full bg-primary/50 text-primary">
                {user?.role}
              </span>
            </div>
          </div>
        </Card>

        {/* Connected Accounts */}
        <Card className="rounded-xl p-6">
          <h3 className="font-medium text-foreground mb-4">
            Connected Accounts
          </h3>
          {loading ? (
            <p className="text-sm text-foreground/60">Loading...</p>
          ) : (
            <div className="space-y-3">
              {allProviders.map((provider) => {
                const identity = identities.find(
                  (i) => i.provider === provider,
                );
                return (
                  <div
                    key={provider}
                    className="flex items-center justify-between py-2 border-b border-border/30 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="capitalize font-medium text-sm">
                        {provider}
                      </span>
                      {identity && (
                        <span className="text-xs text-foreground/60">
                          {identity.email}
                        </span>
                      )}
                    </div>
                    {identity ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => unlinkProvider(identity.id)}
                      >
                        Disconnect
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => linkProvider(provider)}
                      >
                        Connect
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Passkeys */}
        <Card className="rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-medium text-foreground">Passkeys</h3>
              <p className="text-xs text-foreground/60 mt-0.5">
                Sign in with fingerprint, face, or security key
              </p>
            </div>
            <Button size="sm" onClick={registerPasskey} isLoading={registering}>
              Add passkey
            </Button>
          </div>

          {passkeys.length === 0 ? (
            <p className="text-sm text-foreground/50">
              No passkeys registered yet.
            </p>
          ) : (
            <div className="space-y-3">
              {passkeys.map((pk) => (
                <div
                  key={pk.id}
                  className="flex items-center justify-between py-2 border-b border-border/30 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {pk.label || 'Unnamed passkey'}
                    </p>
                    <p className="text-xs text-foreground/50">
                      {pk.deviceType ?? 'Unknown device'} · Added{' '}
                      {new Date(pk.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deletePasskey(pk.id)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
