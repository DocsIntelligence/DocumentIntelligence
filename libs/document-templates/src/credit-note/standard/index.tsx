import type { CreditNoteData } from '@org/document-schema';
import { EditableField } from '../../_internals/EditableField';
import { formatDateLong } from '../../_internals/format';
import { computeInvoice } from '../../_internals/invoice-compute';
import {
  ItemsTable,
  PartyBlock,
  TaxSummary,
  TotalsBlock,
  partyLines,
} from '../../_internals/invoice-parts';
import { PagePrintStyles } from '../../_internals/Page';
import { Paginator } from '../../_internals/Paginator';
import type { PageSizeKey } from '../../_internals/page-sizes';

interface Props {
  data: Partial<CreditNoteData>;
  pageSize: PageSizeKey;
}

/**
 * Credit / Debit Note (A4), India + global. Issued against an earlier invoice;
 * reuses the shared invoice compute engine and parts. The heading and the
 * "amount credited/debited" wording branch on noteType. No statutory citations.
 */
export function CreditNoteStandard({ data, pageSize }: Props) {
  const n = data.note;
  const seller = data.seller;
  const buyer = data.buyer;
  const currency = n?.currency ?? 'INR';
  const isDebit = n?.noteType === 'debit';
  const title = isDebit ? 'Debit Note' : 'Credit Note';
  const result = computeInvoice({
    taxMode: n?.taxMode,
    inclusive: n?.pricesIncludeTax,
    items: data.items,
    sellerState: seller?.state,
    supplyState: n?.placeOfSupply || buyer?.state,
    additionalDiscount: data.summary?.additionalDiscount,
    shipping: data.summary?.shipping,
    roundOff: data.summary?.roundOff,
  });
  const taxLabel = n?.taxMode === 'single' ? n?.singleTaxLabel || 'Tax' : 'Tax';

  return (
    <>
      <PagePrintStyles pageSize={pageSize} />
      <Paginator pageSize={pageSize}>
        <h1 style={{ textAlign: 'center', textTransform: 'uppercase' }}>
          {title}
        </h1>

        {/* Seller + note meta */}
        <section>
          <table style={{ width: '100%' }}>
            <tbody>
              <tr>
                <td style={{ width: '55%', verticalAlign: 'top' }}>
                  <PartyBlock
                    name={seller?.name}
                    placeholder="[Seller / business name]"
                    lines={partyLines(seller)}
                  />
                </td>
                <td style={{ width: '45%', verticalAlign: 'top' }}>
                  <p>
                    <strong>{title} #:</strong>{' '}
                    <EditableField
                      path="note.number"
                      value={n?.number}
                      widget="text"
                      placeholder={isDebit ? 'DN-0001' : 'CN-0001'}
                    />
                    <br />
                    <strong>Date:</strong>{' '}
                    <EditableField
                      path="note.date"
                      value={n?.date}
                      widget="date"
                      placeholder="date"
                    >
                      {formatDateLong(n?.date)}
                    </EditableField>
                    {n?.originalInvoiceNumber ? (
                      <>
                        <br />
                        <strong>Against invoice:</strong>{' '}
                        {n.originalInvoiceNumber}
                        {n?.originalInvoiceDate
                          ? ` (${formatDateLong(n.originalInvoiceDate)})`
                          : ''}
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

        {/* Buyer */}
        <section>
          <PartyBlock
            heading="Buyer"
            name={buyer?.name}
            placeholder="[Customer name]"
            lines={partyLines(buyer)}
          />
        </section>

        {/* Reason */}
        {n?.reason ? (
          <section>
            <p>
              <strong>Reason:</strong> {n.reason}
            </p>
          </section>
        ) : null}

        {/* Items */}
        <section>
          <ItemsTable result={result} currency={currency} />
        </section>

        {/* Totals */}
        <section>
          <TotalsBlock
            result={result}
            currency={currency}
            taxLabel={taxLabel}
          />
        </section>

        {/* GST rate-wise tax summary */}
        {result.taxMode === 'gst' && result.groups.length > 0 && (
          <section>
            <h2>Tax Summary</h2>
            <TaxSummary result={result} currency={currency} />
          </section>
        )}

        <section>
          <p style={{ fontSize: '10pt' }}>
            {isDebit
              ? 'The above amount has been debited to your account.'
              : 'The above amount has been credited to your account.'}
          </p>
        </section>

        {/* Notes + terms */}
        {(data.notes?.notes || data.notes?.terms) && (
          <section>
            {data.notes?.notes ? (
              <p>
                <strong>Notes:</strong> {data.notes.notes}
              </p>
            ) : (
              ''
            )}
            {data.notes?.terms ? (
              <p>
                <strong>Terms &amp; Conditions:</strong> {data.notes.terms}
              </p>
            ) : (
              ''
            )}
          </section>
        )}

        <section>
          <table style={{ width: '100%' }}>
            <tbody>
              <tr>
                <td style={{ width: '60%', fontSize: '9pt', color: '#666' }}>
                  This is a computer-generated {title.toLowerCase()}.
                </td>
                <td style={{ width: '40%', textAlign: 'right' }}>
                  <p style={{ marginTop: '28pt' }}>
                    ____________________________
                    <br />
                    For {seller?.name || '[Seller]'}
                    <br />
                    Authorised Signatory
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
