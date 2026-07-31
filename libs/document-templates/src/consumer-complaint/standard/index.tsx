import type { ConsumerComplaintData } from '@org/document-schema';
import { EditableField } from '../../_internals/EditableField';
import { formatDateLong, formatINR } from '../../_internals/format';
import { PagePrintStyles } from '../../_internals/Page';
import { Paginator } from '../../_internals/Paginator';
import type { PageSizeKey } from '../../_internals/page-sizes';

interface Props {
  data: Partial<ConsumerComplaintData>;
  pageSize: PageSizeKey;
  headerText?: string;
  footerText?: string;
}

/** Filing section + commission long-name by forum tier. */
const FORUM: Record<
  string,
  { filingSection: string; commission: string; jurisdictionSection: string }
> = {
  district: {
    filingSection: 'Section 35',
    commission: 'District Consumer Disputes Redressal Commission',
    jurisdictionSection: 'Section 34',
  },
  state: {
    filingSection: 'Section 47',
    commission: 'State Consumer Disputes Redressal Commission',
    jurisdictionSection: 'Section 47',
  },
  national: {
    filingSection: 'Section 58',
    commission: 'National Consumer Disputes Redressal Commission',
    jurisdictionSection: 'Section 58',
  },
};

const GRIEVANCE_LABEL: Record<string, string> = {
  defective_goods: 'defect in the goods',
  deficiency_in_service: 'deficiency in service',
  unfair_trade_practice: 'unfair trade practice',
  overcharging: 'overcharging',
  hazardous_goods: 'supply of hazardous goods/services',
};

/**
 * Standard CPA 2019 consumer complaint (A4). All statutory text is author-written
 * and verified (the AI never authors citations) — filing section branches by forum
 * (§35 District / §47 State / §58 National); pecuniary jurisdiction keyed on the
 * consideration paid; §69 limitation; §39 reliefs. Editable values use
 * <EditableField/> (click-to-edit in preview, plain in the PDF).
 */
export function ConsumerComplaintStandard({ data, pageSize, headerText, footerText }: Props) {
  const forumKey = data.forum ?? 'district';
  const forum = FORUM[forumKey] ?? FORUM.district;
  const complainant = data.complainant;
  const ops = (data.oppositeParties ?? []).filter((o) => o && o.name?.trim());
  const txn = data.transaction;
  const facts = (data.facts ?? []).filter((f) => f && f.trim());
  const reliefs = (data.reliefSought ?? []).filter((r) => r && r.trim());
  const grievanceKind = GRIEVANCE_LABEL[data.grievanceType ?? 'deficiency_in_service'];
  const commissionName = data.commissionName || forum.commission;

  return (
    <>
      <PagePrintStyles pageSize={pageSize} />
      <Paginator pageSize={pageSize} headerText={headerText} footerText={footerText}>
        <h1 style={{ textAlign: 'center' }}>
          BEFORE THE{' '}
          <EditableField
            path="commissionName"
            value={data.commissionName}
            widget="text"
            placeholder={forum.commission}
          >
            {commissionName.toUpperCase()}
          </EditableField>
        </h1>

        <p style={{ textAlign: 'center' }}>
          Consumer Complaint No. ________ of 20____
        </p>

        <section>
          <p>
            <strong>IN THE MATTER OF:</strong>
          </p>
          <p>
            <strong>
              <EditableField
                path="complainant.name"
                value={complainant?.name}
                widget="text"
                placeholder="complainant name"
              />
            </strong>
            {complainant?.address ? (
              <>
                {', '}
                <EditableField
                  path="complainant.address"
                  value={complainant?.address}
                  widget="textarea"
                  placeholder="complainant address"
                />
              </>
            ) : (
              ''
            )}
            <br />… Complainant
          </p>
          <p style={{ textAlign: 'center' }}>VERSUS</p>
          {ops.map((op, i) => (
            <p key={i}>
              <strong>{op.name}</strong>
              {op.role ? ` (${op.role})` : ''}
              {op.address ? `, ${op.address}` : ''}
              <br />… Opposite Party{ops.length > 1 ? ` No. ${i + 1}` : ''}
            </p>
          ))}
        </section>

        <section>
          <h2 style={{ textAlign: 'center' }}>
            COMPLAINT UNDER {forum.filingSection.toUpperCase()} OF THE CONSUMER
            PROTECTION ACT, 2019
          </h2>
          <p>
            The Complainant most respectfully submits as under:
          </p>
        </section>

        <section>
          <ol>
            <li>
              That the Complainant is a “consumer” within the meaning of Section
              2(7) of the Consumer Protection Act, 2019, having{' '}
              {data.grievanceType === 'deficiency_in_service'
                ? 'availed services'
                : 'purchased goods'}{' '}
              for consideration from the Opposite Party
              {ops.length > 1 ? ' parties' : ''} and not for any commercial
              purpose or resale.
            </li>
            <li>
              That on{' '}
              <strong>{formatDateLong(txn?.date)}</strong>, the Complainant{' '}
              {data.grievanceType === 'deficiency_in_service'
                ? 'availed'
                : 'purchased'}{' '}
              <EditableField
                path="transaction.description"
                value={txn?.description}
                widget="textarea"
                placeholder="goods bought / service availed"
              />{' '}
              for a consideration of{' '}
              <strong>{formatINR(txn?.considerationPaid)}</strong>
              {txn?.reference ? ` (ref. ${txn.reference})` : ''}.
            </li>
            <li>
              That the Complainant has suffered on account of {grievanceKind} by
              the Opposite Party, in that{' '}
              <EditableField
                path="grievance"
                value={data.grievance}
                widget="textarea"
                placeholder="the defect / deficiency / unfair practice and the loss suffered"
              />
              .
            </li>
            {facts.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
            <li>
              That the cause of action arose on{' '}
              <strong>{formatDateLong(data.causeOfActionDate)}</strong> and
              continues, and the present complaint is filed within the period of
              two years prescribed by Section 69 of the Consumer Protection Act,
              2019.
            </li>
            <li>
              That this Hon’ble Commission has jurisdiction to entertain this
              complaint: the value of the consideration paid (
              {formatINR(txn?.considerationPaid)}) falls within its pecuniary
              jurisdiction under {forum.jurisdictionSection} of the Act, and the
              cause of action arose, and/or the Opposite Party resides or carries
              on business, within its territorial limits (Section 34(2)).
            </li>
          </ol>
        </section>

        <section>
          <h2>PRAYER</h2>
          <p>
            It is therefore most respectfully prayed that this Hon’ble Commission
            may be pleased to grant the following reliefs under Section 39 of the
            Consumer Protection Act, 2019:
          </p>
          {reliefs.length > 0 ? (
            <ol type="a">
              {reliefs.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
              {data.compensationClaimed ? (
                <li>
                  Compensation of {formatINR(data.compensationClaimed)} towards
                  the loss, mental agony, and harassment suffered;
                </li>
              ) : null}
              <li>Costs of this complaint; and</li>
              <li>
                Any other relief this Hon’ble Commission deems fit in the
                circumstances.
              </li>
            </ol>
          ) : (
            <ol type="a">
              <li>
                Direct the Opposite Party to redress the {grievanceKind} by way
                of refund / replacement / removal of the defect, as appropriate;
              </li>
              {data.compensationClaimed ? (
                <li>
                  Compensation of {formatINR(data.compensationClaimed)} towards
                  the loss, mental agony, and harassment suffered;
                </li>
              ) : null}
              <li>Costs of this complaint; and</li>
              <li>
                Any other relief this Hon’ble Commission deems fit in the
                circumstances.
              </li>
            </ol>
          )}
        </section>

        <section>
          <p style={{ marginTop: '18pt' }}>
            Place:{' '}
            <EditableField
              path="place"
              value={data.place || ''}
              widget="text"
              placeholder="place"
            />
          </p>
          <p>
            Date:{' '}
            <EditableField
              path="complaintDate"
              value={data.complaintDate}
              widget="date"
              placeholder="complaint date"
            >
              {formatDateLong(data.complaintDate)}
            </EditableField>
          </p>
          <p style={{ marginTop: '24pt', textAlign: 'right' }}>
            ____________________________
            <br />
            <strong>{complainant?.name || ''}</strong>
            <br />
            Complainant
          </p>
        </section>

        <section>
          <h2>VERIFICATION</h2>
          <p>
            I, the above-named Complainant, do hereby verify that the contents of
            this complaint are true and correct to the best of my knowledge and
            belief, and that nothing material has been concealed therefrom.
            Verified at{' '}
            <EditableField
              path="place"
              value={data.place || ''}
              widget="text"
              placeholder="place"
            />{' '}
            on {formatDateLong(data.complaintDate)}.
          </p>
          <p style={{ marginTop: '18pt', textAlign: 'right' }}>
            ____________________________
            <br />
            <strong>{complainant?.name || ''}</strong>
            <br />
            Complainant
          </p>
        </section>
      </Paginator>
    </>
  );
}
