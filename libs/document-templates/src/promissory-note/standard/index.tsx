import type { PromissoryNoteData } from '@org/document-schema';
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
  data: Partial<PromissoryNoteData>;
  pageSize: PageSizeKey;
}

/**
 * Promissory Note (A4) — an unconditional promise to pay, under §4 of the
 * Negotiable Instruments Act, 1881. Renders the classic single-paragraph
 * instrument with amount, value-received recital, optional interest, and a
 * demand / fixed-date payment term, plus a revenue-stamp affixation note.
 * Editable inline values use <EditableField/>.
 */
export function PromissoryNoteStandard({ data, pageSize }: Props) {
  const note = data.note;
  const maker = data.maker;
  const payee = data.payee;
  const witnesses = (data.witnesses ?? []).filter((w) => w?.name?.trim());

  const partyClause = (
    party: Partial<PromissoryNoteData['maker']> | undefined,
    path: 'maker' | 'payee',
    role: string,
  ) => (
    <>
      <strong>
        <EditableField
          path={`${path}.name`}
          value={party?.name}
          widget="text"
          placeholder={`${role} name`}
        />
      </strong>
      {party?.parentRelation || party?.parentName ? (
        <>
          {`, ${party?.parentRelation ?? 'S/o'} `}
          <EditableField
            path={`${path}.parentName`}
            value={party?.parentName}
            widget="text"
            placeholder="father/husband's name"
          />
        </>
      ) : (
        ''
      )}
      {party?.address ? (
        <>
          {', resident of '}
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
    </>
  );

  const rate = note?.interestRate;
  const fixed = note?.payableOn === 'fixed_date';

  return (
    <>
      <PagePrintStyles pageSize={pageSize} />
      <Paginator pageSize={pageSize}>
        <h1 style={{ textAlign: 'center', textTransform: 'uppercase' }}>
          Promissory Note
        </h1>

        <section>
          <table style={{ width: '100%' }}>
            <tbody>
              <tr>
                <td style={{ width: '50%' }}>
                  <p>
                    <strong>
                      ₹{' '}
                      <EditableField
                        path="note.principalAmount"
                        value={note?.principalAmount}
                        widget="number"
                        placeholder="amount"
                      >
                        {note?.principalAmount
                          ? formatINR(note.principalAmount)
                          : ''}
                      </EditableField>
                    </strong>
                  </p>
                </td>
                <td style={{ width: '50%', textAlign: 'right' }}>
                  <p>
                    <EditableField
                      path="note.place"
                      value={note?.place}
                      widget="text"
                      placeholder="place"
                    />
                    {', '}
                    <EditableField
                      path="note.noteDate"
                      value={note?.noteDate}
                      widget="date"
                      placeholder="date"
                    >
                      {formatDateLong(note?.noteDate)}
                    </EditableField>
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <p>
            {fixed ? (
              <>
                On{' '}
                <strong>
                  <EditableField
                    path="note.dueDate"
                    value={note?.dueDate}
                    widget="date"
                    placeholder="due date"
                  >
                    {formatDateLong(note?.dueDate)}
                  </EditableField>
                </strong>
                ,{' '}
              </>
            ) : (
              'On demand, '
            )}
            I, {partyClause(maker, 'maker', 'maker')}, do hereby promise to pay{' '}
            {partyClause(payee, 'payee', 'payee')}, or order, the sum of{' '}
            <strong>
              ₹
              {note?.principalAmount ? formatINR(note.principalAmount) : '____'}
            </strong>{' '}
            {note?.principalAmount
              ? `(${formatINRWords(note.principalAmount)} Rupees only)`
              : '(Rupees ____ only)'}
            {note?.consideration ? (
              <>
                {', for value received by way of '}
                <EditableField
                  path="note.consideration"
                  value={note.consideration}
                  widget="text"
                  placeholder="consideration"
                />
              </>
            ) : (
              ', for value received'
            )}
            {rate && rate > 0 ? (
              <>
                {', together with interest thereon at the rate of '}
                <strong>
                  <EditableField
                    path="note.interestRate"
                    value={rate}
                    widget="number"
                    placeholder="rate"
                  />
                  % per annum
                </strong>
                {' from the date hereof until repayment in full'}
              </>
            ) : (
              ''
            )}
            .
          </p>
        </section>

        <section>
          <table style={{ marginTop: '28pt', width: '100%' }}>
            <tbody>
              <tr>
                <td style={{ width: '50%', verticalAlign: 'bottom' }}>
                  <p
                    style={{
                      border: '1px dashed #999',
                      padding: '10pt',
                      textAlign: 'center',
                      width: '120pt',
                    }}
                  >
                    Affix revenue
                    <br />
                    stamp here
                  </p>
                </td>
                <td style={{ width: '50%', textAlign: 'right' }}>
                  <p style={{ marginTop: '28pt' }}>____________________________</p>
                  <p>
                    <strong>Maker / Promisor</strong>
                    <br />
                    {maker?.name || ''}
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
          <p style={{ fontSize: '9pt', color: '#555' }}>
            <em>
              Note: a promissory note must bear the requisite stamp under the
              Indian Stamp Act and cannot be validly signed electronically (IT
              Act, 2000, Schedule 1).
            </em>
          </p>
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
