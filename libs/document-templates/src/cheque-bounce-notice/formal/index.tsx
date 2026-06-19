import type { ChequeBounceNoticeData } from '@org/document-schema';
import { EditableField } from '../../_internals/EditableField';
import {
  formatDateLong,
  formatINR,
  formatINRWords,
} from '../../_internals/format';
import { PagePrintStyles } from '../../_internals/Page';
import { Paginator } from '../../_internals/Paginator';
import type { PageSizeKey } from '../../_internals/page-sizes';

interface Props {
  data: Partial<ChequeBounceNoticeData>;
  pageSize: PageSizeKey;
}

const DELIVERY_LABEL: Record<string, string> = {
  registered_post_ad: 'By Registered Post (Acknowledgement Due)',
  speed_post: 'By Speed Post',
  courier: 'By Courier',
  email: 'By Email',
  hand: 'By Hand',
};

/**
 * Formal §138 NI Act cheque-bounce demand notice (A4). All statutory text is
 * author-written and verified (the AI never authors citations) — §138 proviso
 * (b)/(c) (30-day demand window, 15-day payment window), §141 (officer liability
 * when the drawer is a company), §142 (complaint window). Editable values use
 * <EditableField/> (click-to-edit in preview, plain in the PDF).
 */
export function ChequeBounceFormal({ data, pageSize }: Props) {
  const adv = data.advocate;
  const useAdvocate = data.throughAdvocate !== false && !!adv?.name;
  const payee = data.payee;
  const drawer = data.drawer;
  const cheque = data.cheque;
  const facts = (data.facts ?? []).filter((f) => f && f.trim());
  const officers = (drawer?.officers ?? []).filter((o) => o && o.trim());
  const days = data.complianceDays ?? 15;
  const demand = data.demandAmount ?? cheque?.amount;

  return (
    <>
      <PagePrintStyles pageSize={pageSize} />
      <Paginator pageSize={pageSize}>
        {useAdvocate && (
          <section>
            <p style={{ textAlign: 'center' }}>
              <strong>{adv?.name}</strong>
              {adv?.enrollmentNo
                ? `, Advocate (Enrol. ${adv.enrollmentNo})`
                : ', Advocate'}
              {adv?.address ? (
                <>
                  <br />
                  {adv.address}
                </>
              ) : (
                ''
              )}
              {adv?.phone || adv?.email ? (
                <>
                  <br />
                  {[adv?.phone, adv?.email].filter(Boolean).join('  ·  ')}
                </>
              ) : (
                ''
              )}
            </p>
          </section>
        )}

        <h1>Legal Notice under Section 138 of the Negotiable Instruments Act, 1881</h1>

        <section>
          <p>
            <strong>
              {DELIVERY_LABEL[data.deliveryMode ?? 'registered_post_ad']}
            </strong>
            <br />
            Date:{' '}
            <EditableField
              path="noticeDate"
              value={data.noticeDate}
              widget="date"
              placeholder="notice date"
            >
              {formatDateLong(data.noticeDate)}
            </EditableField>
          </p>
          <p>
            To,
            <br />
            <strong>
              <EditableField
                path="drawer.name"
                value={drawer?.name}
                widget="text"
                placeholder="drawer name"
              />
            </strong>
            <br />
            <EditableField
              path="drawer.address"
              value={drawer?.address}
              widget="textarea"
              placeholder="drawer address"
            />
          </p>
          {drawer?.isCompany && officers.length > 0 && (
            <p>
              And to its officers in charge of and responsible for the conduct
              of its business under Section 141 of the Negotiable Instruments
              Act, 1881:
              <br />
              {officers.join(', ')}
            </p>
          )}
        </section>

        <section>
          <p>
            <strong>Subject:</strong> Demand notice under Section 138 of the
            Negotiable Instruments Act, 1881 for dishonour of cheque no.{' '}
            <EditableField
              path="cheque.number"
              value={cheque?.number}
              widget="text"
              placeholder="cheque no."
            />{' '}
            for {formatINR(cheque?.amount)}.
          </p>
        </section>

        <section>
          <p>Madam/Sir,</p>
          <p>
            {useAdvocate ? (
              <>
                Under instructions from and on behalf of my client,{' '}
                <strong>
                  <EditableField
                    path="payee.name"
                    value={payee?.name}
                    widget="text"
                    placeholder="client (payee) name"
                  />
                </strong>
                {payee?.address ? (
                  <>
                    {', residing/carrying on business at '}
                    <EditableField
                      path="payee.address"
                      value={payee?.address}
                      widget="textarea"
                      placeholder="client address"
                    />
                  </>
                ) : (
                  ''
                )}
                , I hereby serve upon you the following legal notice:
              </>
            ) : (
              <>
                I,{' '}
                <strong>
                  <EditableField
                    path="payee.name"
                    value={payee?.name}
                    widget="text"
                    placeholder="your name"
                  />
                </strong>
                {payee?.address ? (
                  <>
                    {', residing/carrying on business at '}
                    <EditableField
                      path="payee.address"
                      value={payee?.address}
                      widget="textarea"
                      placeholder="your address"
                    />
                  </>
                ) : (
                  ''
                )}
                , hereby serve upon you the following legal notice:
              </>
            )}
          </p>
        </section>

        <section>
          <ol>
            <li>
              That towards a legally enforceable debt/liability, namely{' '}
              <EditableField
                path="underlyingLiability"
                value={data.underlyingLiability}
                widget="textarea"
                placeholder="what the cheque was issued towards"
              />
              , you issued cheque no.{' '}
              <strong>
                <EditableField
                  path="cheque.number"
                  value={cheque?.number}
                  widget="text"
                  placeholder="cheque no."
                />
              </strong>{' '}
              dated <strong>{formatDateLong(cheque?.chequeDate)}</strong> for a
              sum of <strong>{formatINR(cheque?.amount)}</strong>
              {cheque?.amount
                ? ` (${formatINRWords(cheque.amount)} only)`
                : ''}
              , drawn on{' '}
              <strong>
                <EditableField
                  path="cheque.bankName"
                  value={cheque?.bankName}
                  widget="text"
                  placeholder="drawee bank"
                />
              </strong>
              {cheque?.branch ? `, ${cheque.branch} branch` : ''}, in favour of
              my client.
            </li>
            <li>
              That on presentation, the said cheque was returned dishonoured by
              the bank vide its return memo dated{' '}
              <strong>{formatDateLong(cheque?.dishonourDate)}</strong> with the
              remarks &ldquo;
              <EditableField
                path="cheque.dishonourReason"
                value={cheque?.dishonourReason}
                widget="text"
                placeholder="reason for dishonour"
              />
              &rdquo;.
            </li>
            {facts.map((f: string, i: number) => (
              <li key={i}>{f}</li>
            ))}
            <li>
              That the dishonour of the said cheque attracts the penal
              consequences under Section 138 of the Negotiable Instruments Act,
              1881. This notice is issued within 30 days of the receipt of the
              dishonour intimation, as required by the proviso to the said
              section.
            </li>
          </ol>
        </section>

        <section>
          <h2>Demand</h2>
          <p>
            You are hereby called upon to pay to my client the sum of{' '}
            <strong>{formatINR(demand)}</strong>
            {demand ? ` (${formatINRWords(demand)} only)` : ''} within{' '}
            <strong>
              <EditableField
                path="complianceDays"
                value={days}
                widget="number"
                placeholder="15"
              />{' '}
              days
            </strong>{' '}
            of receipt of this notice, failing which my client shall be
            constrained to initiate criminal proceedings against you
            {drawer?.isCompany
              ? ' and the persons in charge of your business under Sections 138 and 141'
              : ' under Section 138'}{' '}
            of the Negotiable Instruments Act, 1881, by way of a complaint to be
            filed within the period of limitation under Section 142, entirely at
            your risk as to costs and consequences, which please note.
          </p>
        </section>

        <section>
          <p style={{ marginTop: '18pt' }}>
            {useAdvocate
              ? 'Advocate for the Complainant/Client,'
              : 'Yours faithfully,'}
          </p>
          <p style={{ marginTop: '24pt' }}>____________________________</p>
          <p>
            <strong>{useAdvocate ? adv?.name || '' : payee?.name || ''}</strong>
          </p>
          <p>
            Place:{' '}
            <EditableField
              path="place"
              value={data.place || ''}
              widget="text"
              placeholder="place"
            />
          </p>
          {useAdvocate && (
            <p>
              <em>
                A copy of this notice is retained in my office for record.
              </em>
            </p>
          )}
        </section>
      </Paginator>
    </>
  );
}
