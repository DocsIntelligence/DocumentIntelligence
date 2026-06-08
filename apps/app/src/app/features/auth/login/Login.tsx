import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginDto } from '@org/dto';
import {
  loginThunk,
  selectAuth,
  useAppDispatch,
  useAppSelector,
} from '@org/store';
import { Button, FormField, Input, OAuthButtons } from '@org/ui';
import { startAuthentication } from '@simplewebauthn/browser';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { APP_ENV } from '../../../../config';
import { consumeRedirectTarget, setRedirectTarget } from '../redirect-target';

const API_BASE_URL = APP_ENV.apiUrl;

export function Login() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { status } = useAppSelector(selectAuth);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginDto>({ resolver: zodResolver(loginSchema) });

  // Mirror react-router's in-memory `from` into sessionStorage so OAuth
  // round-trips (full-page navigation away and back) preserve it.
  const fromState = (
    location.state as { from?: { pathname: string; search?: string } } | null
  )?.from;
  if (fromState?.pathname) {
    setRedirectTarget(fromState.pathname + (fromState.search ?? ''));
  }

  function nextDestination(): string {
    return consumeRedirectTarget() ?? '/dashboard';
  }

  const onSubmit = handleSubmit(async (values) => {
    const result = await dispatch(loginThunk(values));
    if (loginThunk.fulfilled.match(result)) {
      toast.success(t('auth.login.welcomeBack', 'Welcome back!'));
      navigate(nextDestination(), { replace: true });
    } else {
      toast.error(t('auth.login.invalidCredentials', 'Invalid credentials'));
    }
  });

  const loginWithPasskey = async () => {
    setPasskeyLoading(true);
    try {
      // Get authentication options
      const optionsRes = await fetch(
        `${API_BASE_URL}/auth/passkey/login/options`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
      );
      if (!optionsRes.ok) throw new Error('Failed to get options');
      const { _challengeKey, ...options } = await optionsRes.json();

      // Prompt user for passkey
      const credential = await startAuthentication({ optionsJSON: options });

      // Verify with server
      const verifyRes = await fetch(
        `${API_BASE_URL}/auth/passkey/login/verify`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential, challengeKey: _challengeKey }),
        },
      );
      if (!verifyRes.ok) throw new Error('Verification failed');

      toast.success(t('auth.login.passkeySuccess', 'Signed in with passkey!'));
      navigate(nextDestination(), { replace: true });
    } catch (e: any) {
      if (e.name === 'NotAllowedError') {
        // User cancelled
      } else {
        toast.error(
          e.message ?? t('auth.login.passkeyFailed', 'Passkey login failed'),
        );
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          {t('auth.login.title', 'Sign in')}
        </h2>
        <p className="text-sm text-foreground/60 mt-1">
          {t(
            'auth.login.subtitle',
            'Enter your credentials to access your account',
          )}
        </p>
      </div>

      <div className="space-y-4">
        <FormField
          label={t('auth.login.identifierLabel', 'Email or username')}
          error={errors.identifier?.message}
        >
          <Input
            placeholder="you@example.com"
            autoComplete="username"
            hasError={!!errors.identifier}
            {...register('identifier')}
          />
        </FormField>
        <FormField
          label={t('auth.common.password', 'Password')}
          error={errors.password?.message}
        >
          <Input
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            hasError={!!errors.password}
            {...register('password')}
          />
        </FormField>
      </div>

      <Button type="submit" isLoading={status === 'pending'} className="w-full">
        {t('auth.login.title', 'Sign in')}
      </Button>

      {/* Passkey login */}
      <Button
        type="button"
        variant="outline"
        isLoading={passkeyLoading}
        className="w-full"
        onClick={loginWithPasskey}
      >
        <svg
          className="size-4 mr-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
          />
        </svg>
        {t('auth.login.passkeyButton', 'Sign in with passkey')}
      </Button>

      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-background px-2 text-foreground/60">
            {t('auth.common.orContinueWith', 'or continue with')}
          </span>
        </div>
      </div>

      <OAuthButtons apiUrl={API_BASE_URL} />

      <div className="text-sm flex items-center justify-between pt-2">
        <Link to="/forgot-password" className="text-primary hover:underline">
          {t('auth.login.forgotPassword', 'Forgot password?')}
        </Link>
        <Link to="/register" className="text-primary hover:underline">
          {t('auth.login.createAccount', 'Create account')}
        </Link>
      </div>
    </form>
  );
}

export default Login;
