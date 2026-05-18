import type { ComponentType } from 'react';
import type { PageSizeKey } from './_internals/page-sizes';
import { RentAgreementClassic } from './rent-agreement/classic';

/**
 * Maps template `componentKey` (as stored on DocumentTemplate) to the
 * React component. The artboard and Puppeteer renderer both go through
 * this registry. New templates must add themselves here.
 */

export interface TemplateProps<TData = unknown> {
  data: TData;
  pageSize: PageSizeKey;
}

export type TemplateComponent<TData = unknown> = ComponentType<
  TemplateProps<TData>
>;

const registry: Record<string, TemplateComponent<unknown>> = {
  'rent-agreement.classic': RentAgreementClassic as TemplateComponent<unknown>,
  // Bilingual variant currently aliases to classic until the dedicated
  // component lands. Replace when the bilingual template is implemented.
  'rent-agreement.bilingual':
    RentAgreementClassic as TemplateComponent<unknown>,
};

export function getTemplate<TData = unknown>(
  componentKey: string,
): TemplateComponent<TData> | undefined {
  return registry[componentKey] as TemplateComponent<TData> | undefined;
}

export function listTemplateKeys(): string[] {
  return Object.keys(registry);
}
