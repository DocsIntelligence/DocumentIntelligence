import { APP_CONFIG } from '@org/utils';
import { LegalPage, LegalSection } from '../../components/site/legal-page';
import { SiteFooter } from '../../components/site/site-footer';
import { SiteHeader } from '../../components/site/site-header';
import { SITE_NAME } from '../../lib/site';

export const metadata = {
  title: `Terms of service — ${SITE_NAME}`,
  description: `The terms that govern your use of ${SITE_NAME}.`,
};

export default function TermsPage() {
  return (
    <>
      <SiteHeader authed={false} />
      <LegalPage title="Terms of service" updated="23 July 2026">
        <LegalSection heading="1. Not a law firm, not legal advice">
          <p>
            {SITE_NAME} is a document-drafting tool. It is not a law firm,
            does not provide legal advice, and using it does not create an
            advocate–client relationship. Statutory citations are sourced
            from a curated reference library for informational drafting
            support — you remain responsible for reviewing any document
            before signing, filing or relying on it, and should consult a
            qualified advocate for advice specific to your situation.
          </p>
        </LegalSection>

        <LegalSection heading="2. Your account">
          <p>
            You must provide accurate information to register and are
            responsible for activity under your account. Notify us promptly
            of any unauthorised use.
          </p>
        </LegalSection>

        <LegalSection heading="3. Subscriptions & billing">
          <p>
            Paid plans are billed in advance on the interval shown at
            checkout. You can cancel anytime from Settings; cancellation
            takes effect at the end of the current billing period. Fees are
            non-refundable except where required by law.
          </p>
        </LegalSection>

        <LegalSection heading="4. Acceptable use">
          <p>
            Don't use {SITE_NAME} to draft documents intended to defraud,
            harass, or misrepresent identity, or to circumvent a court order.
            We may suspend accounts that violate this or abuse the AI
            copilot (e.g. automated scraping of the citation library).
          </p>
        </LegalSection>

        <LegalSection heading="5. Your content">
          <p>
            You retain ownership of documents you create. You grant us a
            limited licence to store, render and process that content solely
            to provide the service to you (preview, export, AI drafting when
            you invoke it).
          </p>
        </LegalSection>

        <LegalSection heading="6. Disclaimers & liability">
          <p>
            The service is provided "as is." To the extent permitted by law,
            {` ${APP_CONFIG.name} `}is not liable for indirect or
            consequential losses, or for outcomes arising from a document you
            chose to file, sign or rely on without independent legal review.
          </p>
        </LegalSection>

        <LegalSection heading="7. Governing law">
          <p>
            These terms are governed by the laws of India, subject to the
            exclusive jurisdiction of the courts where {APP_CONFIG.name} is
            headquartered.
          </p>
        </LegalSection>

        <LegalSection heading="8. Contact">
          <p>
            Questions about these terms:{' '}
            <a
              href={`mailto:${APP_CONFIG.support.email}`}
              className="font-medium text-primary hover:underline"
            >
              {APP_CONFIG.support.email}
            </a>
            .
          </p>
        </LegalSection>
      </LegalPage>
      <SiteFooter />
    </>
  );
}
