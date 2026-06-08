import type { LegalNoticeData } from '@org/document-schema';
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
  data: Partial<LegalNoticeData>;
  pageSize: PageSizeKey;
}

const DELIVERY_LABEL: Record<string, string> = {
  registered_post_ad: 'By Registered Post (Acknowledgement Due)',
  email: 'By Email',
  courier: 'By Courier',
  hand: 'By Hand',
};

const TYPE_PROCEEDING: Record<string, string> = {
  cheque_bounce:
    'including a complaint under Section 138 of the Negotiable Instruments Act, 1881',
  consumer:
    'including a complaint before the appropriate Consumer Disputes Redressal Commission under the Consumer Protection Act, 2019',
  civil_recovery: 'including a suit for recovery',
  employment: 'including appropriate proceedings before the competent forum',
  general: 'as my client may be advised',
};

/**
 * Formal pre-litigation Legal Notice (A4). Branches on `noticeType`; the
 * cheque-bounce variant carries the NI Act §138 framing. Statutory references
 * are author-written and verified (the AI never authors citations). Editable
 * values use <EditableField/> (click-to-edit in preview, plain in the PDF).
 */
export function LegalNoticeFormal({ data, pageSize }: Props) {
  const adv = data.advocate;
  const useAdvocate = data.throughAdvocate !== false && !!adv?.name;
  const sender = data.sender;
  const recipient = data.recipient;
  const c = data.content;
  const cheque = data.cheque;
  const facts = (c?.facts ?? []).filter((f) => f && f.trim());
  const type = data.noticeType ?? 'general';
  const days = c?.complianceDays ?? 15;

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

        <h1>Legal Notice</h1>

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
                path="recipient.name"
                value={recipient?.name}
                widget="text"
                placeholder="noticee name"
              />
            </strong>
            <br />
            <EditableField
              path="recipient.address"
              value={recipient?.address}
              widget="textarea"
              placeholder="noticee address"
            />
          </p>
        </section>

        <section>
          <p>
            <strong>Subject:</strong>{' '}
            <EditableField
              path="content.subject"
              value={c?.subject}
              widget="text"
              placeholder="subject of the notice"
            />
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
                    path="sender.name"
                    value={sender?.name}
                    widget="text"
                    placeholder="client name"
                  />
                </strong>
                {sender?.address ? (
                  <>
                    {', residing/carrying on business at '}
                    <EditableField
                      path="sender.address"
                      value={sender?.address}
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
                    path="sender.name"
                    value={sender?.name}
                    widget="text"
                    placeholder="your name"
                  />
                </strong>
                {sender?.address ? (
                  <>
                    {', residing/carrying on business at '}
                    <EditableField
                      path="sender.address"
                      value={sender?.address}
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
            {facts.length > 0 ? (
              facts.map((f: string, i: number) => <li key={i}>{f}</li>)
            ) : (
              <li>
                <EditableField
                  path="content.facts"
                  value={undefined}
                  widget="textarea"
                  placeholder="the facts giving rise to this notice"
                />
              </li>
            )}
          </ol>
        </section>

        {type === 'cheque_bounce' && (
          <section>
            <p>
              That you issued cheque no.{' '}
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
                ? ` (${formatINRWords(cheque.amount)} Rupees only)`
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
              , in favour of my client. On presentation, the said cheque was
              returned/dishonoured on{' '}
              <strong>{formatDateLong(cheque?.dishonourDate)}</strong> with the
              endorsement &ldquo;
              <EditableField
                path="cheque.dishonourReason"
                value={cheque?.dishonourReason}
                widget="text"
                placeholder="reason for dishonour"
              />
              &rdquo;. The dishonour of the said cheque attracts the
              consequences provided under Section 138 of the Negotiable
              Instruments Act, 1881.
            </p>
          </section>
        )}

        <section>
          <h2>Demand</h2>
          <p>
            You are hereby called upon to{' '}
            {c?.demandText ? (
              <EditableField
                path="content.demandText"
                value={c?.demandText}
                widget="textarea"
                placeholder="what the noticee must do"
              />
            ) : c?.demandAmount ? (
              <>
                pay to my client a sum of{' '}
                <strong>{formatINR(c.demandAmount)}</strong>
                {` (${formatINRWords(c.demandAmount)} Rupees only)`}
              </>
            ) : (
              <EditableField
                path="content.demandText"
                value={undefined}
                widget="textarea"
                placeholder="what the noticee must do"
              />
            )}{' '}
            within{' '}
            <strong>
              <EditableField
                path="content.complianceDays"
                value={days}
                widget="number"
                placeholder="15"
              />{' '}
              days
            </strong>{' '}
            of receipt of this notice, failing which my client shall be
            constrained to initiate appropriate legal proceedings against you,{' '}
            {TYPE_PROCEEDING[type]}, entirely at your risk as to costs and
            consequences, which please note.
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
            <strong>
              {useAdvocate ? adv?.name || '' : sender?.name || ''}
            </strong>
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
