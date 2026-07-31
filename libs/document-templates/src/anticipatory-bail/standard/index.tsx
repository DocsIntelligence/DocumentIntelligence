import type { AnticipatoryBailData } from '@org/document-schema';
import { EditableField } from '../../_internals/EditableField';
import { formatDateLong } from '../../_internals/format';
import { PagePrintStyles } from '../../_internals/Page';
import { Paginator } from '../../_internals/Paginator';
import type { PageSizeKey } from '../../_internals/page-sizes';

interface Props {
  data: Partial<AnticipatoryBailData>;
  pageSize: PageSizeKey;
  headerText?: string;
  footerText?: string;
}

const COURT: Record<string, { heading: string; fallback: string }> = {
  sessions: { heading: 'IN THE COURT OF SESSION', fallback: 'Court of Session' },
  high_court: { heading: 'IN THE HON’BLE HIGH COURT', fallback: 'High Court' },
};

/**
 * Standard anticipatory-bail application under §482 BNSS (A4). All statutory text
 * is author-written and verified (the AI never authors citations) — §482 (the
 * CrPC §438 successor), forum branched (Court of Session / High Court), §482(2)
 * conditions in the prayer. Editable values use <EditableField/> (click-to-edit
 * in preview, plain in the PDF).
 */
export function AnticipatoryBailStandard({ data, pageSize, headerText, footerText }: Props) {
  const courtKey = data.court ?? 'sessions';
  const court = COURT[courtKey] ?? COURT.sessions;
  const applicant = data.applicant;
  const fir = data.fir;
  const offences = (data.offences ?? []).filter((o) => o && o.trim());
  const grounds = (data.groundsForBail ?? []).filter((g) => g && g.trim());
  const conditions = (data.proposedConditions ?? []).filter((c) => c && c.trim());
  const adv = data.advocate;
  const courtName = data.courtName || court.fallback;
  const guardian = applicant?.guardianName;

  return (
    <>
      <PagePrintStyles pageSize={pageSize} />
      <Paginator pageSize={pageSize} headerText={headerText} footerText={footerText}>
        <h1 style={{ textAlign: 'center' }}>
          {court.heading}
          {data.courtName ? '' : data.state ? `, ${data.state.toUpperCase()}` : ''}
          <br />
          <EditableField
            path="courtName"
            value={data.courtName}
            widget="text"
            placeholder={court.fallback}
          >
            {courtName.toUpperCase()}
          </EditableField>
        </h1>

        <p style={{ textAlign: 'center' }}>
          Anticipatory Bail Application No. ________ of 20____
        </p>

        <section>
          <p>
            <strong>IN THE MATTER OF:</strong>
          </p>
          <p>
            <strong>
              <EditableField
                path="applicant.name"
                value={applicant?.name}
                widget="text"
                placeholder="applicant name"
              />
            </strong>
            {guardian ? `, S/o · D/o · W/o ${guardian}` : ''}
            {applicant?.age != null ? `, aged ${applicant.age} years` : ''}
            {applicant?.occupation ? `, ${applicant.occupation}` : ''}
            {applicant?.address ? (
              <>
                {', r/o '}
                <EditableField
                  path="applicant.address"
                  value={applicant?.address}
                  widget="textarea"
                  placeholder="applicant address"
                />
              </>
            ) : (
              ''
            )}
            <br />… Applicant / Accused
          </p>
          <p style={{ textAlign: 'center' }}>VERSUS</p>
          <p>
            The State{data.state ? ` of ${data.state}` : ''} (through the
            {fir?.policeStation ? ` ${fir.policeStation} ` : ' '}Police Station)
            <br />… Respondent
          </p>
        </section>

        <section>
          <h2 style={{ textAlign: 'center' }}>
            APPLICATION UNDER SECTION 482 OF THE BHARATIYA NAGARIK SURAKSHA
            SANHITA, 2023 FOR GRANT OF ANTICIPATORY BAIL
          </h2>
          {(fir?.number || offences.length > 0) && (
            <p>
              <strong>In re:</strong>{' '}
              {fir?.number ? `FIR No. ${fir.number}` : 'the apprehended FIR'}
              {fir?.date ? ` dated ${formatDateLong(fir.date)}` : ''}
              {fir?.policeStation ? `, P.S. ${fir.policeStation}` : ''}
              {fir?.district ? `, District ${fir.district}` : ''}
              {offences.length > 0
                ? `, for offences under ${offences.join(', ')}`
                : ''}
              .
            </p>
          )}
        </section>

        <section>
          <p>
            The Applicant above-named most respectfully submits as under:
          </p>
          <ol>
            <li>
              That the Applicant reasonably apprehends arrest at the hands of the
              Respondent in connection with the aforesaid matter, in that{' '}
              <EditableField
                path="apprehensionGrounds"
                value={data.apprehensionGrounds}
                widget="textarea"
                placeholder="why the applicant apprehends arrest"
              />
              .
            </li>
            <li>
              That the Applicant is innocent and has been falsely implicated, and
              the Applicant apprehends arrest in a non-bailable matter, which
              would cause irreparable harm to the Applicant’s liberty and
              reputation.
            </li>
            {grounds.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
            {data.cleanAntecedents && (
              <li>
                That the Applicant has no prior criminal antecedents and is a
                law-abiding citizen with settled roots in society, and is not a
                flight risk.
              </li>
            )}
            {data.willingToCooperate && (
              <li>
                That the Applicant undertakes to cooperate with the investigation
                and to make himself/herself available as and when required by the
                Investigating Officer.
              </li>
            )}
            {data.custodyNotRequired && (
              <li>
                That no custodial interrogation of the Applicant is necessary, and
                the purpose of the investigation can be served without depriving
                the Applicant of liberty.
              </li>
            )}
          </ol>
        </section>

        <section>
          <h2>PRAYER</h2>
          <p>
            It is therefore most respectfully prayed that this Hon’ble Court may
            be pleased to:
          </p>
          <ol type="a">
            <li>
              direct that, in the event of arrest in connection with the
              aforesaid matter, the Applicant be released on anticipatory bail
              under Section 482 of the Bharatiya Nagarik Suraksha Sanhita, 2023,
              on such terms and conditions as this Hon’ble Court deems fit;
            </li>
            {conditions.length > 0 && (
              <li>
                record the Applicant’s undertaking to abide by the following
                conditions: {conditions.join('; ')};
              </li>
            )}
            <li>
              pass such other and further order(s) as this Hon’ble Court deems
              fit and proper in the interest of justice.
            </li>
          </ol>
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
              path="applicationDate"
              value={data.applicationDate}
              widget="date"
              placeholder="application date"
            >
              {formatDateLong(data.applicationDate)}
            </EditableField>
          </p>
          <div style={{ marginTop: '24pt', textAlign: 'right' }}>
            <p>
              ____________________________
              <br />
              {adv?.name ? (
                <>
                  <strong>{adv.name}</strong>
                  {adv.enrollmentNo ? `, Advocate (Enrol. ${adv.enrollmentNo})` : ', Advocate'}
                  <br />
                  for the Applicant
                </>
              ) : (
                <>
                  <strong>{applicant?.name || ''}</strong>
                  <br />
                  Applicant
                </>
              )}
            </p>
          </div>
        </section>

        <section>
          <h2>VERIFICATION</h2>
          <p>
            I, the above-named Applicant, do hereby verify that the contents of
            this application are true and correct to the best of my knowledge and
            belief, and that nothing material has been concealed therefrom.
            Verified at{' '}
            <EditableField
              path="place"
              value={data.place || ''}
              widget="text"
              placeholder="place"
            />{' '}
            on {formatDateLong(data.applicationDate)}.
          </p>
          <p style={{ marginTop: '18pt', textAlign: 'right' }}>
            ____________________________
            <br />
            <strong>{applicant?.name || ''}</strong>
            <br />
            Applicant
          </p>
        </section>
      </Paginator>
    </>
  );
}
