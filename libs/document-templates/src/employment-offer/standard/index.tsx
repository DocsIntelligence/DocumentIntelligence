import type { EmploymentOfferData } from '@org/document-schema';
import { EditableField } from '../../_internals/EditableField';
import { formatDateLong } from '../../_internals/format';
import { PagePrintStyles } from '../../_internals/Page';
import { Paginator } from '../../_internals/Paginator';
import type { PageSizeKey } from '../../_internals/page-sizes';

interface Props {
  data: Partial<EmploymentOfferData>;
  pageSize: PageSizeKey;
}

const CURRENCY_SYMBOL: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'AED ',
  SGD: 'S$',
};

const EMPLOYMENT_LABEL: Record<string, string> = {
  full_time: 'full-time',
  part_time: 'part-time',
  contract: 'contract',
  internship: 'internship',
};

/**
 * Employment Offer Letter (A4). Usable for India and globally (currency +
 * optional at-will term). Letter format on the company's name, addressed to
 * the candidate, with role, compensation, numbered terms, and acceptance
 * blocks. No statutory citations — the terms are contractual.
 */
export function EmploymentOfferStandard({ data, pageSize }: Props) {
  const offer = data.offer;
  const company = data.company;
  const candidate = data.candidate;
  const role = data.role;
  const comp = data.compensation;
  const terms = data.terms;

  const symbol = CURRENCY_SYMBOL[comp?.currency ?? 'INR'] ?? '';
  const amount =
    comp?.annualCtc != null ? comp.annualCtc.toLocaleString('en-IN') : '____';
  const period = comp?.payFrequency === 'annual' ? 'per annum' : 'per annum';
  const firstName = (candidate?.name ?? '').trim().split(/\s+/)[0] || 'Candidate';

  let item = 0;
  const num = () => (item += 1);

  return (
    <>
      <PagePrintStyles pageSize={pageSize} />
      <Paginator pageSize={pageSize}>
        <section>
          <p style={{ textAlign: 'right' }}>
            <EditableField
              path="offer.place"
              value={offer?.place}
              widget="text"
              placeholder="place"
            />
            {offer?.place ? ', ' : ''}
            <EditableField
              path="offer.letterDate"
              value={offer?.letterDate}
              widget="date"
              placeholder="date"
            >
              {formatDateLong(offer?.letterDate)}
            </EditableField>
          </p>
          <p>
            <strong>{company?.name || '[Company]'}</strong>
            {company?.address ? (
              <>
                <br />
                {company.address}
              </>
            ) : (
              ''
            )}
          </p>
        </section>

        <h1 style={{ textAlign: 'center' }}>Letter of Offer</h1>

        <section>
          <p>
            To,
            <br />
            <strong>
              <EditableField
                path="candidate.name"
                value={candidate?.name}
                widget="text"
                placeholder="candidate name"
              />
            </strong>
            {candidate?.address ? (
              <>
                <br />
                <EditableField
                  path="candidate.address"
                  value={candidate.address}
                  widget="textarea"
                  placeholder="candidate address"
                />
              </>
            ) : (
              ''
            )}
          </p>

          <p>Dear {firstName},</p>

          <p>
            We are delighted to offer you the position of{' '}
            <strong>
              <EditableField
                path="role.title"
                value={role?.title}
                widget="text"
                placeholder="job title"
              />
            </strong>{' '}
            ({EMPLOYMENT_LABEL[role?.employmentType ?? 'full_time']})
            {role?.department ? ` in the ${role.department} team` : ''} at{' '}
            {company?.name || 'our company'}
            {role?.location ? `, based at ${role.location}` : ''}
            {role?.reportingTo ? `, reporting to ${role.reportingTo}` : ''}.
          </p>
        </section>

        <section>
          <h2>Compensation</h2>
          <p>
            Your total compensation will be{' '}
            <strong>
              {symbol}
              {amount}
            </strong>{' '}
            {period}.
            {comp?.breakup ? ` The break-up is as follows: ${comp.breakup}.` : ''}
            {comp?.variablePay ? ` Variable pay: ${comp.variablePay}.` : ''}
          </p>
        </section>

        <section>
          <h2>Terms of Employment</h2>
          <ol>
            <li>
              Your employment is expected to commence on{' '}
              <strong>{formatDateLong(role?.startDate) || '____'}</strong>.
            </li>
            {role?.probationMonths ? (
              <li>
                You will be on probation for {role.probationMonths} month(s) from
                your date of joining.
              </li>
            ) : null}
            {terms?.workingHours ? (
              <li>Working hours: {terms.workingHours}.</li>
            ) : null}
            <li>
              Either party may terminate the employment by giving{' '}
              {terms?.noticePeriodDays ?? 30} days&rsquo; written notice
              {terms?.atWill
                ? ', or as otherwise permitted for at-will employment'
                : ''}
              .
            </li>
            {terms?.confidentiality !== false ? (
              <li>
                You shall keep all confidential and proprietary information of
                the company strictly confidential, during and after your
                employment.
              </li>
            ) : null}
            {terms?.ipAssignment !== false ? (
              <li>
                All intellectual property created by you in the course of your
                employment shall vest exclusively in the company.
              </li>
            ) : null}
            {terms?.backgroundCheck !== false ? (
              <li>
                This offer is contingent on satisfactory background verification
                and your eligibility to work.
              </li>
            ) : null}
          </ol>
        </section>

        <section>
          <p>
            Please confirm your acceptance by signing and returning a copy of
            this letter
            {terms?.acceptBy ? (
              <>
                {' by '}
                <strong>{formatDateLong(terms.acceptBy)}</strong>
              </>
            ) : (
              ''
            )}
            . We look forward to welcoming you to the team.
          </p>
        </section>

        <section>
          <table style={{ marginTop: '20pt' }}>
            <tbody>
              <tr>
                <td style={{ width: '50%', paddingRight: '8pt' }}>
                  <p>For {company?.name || '[Company]'},</p>
                  <p style={{ marginTop: '24pt' }}>
                    ____________________________
                  </p>
                  <p>
                    {company?.signatoryName || ''}
                    {company?.signatoryDesignation
                      ? `, ${company.signatoryDesignation}`
                      : ''}
                  </p>
                </td>
                <td style={{ width: '50%', paddingLeft: '8pt' }}>
                  <p>Accepted by,</p>
                  <p style={{ marginTop: '24pt' }}>
                    ____________________________
                  </p>
                  <p>
                    {candidate?.name || ''}
                    <br />
                    Date: __________________
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </Paginator>
    </>
  );
}
