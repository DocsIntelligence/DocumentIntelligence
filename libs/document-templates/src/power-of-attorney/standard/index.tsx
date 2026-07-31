import type { PowerOfAttorneyData } from '@org/document-schema';
import { EditableField } from '../../_internals/EditableField';
import { formatDateLong } from '../../_internals/format';
import { PagePrintStyles } from '../../_internals/Page';
import { Paginator } from '../../_internals/Paginator';
import type { PageSizeKey } from '../../_internals/page-sizes';

interface Props {
  data: Partial<PowerOfAttorneyData>;
  pageSize: PageSizeKey;
  headerText?: string;
  footerText?: string;
}

/**
 * Power of Attorney (A4), India. Classic deed: identification of the principal,
 * appointment of the attorney, a numbered list of powers, a ratification
 * clause, duration, and an execution block with witnesses. Notes that a PoA
 * cannot be eSigned (IT Act Schedule 1). No statutory section numbers authored.
 */
export function PowerOfAttorneyStandard({ data, pageSize, headerText, footerText }: Props) {
  const poa = data.poa;
  const principal = data.principal;
  const attorney = data.attorney;
  const powers = (data.powers ?? []).filter((p) => p && p.trim());
  const terms = data.terms;
  const witnesses = (data.witnesses ?? []).filter((w) => w?.name?.trim());
  const type = poa?.type === 'general' ? 'General' : 'Special';

  const personPhrase = (
    p: Partial<PowerOfAttorneyData['principal']> | undefined,
    path: 'principal' | 'attorney',
    placeholder: string,
  ) => (
    <>
      <strong>
        <EditableField
          path={`${path}.name`}
          value={p?.name}
          widget="text"
          placeholder={placeholder}
        />
      </strong>
      {p?.parentRelation || p?.parentName ? (
        <>
          {`, ${p?.parentRelation ?? 'S/o'} `}
          <EditableField
            path={`${path}.parentName`}
            value={p?.parentName}
            widget="text"
            placeholder="father/husband's name"
          />
        </>
      ) : (
        ''
      )}
      {p?.occupation ? `, ${p.occupation}` : ''}
      {p?.address ? (
        <>
          {', resident of '}
          <EditableField
            path={`${path}.address`}
            value={p.address}
            widget="textarea"
            placeholder="address"
          />
        </>
      ) : (
        ''
      )}
    </>
  );

  return (
    <>
      <PagePrintStyles pageSize={pageSize} />
      <Paginator pageSize={pageSize} headerText={headerText} footerText={footerText}>
        <h1 style={{ textAlign: 'center', textTransform: 'uppercase' }}>
          {type} Power of Attorney
        </h1>

        <section>
          <p>
            <strong>KNOW ALL MEN BY THESE PRESENTS</strong> that I,{' '}
            {personPhrase(principal, 'principal', 'principal name')} (hereinafter
            referred to as the &ldquo;Principal&rdquo;), do hereby nominate,
            constitute and appoint{' '}
            {personPhrase(attorney, 'attorney', 'attorney name')}
            {attorney?.relationship ? `, my ${attorney.relationship},` : ''}{' '}
            (hereinafter referred to as the &ldquo;Attorney&rdquo;) as my true
            and lawful attorney
            {terms?.purpose ? (
              <>
                {' for the purpose of '}
                <EditableField
                  path="terms.purpose"
                  value={terms.purpose}
                  widget="textarea"
                  placeholder="purpose"
                />
              </>
            ) : (
              ''
            )}
            , to do, execute and perform the following acts, deeds and things on
            my behalf:
          </p>
        </section>

        <section>
          {powers.length > 0 ? (
            <ol>
              {powers.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>
          ) : (
            <p>
              <EditableField
                path="powers"
                value={undefined}
                widget="textarea"
                placeholder="the powers granted to the attorney"
              />
            </p>
          )}
        </section>

        <section>
          <p>
            AND I hereby agree to ratify and confirm all lawful acts, deeds and
            things done by my said Attorney by virtue of these presents as if
            done by me personally.
          </p>
          <p>
            This Power of Attorney shall remain in force{' '}
            {terms?.durationType === 'fixed' ? (
              <>
                until{' '}
                <strong>
                  <EditableField
                    path="terms.expiryDate"
                    value={terms?.expiryDate}
                    widget="date"
                    placeholder="expiry date"
                  >
                    {formatDateLong(terms?.expiryDate)}
                  </EditableField>
                </strong>
              </>
            ) : (
              'until revoked by me in writing'
            )}
            .
          </p>
        </section>

        <section>
          <p>
            <em>
              IN WITNESS WHEREOF, I have signed this {type} Power of Attorney at{' '}
              <EditableField
                path="poa.place"
                value={poa?.place}
                widget="text"
                placeholder="place"
              />{' '}
              on{' '}
              <EditableField
                path="poa.executionDate"
                value={poa?.executionDate}
                widget="date"
                placeholder="date"
              >
                {formatDateLong(poa?.executionDate)}
              </EditableField>
              .
            </em>
          </p>
        </section>

        <section>
          <p style={{ marginTop: '28pt' }}>____________________________</p>
          <p>
            <strong>Principal</strong>
            <br />
            {principal?.name || ''}
          </p>
        </section>

        <section>
          <p>Accepted by the Attorney:</p>
          <p style={{ marginTop: '24pt' }}>____________________________</p>
          <p>
            <strong>Attorney</strong>
            <br />
            {attorney?.name || ''}
          </p>
        </section>

        <section>
          <h2>Witnesses</h2>
          <ol>
            {(witnesses.length > 0
              ? witnesses
              : [{ name: '', address: '' }, { name: '', address: '' }]
            ).map((w, i) => (
              <li key={i} style={{ marginBottom: '18pt' }}>
                {w.name ? (
                  <>
                    {w.name}
                    {w.address ? `, ${w.address}` : ''}
                  </>
                ) : (
                  '____________________________'
                )}
              </li>
            ))}
          </ol>
        </section>

        <section>
          <p style={{ fontSize: '9pt', color: '#555' }}>
            <em>
              Note: a Power of Attorney must be adequately stamped and, where it
              concerns immovable property, registered. It cannot be validly
              signed electronically (IT Act, 2000, Schedule 1).
            </em>
          </p>
        </section>
      </Paginator>
    </>
  );
}
