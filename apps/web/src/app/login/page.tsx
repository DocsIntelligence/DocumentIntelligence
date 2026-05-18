'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginDto } from '@org/dto';
import {
  loginThunk,
  selectAuth,
  useAppDispatch,
  useAppSelector,
} from '@org/store';
import { Button, Card, FormField, Input, OAuthButtons } from '@org/ui';
import { startAuthentication } from '@simplewebauthn/browser';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { SITE_NAME } from '../../lib/site';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { WEB_ENV } from '../../config';

const API_BASE_URL = WEB_ENV.apiUrl;

function LoginForm() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const params = useSearchParams();
  const { status } = useAppSelector(selectAuth);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginDto>({ resolver: zodResolver(loginSchema) });

  const redirectTo = params.get('next') ?? '/';

  const onSubmit = handleSubmit(async (values) => {
    const result = await dispatch(loginThunk(values));
    if (loginThunk.fulfilled.match(result)) {
      toast.success('Welcome back!');
      router.replace(redirectTo);
    } else {
      toast.error('Invalid credentials');
    }
  });

  const loginWithPasskey = async () => {
    setPasskeyLoading(true);
    try {
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

      const credential = await startAuthentication({ optionsJSON: options });

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

      toast.success('Signed in with passkey!');
      router.replace(redirectTo);
    } catch (e: any) {
      if (e.name !== 'NotAllowedError') {
        toast.error(e.message ?? 'Passkey login failed');
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <Card className="rounded-xl p-8">
      <form onSubmit={onSubmit} className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Sign in</h2>
          <p className="text-sm text-foreground/60 mt-1">
            Enter your credentials to access your account
          </p>
        </div>

        <div className="space-y-4">
          <FormField
            label="Email or username"
            error={errors.identifier?.message}
          >
            <Input
              placeholder="you@example.com"
              autoComplete="username"
              hasError={!!errors.identifier}
              {...register('identifier')}
            />
          </FormField>
          <FormField label="Password" error={errors.password?.message}>
            <Input
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              hasError={!!errors.password}
              {...register('password')}
            />
          </FormField>
        </div>

        <Button
          type="submit"
          isLoading={status === 'pending'}
          className="w-full"
        >
          Sign in
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
          Sign in with passkey
        </Button>

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-2 text-foreground/60">
              or continue with
            </span>
          </div>
        </div>

        <OAuthButtons apiUrl={API_BASE_URL} />

        <div className="text-sm flex items-center justify-between pt-2">
          <Link
            href="/forgot-password"
            className="text-primary hover:underline"
          >
            Forgot password?
          </Link>
          <Link href="/register" className="text-primary hover:underline">
            Create account
          </Link>
        </div>
      </form>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">{SITE_NAME}</h1>
          <p className="text-sm text-foreground/60 mt-1">Welcome back</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
