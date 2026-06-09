import {
  PrismaClient,
  PaymentType,
  PlanInterval,
  Currency,
  Feature,
  FeatureAction,
} from '@prisma/client';
import { documentTypes } from './seed-data/document-types';

const prisma = new PrismaClient();

async function main() {
  // Free plan — currently unlimited for everyone (dev/MVP).
  // Tighten quantities once pricing tiers go live. Wallet expiry is ~100 years
  // out so users never roll off this plan automatically.
  // upsert.update intentionally mirrors create so re-seeding picks up tier
  // changes without manual cleanup; features are wiped + recreated via
  // deleteMany to avoid drift from earlier seed shapes.
  const freePlanFeatures = [
    { name: Feature.documents, action: FeatureAction.reset, quantity: -1 },
    { name: Feature.ai_tokens, action: FeatureAction.reset, quantity: -1 },
    { name: Feature.ai_attempts, action: FeatureAction.reset, quantity: -1 },
    { name: Feature.storage_mb, action: FeatureAction.reset, quantity: -1 },
    { name: Feature.api_calls, action: FeatureAction.reset, quantity: -1 },
  ];

  await prisma.plan.upsert({
    where: { id: 'free-plan' },
    update: {
      name: 'Free',
      description: 'Unlimited free access (MVP — pricing tiers TBD).',
      type: PaymentType.one_time,
      duration: 100,
      interval: PlanInterval.yearly,
      price: 0,
      currency: Currency.INR,
      active: true,
      features: {
        deleteMany: {},
        create: freePlanFeatures,
      },
    },
    create: {
      id: 'free-plan',
      name: 'Free',
      description: 'Unlimited free access (MVP — pricing tiers TBD).',
      type: PaymentType.one_time,
      duration: 100,
      interval: PlanInterval.yearly,
      price: 0,
      currency: Currency.INR,
      active: true,
      features: { create: freePlanFeatures },
    },
  });

  // Pro Monthly
  await prisma.plan.upsert({
    where: { id: 'pro-monthly' },
    update: {},
    create: {
      id: 'pro-monthly',
      name: 'Pro Monthly',
      description: 'Unlimited access, billed monthly',
      type: PaymentType.subscription,
      duration: 1,
      interval: PlanInterval.monthly,
      price: 499,
      originalPrice: 999,
      discountLabel: '50% OFF',
      priceMultiplier: 100,
      currency: Currency.INR,
      active: true,
      features: {
        create: [
          {
            name: Feature.documents,
            action: FeatureAction.reset,
            quantity: -1,
          },
          {
            name: Feature.ai_tokens,
            action: FeatureAction.reset,
            quantity: 50000,
          },
          {
            name: Feature.ai_attempts,
            action: FeatureAction.reset,
            quantity: -1,
          },
          {
            name: Feature.storage_mb,
            action: FeatureAction.reset,
            quantity: 500,
          },
          {
            name: Feature.api_calls,
            action: FeatureAction.reset,
            quantity: -1,
          },
        ],
      },
    },
  });

  // Pro Yearly
  await prisma.plan.upsert({
    where: { id: 'pro-yearly' },
    update: {},
    create: {
      id: 'pro-yearly',
      name: 'Pro Yearly',
      description: 'Unlimited access, billed annually',
      type: PaymentType.subscription,
      duration: 1,
      interval: PlanInterval.yearly,
      price: 3999,
      originalPrice: 11988,
      discountLabel: '67% OFF',
      priceMultiplier: 100,
      currency: Currency.INR,
      active: true,
      features: {
        create: [
          {
            name: Feature.documents,
            action: FeatureAction.reset,
            quantity: -1,
          },
          {
            name: Feature.ai_tokens,
            action: FeatureAction.reset,
            quantity: -1,
          },
          {
            name: Feature.ai_attempts,
            action: FeatureAction.reset,
            quantity: -1,
          },
          {
            name: Feature.storage_mb,
            action: FeatureAction.reset,
            quantity: 2000,
          },
          {
            name: Feature.api_calls,
            action: FeatureAction.reset,
            quantity: -1,
          },
        ],
      },
    },
  });

  // Starter Monthly (legal-docs entry tier)
  await prisma.plan.upsert({
    where: { id: 'starter-monthly' },
    update: {},
    create: {
      id: 'starter-monthly',
      name: 'Starter Monthly',
      description:
        'Up to 10 documents/month with AI assistance and basic sharing.',
      type: PaymentType.subscription,
      duration: 1,
      interval: PlanInterval.monthly,
      price: 199,
      priceMultiplier: 100,
      currency: Currency.INR,
      active: true,
      features: {
        create: [
          {
            name: Feature.documents,
            action: FeatureAction.reset,
            quantity: 10,
          },
          {
            name: Feature.ai_tokens,
            action: FeatureAction.reset,
            quantity: 20000,
          },
          {
            name: Feature.ai_attempts,
            action: FeatureAction.reset,
            quantity: 100,
          },
          {
            name: Feature.storage_mb,
            action: FeatureAction.reset,
            quantity: 200,
          },
          {
            name: Feature.api_calls,
            action: FeatureAction.reset,
            quantity: 5000,
          },
        ],
      },
    },
  });

  // Agency Monthly (B2B: firms / agencies / advocates with clients)
  await prisma.plan.upsert({
    where: { id: 'agency-monthly' },
    update: {},
    create: {
      id: 'agency-monthly',
      name: 'Agency Monthly',
      description:
        'White-label, unlimited documents, marketplace publishing, seats add-on.',
      type: PaymentType.subscription,
      duration: 1,
      interval: PlanInterval.monthly,
      price: 2499,
      priceMultiplier: 100,
      currency: Currency.INR,
      active: true,
      features: {
        create: [
          {
            name: Feature.documents,
            action: FeatureAction.reset,
            quantity: -1,
          },
          {
            name: Feature.ai_tokens,
            action: FeatureAction.reset,
            quantity: -1,
          },
          {
            name: Feature.ai_attempts,
            action: FeatureAction.reset,
            quantity: 5000,
          },
          {
            name: Feature.storage_mb,
            action: FeatureAction.reset,
            quantity: 5000,
          },
          {
            name: Feature.api_calls,
            action: FeatureAction.reset,
            quantity: -1,
          },
        ],
      },
    },
  });

  // Document-Intelligence premium (agentic) extraction quota per plan.
  // Done as an idempotent per-plan upsert so it lands on every re-seed even
  // though the paid plans above use `update: {}` (immutable post-create).
  // Free = 0 (gated off); paid tiers get a quota or unlimited (-1).
  // NOTE: this adds the PLAN feature; existing user wallets only gain the
  // matching usage row when their wallet is (re)created — checkQuota returns
  // false without that row, which is the correct safe default for free users.
  const premiumExtractionQuota: Record<string, number> = {
    'free-plan': 0,
    'starter-monthly': 20,
    'pro-monthly': -1,
    'pro-yearly': -1,
    'agency-monthly': -1,
  };
  for (const [planId, quantity] of Object.entries(premiumExtractionQuota)) {
    await prisma.planFeature.upsert({
      where: {
        name_planId: { name: Feature.premium_extraction, planId },
      },
      update: { quantity, action: FeatureAction.reset },
      create: {
        name: Feature.premium_extraction,
        planId,
        quantity,
        action: FeatureAction.reset,
      },
    });
  }

  console.log('✅ Plans seeded');

  // ─── Lookups ────────────────────────────────────────────────────────────
  const { lookupGroups } = await import('./seed-data/lookups');

  for (const group of lookupGroups) {
    const existing = await prisma.lookupGroup.findUnique({
      where: { key: group.key },
      include: { values: true },
    });

    if (!existing) {
      await prisma.lookupGroup.create({
        data: {
          key: group.key,
          name: group.name,
          description: group.description,
          isPublic: true,
          values: { create: group.values },
        },
      });
      console.log(
        `  ✓ Created lookup "${group.key}" (${group.values.length} values)`,
      );
      continue;
    }

    const existingValues = new Set(existing.values.map((v) => v.value));
    const newValues = group.values.filter((v) => !existingValues.has(v.value));

    if (newValues.length > 0) {
      await prisma.lookupValue.createMany({
        data: newValues.map((v) => ({ groupId: existing.id, ...v })),
        skipDuplicates: true,
      });
      console.log(
        `  ✓ Lookup "${group.key}" — added ${newValues.length} new values`,
      );
    } else {
      console.log(`  ✓ Lookup "${group.key}" — up to date`);
    }
  }

  console.log('✅ Lookups seeded');

  // ─── Document Types & Templates ────────────────────────────────────────
  for (const type of documentTypes) {
    const dt = await prisma.documentType.upsert({
      where: { key: type.key },
      update: {
        name: type.name,
        category: type.category,
        description: type.description,
        defaultPageSize: type.defaultPageSize,
        jurisdictions: type.jurisdictions,
        iconKey: type.iconKey,
        sortOrder: type.sortOrder,
        schema: type.schemaShape,
        isActive: true,
      },
      create: {
        key: type.key,
        name: type.name,
        category: type.category,
        description: type.description,
        defaultPageSize: type.defaultPageSize,
        jurisdictions: type.jurisdictions,
        iconKey: type.iconKey,
        sortOrder: type.sortOrder,
        schema: type.schemaShape,
        isActive: true,
      },
    });

    for (const tpl of type.templates) {
      await prisma.documentTemplate.upsert({
        where: {
          documentTypeId_key: { documentTypeId: dt.id, key: tpl.key },
        },
        update: {
          name: tpl.name,
          componentKey: tpl.componentKey,
          language: tpl.language,
          jurisdictions: tpl.jurisdictions,
          isPremium: tpl.isPremium ?? false,
          isActive: true,
        },
        create: {
          documentTypeId: dt.id,
          key: tpl.key,
          name: tpl.name,
          componentKey: tpl.componentKey,
          language: tpl.language,
          jurisdictions: tpl.jurisdictions,
          isPremium: tpl.isPremium ?? false,
          isActive: true,
          // system-owned: ownerType / ownerUserId / ownerOrgId left null
        },
      });
    }

    console.log(
      `  ✓ DocumentType "${type.key}" with ${type.templates.length} template(s)`,
    );
  }

  console.log('✅ Document types & templates seeded');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
