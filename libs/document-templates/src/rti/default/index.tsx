import type { RtiApplicationData } from '@org/document-schema';
import { EditableField } from '../../_internals/EditableField';
import { formatDateLong } from '../../_internals/format';
import { PagePrintStyles } from '../../_internals/Page';
import { Paginator } from '../../_internals/Paginator';
import type { PageSizeKey } from '../../_internals/page-sizes';

interface Props {
  data: Partial<RtiApplicationData>;
  pageSize: PageSizeKey;
  headerText?: string;
  footerText?: string;
}

const FEE_MODE_LABEL: Record<string, string> = {
  ipo: 'Indian Postal Order',
  dd: 'Demand Draft',
  court_fee_stamp: 'court-fee stamp',
  cash: 'cash',
  online: 'online payment',
};

const FORMAT_LABEL: Record<string, string> = {
  certified_copies: 'certified copies of the documents',
  inspection: 'inspection of the relevant records',
  soft_copy: 'soft copies (CD / email)',
  sample: 'samples of material, where applicable',
};

/**
 * RTI application (Right to Information Act, 2005), A4. Statutory section
 * references are author-written and verified; the AI never authors citations.
 * Editable values use <EditableField/> (click-to-edit in preview, plain text in
 * the PDF/Puppeteer path).
 */
export function RtiDefault({ data, pageSize, headerText, footerText }: Props) {
  const app = data.applicant;
  const auth = data.authority;
  const pio = data.pio;
  const req = data.request;
  const fee = data.fee;
  const questions = (req?.questions ?? []).filter((q) => q && q.trim());
  const place = data.place || '';

  return (
    <>
      <PagePrintStyles pageSize={pageSize} />
      <Paginator pageSize={pageSize} headerText={headerText} footerText={footerText}>
        <h1>Application under the Right to Information Act, 2005</h1>

        <section>
          <p>
            To,
            <br />
            The Public Information Officer,
            <br />
            <strong>
              <EditableField
                path="authority.publicAuthority"
                value={auth?.publicAuthority}
                widget="text"
                placeholder="name of public authority"
              />
            </strong>
            {auth?.department ? (
              <>
                {', '}
                <EditableField
                  path="authority.department"
                  value={auth?.department}
                  widget="text"
                  placeholder="department"
                />
              </>
            ) : (
              ''
            )}
            <br />
            <EditableField
              path="authority.officeAddress"
              value={auth?.officeAddress}
              widget="textarea"
              placeholder="office address"
            />
          </p>
        </section>

        <section>
          <p>
            <strong>Subject:</strong> Request for information under the Right to
            Information Act, 2005 —{' '}
            <EditableField
              path="request.subject"
              value={req?.subject}
              widget="text"
              placeholder="subject of the information"
            />
            .
          </p>
        </section>

        <section>
          <p>Respected Sir/Madam,</p>
          <p>
            I,{' '}
            <strong>
              <EditableField
                path="applicant.name"
                value={app?.name}
                widget="text"
                placeholder="applicant name"
              />
            </strong>
            , a citizen of India, residing at{' '}
            <EditableField
              path="applicant.address"
              value={app?.address}
              widget="textarea"
              placeholder="applicant address"
            />
            , hereby request the following information under Section 6(1) of the
            Right to Information Act, 2005:
          </p>
        </section>

        <section>
          <ol>
            {questions.length > 0 ? (
              questions.map((q: string, i: number) => <li key={i}>{q}</li>)
            ) : (
              <li>
                <EditableField
                  path="request.questions"
                  value={undefined}
                  widget="textarea"
                  placeholder="the specific information you are seeking"
                />
              </li>
            )}
          </ol>
          {(req?.periodFrom || req?.periodTo) && (
            <p>
              The above information is sought for the period{' '}
              <strong>{formatDateLong(req?.periodFrom)}</strong> to{' '}
              <strong>{formatDateLong(req?.periodTo)}</strong>.
            </p>
          )}
        </section>

        <section>
          <p>
            I would prefer to receive the information in the form of{' '}
            {FORMAT_LABEL[req?.preferredFormat ?? 'certified_copies']}. If any
            part of the information sought is held by or is more closely
            connected with another public authority, kindly transfer this
            application to the appropriate authority under Section 6(3) of the
            Act and intimate me of such transfer.
          </p>
          {req?.lifeOrLiberty ? (
            <p>
              <strong>
                As this request concerns the life and liberty of a person, the
                information is required within 48 hours as provided under the
                proviso to Section 7(1) of the Act.
              </strong>
            </p>
          ) : (
            <p>
              I request that the information be furnished within 30 days as
              stipulated under Section 7(1) of the Act.
            </p>
          )}
        </section>

        <section>
          <p>
            {app?.isBPL ? (
              <>
                I am a person below the poverty line (BPL); a copy of the BPL
                certificate is enclosed. Accordingly, no fee is payable under
                the proviso to Section 7(5) of the Act.
              </>
            ) : (
              <>
                The prescribed application fee of{' '}
                <strong>
                  ₹
                  <EditableField
                    path="fee.amount"
                    value={fee?.amount}
                    widget="number"
                    placeholder="10"
                  />
                </strong>{' '}
                is enclosed by way of {FEE_MODE_LABEL[fee?.mode ?? 'ipo']}.
              </>
            )}
          </p>
        </section>

        <section>
          <p>Thanking you,</p>
          <p style={{ marginTop: '18pt' }}>Yours faithfully,</p>
          <p style={{ marginTop: '24pt' }}>____________________________</p>
          <p>
            <strong>{app?.name || ''}</strong>
            {app?.phone ? (
              <>
                <br />
                Phone: {app.phone}
              </>
            ) : (
              ''
            )}
            {app?.email ? (
              <>
                <br />
                Email: {app.email}
              </>
            ) : (
              ''
            )}
          </p>
          <p>
            Place:{' '}
            <EditableField
              path="place"
              value={place}
              widget="text"
              placeholder="place"
            />
            {'   '}Date:{' '}
            <EditableField
              path="applicationDate"
              value={data.applicationDate}
              widget="date"
              placeholder="date"
            >
              {formatDateLong(data.applicationDate)}
            </EditableField>
          </p>
          {pio?.name && (
            <p>
              <em>
                (For the attention of {pio.name}
                {pio.designation ? `, ${pio.designation}` : ''})
              </em>
            </p>
          )}
        </section>
      </Paginator>
    </>
  );
}
