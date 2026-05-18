'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, type ForgotPasswordDto } from '@org/dto';
import { forgotPasswordThunk, useAppDispatch } from '@org/store';
import { Button, Card, FormField, Input } from '@org/ui';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { SITE_NAME } from '../../lib/site';

export default function ForgotPasswordPage() {
  const dispatch = useAppDispatch();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordDto>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    const result = await dispatch(forgotPasswordThunk(values));
    if (forgotPasswordThunk.fulfilled.match(result)) {
      toast.success('If an account exists, we sent a reset link.');
    } else {
      toast.error('Could not start reset flow.');
    }
  });

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{SITE_NAME}</h1>
          <p className="text-sm text-gray-500 mt-1">Password recovery</p>
        </div>

        <Card className="rounded-xl p-8">
          <form onSubmit={onSubmit} className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Forgot password
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Enter your email and we'll send you a reset link
              </p>
            </div>

            <div className="space-y-4">
              <FormField label="Email" error={errors.email?.message}>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  hasError={!!errors.email}
                  {...register('email')}
                />
              </FormField>
            </div>

            <Button type="submit" isLoading={isSubmitting} className="w-full">
              Send reset link
            </Button>

            <div className="text-sm pt-2">
              <Link href="/login" className="text-blue-600 hover:underline">
                ← Back to sign in
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </main>
  );
}
