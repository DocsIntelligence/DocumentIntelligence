import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, type ForgotPasswordDto } from '@org/dto';
import { forgotPasswordThunk, useAppDispatch } from '@org/store';
import { Button, FormField, Input } from '@org/ui';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

export function ForgotPassword() {
  const { t } = useTranslation();
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
      toast.success(
        t('auth.forgot.sent', 'If an account exists, we sent a reset link.'),
      );
    } else {
      toast.error(t('auth.forgot.error', 'Could not start reset flow.'));
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          {t('auth.forgot.title', 'Forgot password')}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {t(
            'auth.forgot.subtitle',
            "Enter your email and we'll send you a reset link",
          )}
        </p>
      </div>

      <div className="space-y-4">
        <FormField
          label={t('auth.common.email', 'Email')}
          error={errors.email?.message}
        >
          <Input
            type="email"
            placeholder="you@example.com"
            hasError={!!errors.email}
            {...register('email')}
          />
        </FormField>
      </div>

      <Button type="submit" isLoading={isSubmitting} className="w-full">
        {t('auth.forgot.submit', 'Send reset link')}
      </Button>

      <div className="text-sm pt-2">
        <Link to="/login" className="text-blue-600 hover:underline">
          {t('auth.common.backToSignIn', '← Back to sign in')}
        </Link>
      </div>
    </form>
  );
}

export default ForgotPassword;
