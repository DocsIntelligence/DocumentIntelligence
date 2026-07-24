'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { enterpriseLeadSchema, type EnterpriseLeadDto } from '@org/dto';
import { Button, Card, FormField, Input, Textarea } from '@org/ui';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { WEB_ENV } from '../../config';

const TEAM_SIZES: EnterpriseLeadDto['teamSize'][] = [
  '1-10',
  '11-50',
  '51-200',
  '201-1000',
  '1000+',
];

export function EnterpriseContactForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<EnterpriseLeadDto>({
    resolver: zodResolver(enterpriseLeadSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const res = await fetch(`${WEB_ENV.apiUrl}/leads/enterprise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error('Request failed');
      toast.success("Thanks — we'll be in touch shortly.");
      reset();
    } catch {
      toast.error('Could not send your message. Please try again.');
    }
  });

  if (isSubmitSuccessful) {
    return (
      <Card className="rounded-2xl p-8 text-center">
        <h3 className="text-lg font-semibold text-foreground">
          Message received
        </h3>
        <p className="mt-2 text-sm text-foreground/60">
          We typically respond within one business day.
        </p>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl p-8">
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Your name" error={errors.name?.message}>
            <Input
              placeholder="Priya Sharma"
              hasError={!!errors.name}
              {...register('name')}
            />
          </FormField>
          <FormField label="Work email" error={errors.email?.message}>
            <Input
              type="email"
              placeholder="priya@company.com"
              hasError={!!errors.email}
              {...register('email')}
            />
          </FormField>
        </div>

        <FormField label="Company" error={errors.company?.message}>
          <Input
            placeholder="Company or firm name"
            hasError={!!errors.company}
            {...register('company')}
          />
        </FormField>

        <FormField label="Team size" error={errors.teamSize?.message}>
          <select
            className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            defaultValue=""
            {...register('teamSize')}
          >
            <option value="" disabled>
              Select a range
            </option>
            {TEAM_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} people
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="What are you looking to do?" error={errors.message?.message}>
          <Textarea
            rows={4}
            placeholder="Self-hosted deployment, data residency requirements, timeline…"
            hasError={!!errors.message}
            {...register('message')}
          />
        </FormField>

        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Request a conversation
        </Button>
      </form>
    </Card>
  );
}
