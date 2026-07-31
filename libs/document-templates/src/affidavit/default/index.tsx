import type { AffidavitData } from '@org/document-schema';
import { EditableField } from '../../_internals/EditableField';
import { formatDateLong } from '../../_internals/format';
import { PagePrintStyles } from '../../_internals/Page';
import { Paginator } from '../../_internals/Paginator';
import type { PageSizeKey } from '../../_internals/page-sizes';

interface Props {
  data: Partial<AffidavitData>;
  pageSize: PageSizeKey;
  headerText?: string;
  footerText?: string;
}

const ID_LABEL: Record<string, string> = {
  aadhaar: 'Aadhaar No.',
  pan: 'PAN',
  passport: 'Passport No.',
  voter_id: 'Voter ID No.',
  driving_licence: 'Driving Licence No.',
  none: '',
};

const ATTESTATION: Record<string, { affirm: string; before: string }> = {
  notary: {
    affirm: 'solemnly affirm and declare',
    before: 'Sworn/affirmed before me',
  },
  oath_commissioner: {
    affirm: 'solemnly affirm and declare',
    before: 'Solemnly affirmed before me',
  },
  executive_magistrate: {
    affirm: 'solemnly affirm and declare',
    before: 'Affirmed before me',
  },
  self_attested: {
    affirm: 'solemnly affirm and declare',
    before: '',
  },
};

const ATTESTOR_LINE: Record<string, string> = {
  notary: 'Notary Public',
  oath_commissioner: 'Oath Commissioner',
  executive_magistrate: 'Executive Magistrate',
  self_attested: '',
};

/**
 * General-purpose affidavit, A4. The statutory truthfulness/false-affidavit
 * consequence is surfaced as a risk (conceptually, no hardcoded section) — this
 * template body is the deponent's own sworn declaration and cites no statute.
 * Editable values use <EditableField/> (click-to-edit in preview, plain text in
 * the PDF/Puppeteer path).
 */
export function AffidavitDefault({ data, pageSize, headerText, footerText }: Props) {
  const dep = data.deponent;
  const decl = data.declaration;
  const attestationType = data.attestation?.type ?? 'notary';
  const statements = (decl?.statements ?? []).filter((s) => s && s.trim());
  const place = data.place || '';
  const heading = (decl?.title || '').trim().toUpperCase() || 'AFFIDAVIT';
  const att = ATTESTATION[attestationType] ?? ATTESTATION.notary;
  const idLabel = dep?.idType ? ID_LABEL[dep.idType] : '';

  return (
    <>
      <PagePrintStyles pageSize={pageSize} />
      <Paginator pageSize={pageSize} headerText={headerText} footerText={footerText}>
        <h1 style={{ textAlign: 'center', textDecoration: 'underline' }}>
          {heading}
        </h1>

        <section>
          <p>
            I,{' '}
            <strong>
              <EditableField
                path="deponent.name"
                value={dep?.name}
                widget="text"
                placeholder="deponent name"
              />
            </strong>
            {dep?.parentRelation || dep?.parentName ? (
              <>
                {', '}
                {dep?.parentRelation ?? 'S/o'}{' '}
                <EditableField
                  path="deponent.parentName"
                  value={dep?.parentName}
                  widget="text"
                  placeholder="father/husband/mother's name"
                />
              </>
            ) : (
              ''
            )}
            , aged about{' '}
            <strong>
              <EditableField
                path="deponent.age"
                value={dep?.age}
                widget="number"
                placeholder="__"
              />
            </strong>{' '}
            years
            {dep?.occupation ? (
              <>
                , by occupation{' '}
                <EditableField
                  path="deponent.occupation"
                  value={dep?.occupation}
                  widget="text"
                  placeholder="occupation"
                />
              </>
            ) : (
              ''
            )}
            , resident of{' '}
            <EditableField
              path="deponent.address"
              value={dep?.address}
              widget="textarea"
              placeholder="residential address"
            />
            {idLabel && dep?.idNumber ? (
              <>
                {', holding '}
                {idLabel}{' '}
                <EditableField
                  path="deponent.idNumber"
                  value={dep?.idNumber}
                  widget="text"
                  placeholder="ID number"
                />
              </>
            ) : (
              ''
            )}
            , do hereby {att.affirm} as under:
          </p>
        </section>

        <section>
          <ol>
            {statements.length > 0 ? (
              statements.map((s: string, i: number) => <li key={i}>{s}</li>)
            ) : (
              <li>
                <EditableField
                  path="declaration.statements"
                  value={undefined}
                  widget="textarea"
                  placeholder="the facts you are declaring on oath"
                />
              </li>
            )}
          </ol>
        </section>

        {decl?.purpose ? (
          <section>
            <p>
              This affidavit is being {att.affirm.replace(' and declare', 'ed')}{' '}
              for the purpose of{' '}
              <EditableField
                path="declaration.purpose"
                value={decl?.purpose}
                widget="text"
                placeholder="purpose"
              />
              .
            </p>
          </section>
        ) : null}

        <section>
          <p style={{ marginTop: '18pt' }}>
            <strong>____________________________</strong>
            <br />
            DEPONENT
          </p>
        </section>

        <section>
          <h2 style={{ textAlign: 'center', textDecoration: 'underline' }}>
            VERIFICATION
          </h2>
          <p>
            I, the above-named deponent, do hereby verify that the contents of
            this affidavit are true and correct to the best of my knowledge and
            belief, that no part of it is false and that nothing material has
            been concealed therefrom. Verified at{' '}
            <EditableField
              path="place"
              value={place}
              widget="text"
              placeholder="place"
            />{' '}
            on this{' '}
            <EditableField
              path="affidavitDate"
              value={data.affidavitDate}
              widget="date"
              placeholder="date"
            >
              {formatDateLong(data.affidavitDate)}
            </EditableField>
            .
          </p>
          <p style={{ marginTop: '18pt' }}>
            <strong>____________________________</strong>
            <br />
            DEPONENT
          </p>
        </section>

        {attestationType !== 'self_attested' && att.before ? (
          <section>
            <p style={{ marginTop: '24pt' }}>
              {att.before} on{' '}
              <strong>{formatDateLong(data.affidavitDate)}</strong>.
            </p>
            <p style={{ marginTop: '24pt' }}>
              ____________________________
              <br />
              {ATTESTOR_LINE[attestationType]}
            </p>
          </section>
        ) : null}
      </Paginator>
    </>
  );
}
