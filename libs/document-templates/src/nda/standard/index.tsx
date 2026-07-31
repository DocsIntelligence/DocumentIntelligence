import type { NdaData } from '@org/document-schema';
import { EditableField } from '../../_internals/EditableField';
import { formatDateLong } from '../../_internals/format';
import { PagePrintStyles } from '../../_internals/Page';
import { Paginator } from '../../_internals/Paginator';
import type { PageSizeKey } from '../../_internals/page-sizes';

interface Props {
  data: Partial<NdaData>;
  pageSize: PageSizeKey;
  headerText?: string;
  footerText?: string;
}

const ENTITY_DESC: Record<string, string> = {
  individual: 'an individual',
  company: 'a company incorporated under the Companies Act, 2013',
  llp: 'a limited liability partnership',
  partnership: 'a partnership firm',
  proprietorship: 'a sole proprietorship',
  huf: 'a Hindu Undivided Family',
  trust: 'a trust',
  society: 'a registered society',
  other: 'an entity',
};

/**
 * Standard Indian Non-Disclosure Agreement (A4), governed by the Indian
 * Contract Act, 1872. Branches its party roles and obligations on
 * `agreement.mutual`. Operative clauses (definition, exclusions, obligations,
 * term/survival, return, remedies, governing law, general) are author-written
 * and carry no statutory section numbers (the AI never authors citations).
 * Editable inline values use <EditableField/> (click-to-edit in preview, plain
 * in the PDF).
 */
export function NdaStandard({ data, pageSize, headerText, footerText }: Props) {
  const ag = data.agreement;
  const a = data.partyA;
  const b = data.partyB;
  const t = data.terms;
  const g = data.governing;
  const mutual = ag?.mutual !== false;
  const witnesses = (data.witnesses ?? []).filter((w) => w?.name?.trim());

  const aRole = mutual ? 'Party A' : 'Disclosing Party';
  const bRole = mutual ? 'Party B' : 'Receiving Party';
  const scope = (t?.confidentialScope ?? []).filter((s) => s && s.trim());
  const customExclusions = (t?.customExclusions ?? []).filter((s) => s && s.trim());
  const survival = t?.survivalYears;
  const survivalText =
    survival === 0
      ? 'indefinitely'
      : `for a period of ${survival ?? 3} (${survival ?? 'three'}) year(s) from the date of termination or expiry of this Agreement`;

  const partyLine = (
    party: Partial<NdaData['partyA']> | undefined,
    role: string,
    path: 'partyA' | 'partyB',
  ) => (
    <p>
      <strong>
        <EditableField
          path={`${path}.name`}
          value={party?.name}
          widget="text"
          placeholder={`${role} name`}
        />
      </strong>
      {party?.entityType ? `, ${ENTITY_DESC[party.entityType] ?? 'an entity'}` : ''}
      {party?.address ? (
        <>
          {', having its address at '}
          <EditableField
            path={`${path}.address`}
            value={party.address}
            widget="textarea"
            placeholder={`${role} address`}
          />
        </>
      ) : (
        ''
      )}
      {` (hereinafter referred to as the "${role}").`}
    </p>
  );

  let clause = 0;
  const n = () => (clause += 1);

  return (
    <>
      <PagePrintStyles pageSize={pageSize} />
      <Paginator pageSize={pageSize} headerText={headerText} footerText={footerText}>
        <h1 style={{ textAlign: 'center', textTransform: 'uppercase' }}>
          Non-Disclosure Agreement
        </h1>

        <section>
          <p>
            This {mutual ? 'Mutual ' : ''}Non-Disclosure Agreement (this
            &ldquo;Agreement&rdquo;) is made and entered into on{' '}
            <strong>
              <EditableField
                path="agreement.effectiveDate"
                value={ag?.effectiveDate}
                widget="date"
                placeholder="effective date"
              >
                {formatDateLong(ag?.effectiveDate)}
              </EditableField>
            </strong>
            {ag?.place ? (
              <>
                {' at '}
                <EditableField
                  path="agreement.place"
                  value={ag.place}
                  widget="text"
                  placeholder="place"
                />
              </>
            ) : (
              ''
            )}
            , by and between:
          </p>
          {partyLine(a, aRole, 'partyA')}
          <p style={{ textAlign: 'center' }}>AND</p>
          {partyLine(b, bRole, 'partyB')}
          <p>
            The {aRole} and the {bRole} are hereinafter referred to individually
            as a &ldquo;Party&rdquo; and collectively as the
            &ldquo;Parties&rdquo;.
          </p>
        </section>

        <section>
          <p>
            <strong>WHEREAS</strong>, the Parties wish to explore{' '}
            <EditableField
              path="agreement.purpose"
              value={ag?.purpose}
              widget="textarea"
              placeholder="the purpose for which information is shared"
            />{' '}
            (the &ldquo;Purpose&rdquo;), and in connection therewith{' '}
            {mutual
              ? 'each Party may disclose to the other'
              : 'the Disclosing Party may disclose to the Receiving Party'}{' '}
            certain confidential information. The Parties agree as follows:
          </p>
        </section>

        <section>
          <h2>{n()}. Confidential Information</h2>
          <p>
            &ldquo;Confidential Information&rdquo; means all non-public
            information disclosed by {mutual ? 'a Party' : 'the Disclosing Party'}{' '}
            (the &ldquo;Disclosing Party&rdquo;) to{' '}
            {mutual ? 'the other Party' : 'the Receiving Party'} (the
            &ldquo;Receiving Party&rdquo;), whether orally, in writing or in any
            other form, that is designated as confidential or that a reasonable
            person would understand to be confidential, including without
            limitation:
          </p>
          {scope.length > 0 ? (
            <ol>
              {scope.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          ) : (
            <p>
              <EditableField
                path="terms.confidentialScope"
                value={undefined}
                widget="textarea"
                placeholder="categories of confidential information"
              />
            </p>
          )}
        </section>

        <section>
          <h2>{n()}. Exclusions</h2>
          <p>
            Confidential Information does not include information that: (a) is or
            becomes publicly available through no breach of this Agreement; (b)
            was rightfully known to the Receiving Party without restriction
            before disclosure; (c) is independently developed by the Receiving
            Party without use of the Confidential Information; or (d) is
            rightfully received from a third party without a duty of
            confidentiality.
          </p>
          {customExclusions.length > 0 && (
            <ol type="i">
              {customExclusions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          )}
        </section>

        <section>
          <h2>{n()}. Obligations of Confidentiality</h2>
          <p>
            {mutual ? 'Each Party' : 'The Receiving Party'}, as a Receiving
            Party, shall: (a) use the Confidential Information solely for the
            Purpose; (b) hold it in strict confidence and protect it with at
            least the degree of care it uses for its own confidential
            information of like importance, and in no event less than reasonable
            care; and (c) not disclose it to any third party except as permitted
            under this Agreement.
          </p>
          {t?.permitDisclosureToReps !== false && (
            <p>
              The Receiving Party may disclose Confidential Information to its
              directors, officers, employees, and professional advisors on a
              need-to-know basis, provided each is bound by confidentiality
              obligations no less protective than those herein, and the
              Receiving Party remains responsible for their compliance.
            </p>
          )}
        </section>

        <section>
          <h2>{n()}. Term and Survival</h2>
          <p>
            This Agreement is effective from the date first written above and
            shall continue for{' '}
            <strong>
              <EditableField
                path="terms.termMonths"
                value={t?.termMonths}
                widget="number"
                placeholder="24"
              />
            </strong>{' '}
            month(s), unless earlier terminated by either Party on written
            notice. The confidentiality obligations under this Agreement shall
            survive its termination or expiry and continue {survivalText}.
          </p>
        </section>

        {t?.returnOrDestroy !== false && (
          <section>
            <h2>{n()}. Return or Destruction of Materials</h2>
            <p>
              Upon termination or expiry of this Agreement, or on the Disclosing
              Party&rsquo;s written request, the Receiving Party shall promptly
              return or destroy all Confidential Information and all copies
              thereof, and on request certify such return or destruction in
              writing, save for one archival copy retained solely for legal
              compliance.
            </p>
          </section>
        )}

        <section>
          <h2>{n()}. No Licence; No Warranty</h2>
          <p>
            Nothing in this Agreement grants the Receiving Party any licence or
            right to the Confidential Information except as expressly set out
            herein. All Confidential Information is provided &ldquo;as is&rdquo;
            without warranty of any kind. No Party is obliged to proceed with
            any transaction.
          </p>
        </section>

        {t?.injunctiveRelief !== false && (
          <section>
            <h2>{n()}. Remedies</h2>
            <p>
              The Parties acknowledge that a breach of this Agreement may cause
              irreparable harm for which monetary damages may be an inadequate
              remedy, and that the Disclosing Party shall be entitled to seek
              injunctive relief in addition to any other remedies available in
              law or equity.
            </p>
          </section>
        )}

        <section>
          <h2>{n()}. Governing Law and Dispute Resolution</h2>
          <p>
            This Agreement shall be governed by and construed in accordance with
            the laws of India
            {g?.state ? (
              <>
                {', and the State of '}
                <EditableField
                  path="governing.state"
                  value={g.state}
                  widget="text"
                  placeholder="State"
                />
              </>
            ) : (
              ''
            )}
            .{' '}
            {g?.disputeResolution === 'arbitration' ? (
              <>
                Any dispute arising out of or in connection with this Agreement
                shall be referred to and finally resolved by arbitration under
                the Arbitration and Conciliation Act, 1996, with the seat at{' '}
                <EditableField
                  path="governing.arbitrationSeat"
                  value={g?.arbitrationSeat}
                  widget="text"
                  placeholder="seat of arbitration"
                />
                .
              </>
            ) : (
              <>
                The courts at{' '}
                <EditableField
                  path="governing.jurisdictionCity"
                  value={g?.jurisdictionCity}
                  widget="text"
                  placeholder="city"
                />{' '}
                shall have exclusive jurisdiction.
              </>
            )}
          </p>
        </section>

        <section>
          <h2>{n()}. General</h2>
          <p>
            This Agreement constitutes the entire understanding between the
            Parties regarding its subject matter and supersedes all prior
            discussions. No amendment is effective unless in writing and signed
            by both Parties. If any provision is held unenforceable, the
            remaining provisions shall continue in full force. This Agreement
            does not create any partnership, agency, or employment relationship
            between the Parties.
          </p>
        </section>

        <section>
          <p>
            <em>
              IN WITNESS WHEREOF, the Parties have executed this Agreement on the
              date first above written.
            </em>
          </p>
        </section>

        <section>
          <table style={{ marginTop: '14pt' }}>
            <tbody>
              <tr>
                <td style={{ width: '50%', paddingRight: '8pt' }}>
                  <p style={{ marginTop: '28pt' }}>____________________________</p>
                  <p>
                    <strong>{aRole}</strong>
                    <br />
                    {a?.name || ''}
                    {a?.repName ? (
                      <>
                        <br />
                        {`By: ${a.repName}`}
                        {a.repDesignation ? `, ${a.repDesignation}` : ''}
                      </>
                    ) : (
                      ''
                    )}
                  </p>
                </td>
                <td style={{ width: '50%', paddingLeft: '8pt' }}>
                  <p style={{ marginTop: '28pt' }}>____________________________</p>
                  <p>
                    <strong>{bRole}</strong>
                    <br />
                    {b?.name || ''}
                    {b?.repName ? (
                      <>
                        <br />
                        {`By: ${b.repName}`}
                        {b.repDesignation ? `, ${b.repDesignation}` : ''}
                      </>
                    ) : (
                      ''
                    )}
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {witnesses.length > 0 && (
          <section>
            <h2>Witnesses</h2>
            <ol>
              {witnesses.map((w, i) => (
                <li key={i}>
                  {w.name}
                  {w.address ? `, ${w.address}` : ''}
                </li>
              ))}
            </ol>
          </section>
        )}
      </Paginator>
    </>
  );
}
