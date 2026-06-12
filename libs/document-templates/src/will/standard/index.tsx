import type { WillData } from '@org/document-schema';
import { EditableField } from '../../_internals/EditableField';
import { formatDateLong } from '../../_internals/format';
import { PagePrintStyles } from '../../_internals/Page';
import { Paginator } from '../../_internals/Paginator';
import type { PageSizeKey } from '../../_internals/page-sizes';

interface Props {
  data: Partial<WillData>;
  pageSize: PageSizeKey;
}

/**
 * Last Will & Testament (A4), India + generic common-law. Renders a formal,
 * numbered will: declaration & revocation, executor appointment, bequests,
 * residue, guardianship, funeral wishes, and a two-witness attestation block.
 * Schedule-1: must be printed and signed by hand. No statutory text authored.
 */
export function WillStandard({ data, pageSize }: Props) {
  const meta = data.will;
  const t = data.testator;
  const exec = data.executor;
  const wishes = data.wishes;
  const bequests = (data.bequests ?? []).filter(
    (b) => b?.beneficiary?.trim() || b?.description?.trim(),
  );
  const witnesses = (data.witnesses ?? []).filter((w) => w?.name?.trim());
  const witnessRows = Math.max(witnesses.length, 2);

  const testatorLine = [
    t?.name || '[Testator name]',
    [t?.relation, t?.parentName].filter(Boolean).join(' '),
    t?.age ? `aged ${t.age} years` : '',
    t?.occupation,
    t?.address ? `residing at ${t.address}` : '',
  ]
    .filter(Boolean)
    .join(', ');

  let clause = 0;
  const n = () => ++clause;

  return (
    <>
      <PagePrintStyles pageSize={pageSize} />
      <Paginator pageSize={pageSize}>
        <h1 style={{ textAlign: 'center', textTransform: 'uppercase' }}>
          Last Will and Testament
        </h1>

        <section>
          <p style={{ lineHeight: 1.8 }}>
            I, <strong>{testatorLine}</strong>,{' '}
            {meta?.soundMind !== false
              ? 'being of sound mind and memory and not acting under any coercion, undue influence, or duress, '
              : ''}
            declare this to be my Last Will and Testament.
          </p>
        </section>

        {meta?.revokesPriorWills !== false && (
          <section>
            <p>
              <strong>{n()}. Revocation.</strong> I hereby revoke all wills,
              codicils, and testamentary dispositions made by me at any time
              heretofore.
            </p>
          </section>
        )}

        <section>
          <p>
            <strong>{n()}. Appointment of Executor.</strong> I appoint{' '}
            <strong>{exec?.name || '[Executor name]'}</strong>
            {exec?.relationship ? ` (my ${exec.relationship})` : ''}
            {exec?.address ? `, residing at ${exec.address},` : ''} to be the
            Executor of this Will, to administer my estate and give effect to
            its terms.
            {exec?.alternateName ? (
              <>
                {' '}
                Should the said Executor be unable or unwilling to act, I appoint{' '}
                <strong>{exec.alternateName}</strong>
                {exec?.alternateAddress
                  ? `, of ${exec.alternateAddress},`
                  : ''}{' '}
                as alternate Executor.
              </>
            ) : (
              ''
            )}
          </p>
        </section>

        <section>
          <p>
            <strong>{n()}. Bequests.</strong> I give, devise, and bequeath my
            property and assets as follows:
          </p>
          {bequests.length > 0 ? (
            <ol type="a" style={{ lineHeight: 1.7 }}>
              {bequests.map((b, i) => (
                <li key={i}>
                  To <strong>{b.beneficiary || '[beneficiary]'}</strong>
                  {b.relationship ? ` (my ${b.relationship})` : ''}:{' '}
                  {b.description || '[describe the bequest]'}
                </li>
              ))}
            </ol>
          ) : (
            <p style={{ color: '#888' }}>
              <em>[Add the specific bequests — who receives what.]</em>
            </p>
          )}
        </section>

        {wishes?.residuaryBeneficiary ? (
          <section>
            <p>
              <strong>{n()}. Residuary Estate.</strong> I give the rest,
              residue, and remainder of my estate, whether movable or immovable
              and wheresoever situated, not otherwise disposed of by this Will,
              to <strong>{wishes.residuaryBeneficiary}</strong>.
            </p>
          </section>
        ) : null}

        {wishes?.guardianName ? (
          <section>
            <p>
              <strong>{n()}. Guardian.</strong> I appoint{' '}
              <strong>{wishes.guardianName}</strong> as the guardian of my minor
              child/children
              {wishes?.guardianForMinors
                ? ` (${wishes.guardianForMinors})`
                : ''}{' '}
              until they attain majority.
            </p>
          </section>
        ) : null}

        {wishes?.funeralWishes ? (
          <section>
            <p>
              <strong>{n()}. Funeral Wishes.</strong> {wishes.funeralWishes}
            </p>
          </section>
        ) : null}

        <section>
          <p style={{ marginTop: '12pt' }}>
            IN WITNESS WHEREOF, I have signed this Will at{' '}
            <strong>{meta?.place || '[place]'}</strong> on{' '}
            <EditableField
              path="will.date"
              value={meta?.date}
              widget="date"
              placeholder="date"
            >
              {meta?.date ? formatDateLong(meta.date) : '[date]'}
            </EditableField>
            .
          </p>
          <p style={{ marginTop: '28pt' }}>
            ____________________________
            <br />
            {t?.name || '[Testator]'} (Testator)
          </p>
        </section>

        <section>
          <p style={{ marginTop: '8pt' }}>
            Signed by the above-named Testator as their Last Will, in our joint
            presence, and attested by us in the presence of the Testator and of
            each other:
          </p>
          <table style={{ width: '100%', marginTop: '16pt' }}>
            <tbody>
              {Array.from({ length: witnessRows }).map((_, i) => (
                <tr key={i}>
                  <td style={{ width: '50%', verticalAlign: 'top', padding: '12pt 8pt' }}>
                    <p>
                      ____________________________
                      <br />
                      {i + 1}. {witnesses[i]?.name || '[Witness name]'}
                      {witnesses[i]?.address ? (
                        <>
                          <br />
                          <span style={{ fontSize: '9pt', color: '#555' }}>
                            {witnesses[i].address}
                          </span>
                        </>
                      ) : (
                        ''
                      )}
                    </p>
                  </td>
                  <td style={{ width: '50%' }} />
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <p style={{ fontSize: '8.5pt', color: '#666', marginTop: '12pt' }}>
            Note: Under Schedule 1 of the Information Technology Act, 2000, a
            will cannot be validly executed by electronic signature. Print this
            document and sign it by hand in the presence of the two witnesses.
          </p>
        </section>
      </Paginator>
    </>
  );
}
