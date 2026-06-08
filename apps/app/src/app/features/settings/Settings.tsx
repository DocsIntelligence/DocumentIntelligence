import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { selectUser, useAppSelector } from '@org/store';
import {
  Button,
  Card,
  LanguageSwitcher,
  ThemeSwitcher,
  UserAvatar,
} from '@org/ui';
import { toast } from 'sonner';
import { startRegistration } from '@simplewebauthn/browser';
import { APP_ENV } from '../../../config';

const API_BASE_URL = APP_ENV.apiUrl;

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

export function Settings() {
  const { t } = useTranslation();
  const user = useAppSelector(selectUser);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE_URL}/auth/providers`, { credentials: 'include' }).then(
        (r) => r.json(),
      ),
      fetch(`${API_BASE_URL}/user/identities`, { credentials: 'include' }).then(
        (r) => r.json(),
      ),
      fetch(`${API_BASE_URL}/auth/passkeys`, { credentials: 'include' }).then(
        (r) => r.json(),
      ),
    ])
      .then(([_providers, ids, pks]) => {
        setIdentities(ids);
        setPasskeys(pks);
      })
      .catch(() =>
        toast.error(t('settings.loadError', 'Failed to load settings')),
      )
      .finally(() => setLoading(false));
  }, [t]);

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
      toast.success(
        t('settings.providerDisconnected', 'Provider disconnected'),
      );
    } catch (e: any) {
      toast.error(e.message ?? t('settings.unlinkError', 'Failed to unlink'));
    }
  };

  const linkProvider = (provider: string) => {
    window.location.href = `${API_BASE_URL}/auth/${provider}`;
  };

  const registerPasskey = async () => {
    setRegistering(true);
    try {
      // Get registration options from server
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

      // Start WebAuthn registration in browser
      const credential = await startRegistration({ optionsJSON: options });

      // Verify with server
      const label =
        prompt(
          t('settings.namePasskeyPrompt', 'Name this passkey (optional):'),
        ) ?? undefined;
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

      toast.success(t('settings.passkeyRegistered', 'Passkey registered!'));
      // Refresh passkeys list
      const pks = await fetch(`${API_BASE_URL}/auth/passkeys`, {
        credentials: 'include',
      }).then((r) => r.json());
      setPasskeys(pks);
    } catch (e: any) {
      if (e.name === 'NotAllowedError') {
        toast.error(
          t('settings.passkeyCancelled', 'Passkey registration cancelled'),
        );
      } else {
        toast.error(
          e.message ?? t('settings.passkeyError', 'Failed to register passkey'),
        );
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
      toast.success(t('settings.passkeyRemoved', 'Passkey removed'));
    } catch (e: any) {
      toast.error(
        e.message ??
          t('settings.passkeyDeleteError', 'Failed to delete passkey'),
      );
    }
  };

  const allProviders = ['google', 'github', 'linkedin'];

  if (loading) {
    return (
      <div className="text-sm text-foreground/60">
        {t('settings.loading', 'Loading settings...')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">
          {t('settings.title', 'Settings')}
        </h2>
        <p className="text-foreground/60 mt-1">
          {t(
            'settings.subtitle',
            'Manage your account, connected providers, and passkeys',
          )}
        </p>
      </div>

      {/* Profile */}
      <Card className="rounded-xl p-6">
        <h3 className="font-medium text-foreground mb-4">
          {t('settings.profile', 'Profile')}
        </h3>
        <div className="flex items-center gap-4">
          <UserAvatar name={user?.name} size="lg" />
          <div>
            <p className="font-medium text-foreground">{user?.name}</p>
            <p className="text-sm text-foreground/60">{user?.email}</p>
            <p className="text-xs text-foreground/40 mt-0.5">
              @{user?.username}
            </p>
            <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {user?.role}
            </span>
          </div>
        </div>
      </Card>

      {/* Connected Accounts */}
      <Card className="rounded-xl p-6">
        <h3 className="font-medium text-foreground mb-4">
          {t('settings.connectedAccounts', 'Connected Accounts')}
        </h3>
        <div className="space-y-3">
          {allProviders.map((provider) => {
            const identity = identities.find((i) => i.provider === provider);
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
                    {t('settings.disconnect', 'Disconnect')}
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => linkProvider(provider)}
                  >
                    {t('settings.connect', 'Connect')}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Passkeys */}
      <Card className="rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-medium text-foreground">
              {t('settings.passkeys', 'Passkeys')}
            </h3>
            <p className="text-xs text-foreground/60 mt-0.5">
              {t(
                'settings.passkeysHint',
                'Sign in with fingerprint, face, or security key',
              )}
            </p>
          </div>
          <Button size="sm" onClick={registerPasskey} isLoading={registering}>
            {t('settings.addPasskey', 'Add passkey')}
          </Button>
        </div>

        {passkeys.length === 0 ? (
          <p className="text-sm text-foreground/50">
            {t('settings.noPasskeys', 'No passkeys registered yet.')}
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
                    {pk.label ||
                      t('settings.unnamedPasskey', 'Unnamed passkey')}
                  </p>
                  <p className="text-xs text-foreground/50">
                    {t('settings.passkeyMeta', '{{device}} · Added {{date}}', {
                      device:
                        pk.deviceType ??
                        t('settings.unknownDevice', 'Unknown device'),
                      date: new Date(pk.createdAt).toLocaleDateString(),
                    })}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deletePasskey(pk.id)}
                >
                  {t('settings.remove', 'Remove')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Preferences */}
      <Card className="rounded-xl p-6">
        <h3 className="font-medium text-foreground mb-4">
          {t('settings.language', 'Language')} & {t('settings.theme', 'Theme')}
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground/70">
              {t('settings.language', 'Language')}
            </span>
            <LanguageSwitcher />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground/70">
              {t('settings.theme', 'Theme')}
            </span>
            <ThemeSwitcher />
          </div>
        </div>
      </Card>
    </div>
  );
}

export default Settings;
