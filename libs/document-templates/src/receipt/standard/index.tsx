import type { ReceiptData } from '@org/document-schema';
import { EditableField } from '../../_internals/EditableField';
import { formatDateLong, formatINRWords, formatMoney } from '../../_internals/format';
import { PagePrintStyles } from '../../_internals/Page';
import { Paginator } from '../../_internals/Paginator';
import type { PageSizeKey } from '../../_internals/page-sizes';

interface Props {
  data: Partial<ReceiptData>;
  pageSize: PageSizeKey;
}

const MODE_LABEL: Record<string, string> = {
  cash: 'in cash',
  cheque: 'by cheque',
  bank_transfer: 'by bank transfer',
  upi: 'by UPI',
  card: 'by card',
  other: '',
};

/**
 * Payment Receipt (A4). Classic "Received with thanks from … the sum of …"
 * acknowledgement, with amount in words (INR), payment mode + reference, and an
 * optional running balance for part payments. No statutory citations.
 */
export function ReceiptStandard({ data, pageSize }: Props) {
  const r = data.receipt;
  const payer = data.payer;
  const payee = data.payee;
  const p = data.payment;
  const currency = r?.currency ?? 'INR';
  const amount = p?.amount ?? 0;
  const modeText = MODE_LABEL[p?.mode ?? 'cash'] ?? '';
  const balance =
    p?.isPartPayment && (p?.totalAmount ?? 0) > 0
      ? (p?.totalAmount ?? 0) - amount
      : null;

  return (
    <>
      <PagePrintStyles pageSize={pageSize} />
      <Paginator pageSize={pageSize}>
        <h1 style={{ textAlign: 'center', textTransform: 'uppercase' }}>
          Receipt
        </h1>

        <section>
          <table style={{ width: '100%' }}>
            <tbody>
              <tr>
                <td style={{ width: '60%' }}>
                  <p>
                    <strong>{payee?.name || '[Issuer / received by]'}</strong>
                    {payee?.address ? (
                      <>
                        <br />
                        {payee.address}
                      </>
                    ) : (
                      ''
                    )}
                    {payee?.gstinPan ? (
                      <>
                        <br />
                        {payee.gstinPan}
                      </>
                    ) : (
                      ''
                    )}
                  </p>
                </td>
                <td style={{ width: '40%', textAlign: 'right' }}>
                  <p>
                    <strong>Receipt No.:</strong>{' '}
                    <EditableField
                      path="receipt.number"
                      value={r?.number}
                      widget="text"
                      placeholder="RCPT-0001"
                    />
                    <br />
                    <strong>Date:</strong>{' '}
                    <EditableField
                      path="receipt.date"
                      value={r?.date}
                      widget="date"
                      placeholder="date"
                    >
                      {formatDateLong(r?.date)}
                    </EditableField>
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <p style={{ fontSize: '13pt', lineHeight: 1.8 }}>
            Received with thanks from{' '}
            <strong>
              <EditableField
                path="payer.name"
                value={payer?.name}
                widget="text"
                placeholder="payer name"
              />
            </strong>
            {payer?.address ? `, ${payer.address}` : ''} the sum of{' '}
            <strong>{formatMoney(amount, currency)}</strong>
            {currency === 'INR' && amount > 0 ? (
              <> ({formatINRWords(Math.round(amount))} Rupees only)</>
            ) : (
              ''
            )}{' '}
            {modeText}
            {p?.reference ? (
              <>
                {' ('}
                <EditableField
                  path="payment.reference"
                  value={p.reference}
                  widget="text"
                  placeholder="reference"
                />
                {p?.bankName ? `, ${p.bankName}` : ''}
                {')'}
              </>
            ) : (
              ''
            )}{' '}
            towards{' '}
            <strong>
              <EditableField
                path="payment.towards"
                value={p?.towards}
                widget="textarea"
                placeholder="what this payment is for"
              />
            </strong>
            .
          </p>
        </section>

        {balance !== null && (
          <section>
            <table style={{ width: '60%' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '2pt 6pt' }}>Total amount</td>
                  <td style={{ padding: '2pt 6pt', textAlign: 'right' }}>
                    {formatMoney(p?.totalAmount ?? 0, currency)}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '2pt 6pt' }}>Received now</td>
                  <td style={{ padding: '2pt 6pt', textAlign: 'right' }}>
                    {formatMoney(amount, currency)}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '2pt 6pt', fontWeight: 700 }}>
                    Balance due
                  </td>
                  <td
                    style={{
                      padding: '2pt 6pt',
                      textAlign: 'right',
                      fontWeight: 700,
                    }}
                  >
                    {formatMoney(balance, currency)}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

        {data.notes?.note ? (
          <section>
            <p>{data.notes.note}</p>
          </section>
        ) : null}

        <section>
          <table style={{ width: '100%', marginTop: '24pt' }}>
            <tbody>
              <tr>
                <td style={{ width: '60%', verticalAlign: 'bottom' }}>
                  <p style={{ fontSize: '9pt', color: '#666' }}>
                    {r?.place ? `Place: ${r.place}` : ''}
                  </p>
                </td>
                <td style={{ width: '40%', textAlign: 'right' }}>
                  <p style={{ marginTop: '24pt' }}>
                    ____________________________
                    <br />
                    For {payee?.name || '[Issuer]'}
                    <br />
                    (Authorised signatory)
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
