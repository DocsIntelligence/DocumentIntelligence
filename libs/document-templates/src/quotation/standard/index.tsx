import type { QuotationData } from '@org/document-schema';
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
  data: Partial<QuotationData>;
  pageSize: PageSizeKey;
}

/**
 * Quotation / Estimate (A4), India + global. Reuses the shared invoice compute
 * engine and presentational parts so totals can never drift from the line
 * items. Differs from an invoice: a "valid until" date, no payment/balance, and
 * a "Quotation"/"Estimate" heading. No statutory citations are authored.
 */
export function QuotationStandard({ data, pageSize }: Props) {
  const q = data.quote;
  const seller = data.seller;
  const buyer = data.buyer;
  const currency = q?.currency ?? 'INR';
  const result = computeInvoice({
    taxMode: q?.taxMode,
    inclusive: q?.pricesIncludeTax,
    items: data.items,
    sellerState: seller?.state,
    supplyState: q?.placeOfSupply || buyer?.state,
    additionalDiscount: data.summary?.additionalDiscount,
    shipping: data.summary?.shipping,
    roundOff: data.summary?.roundOff,
  });
  const taxLabel =
    q?.taxMode === 'single' ? q?.singleTaxLabel || 'Tax' : 'Tax';

  return (
    <>
      <PagePrintStyles pageSize={pageSize} />
      <Paginator pageSize={pageSize}>
        <h1 style={{ textAlign: 'center', textTransform: 'uppercase' }}>
          Quotation
        </h1>

        {/* Seller + quote meta */}
        <section>
          <table style={{ width: '100%' }}>
            <tbody>
              <tr>
                <td style={{ width: '55%', verticalAlign: 'top' }}>
                  <PartyBlock
                    name={seller?.name}
                    placeholder="[Your business / seller name]"
                    lines={partyLines(seller)}
                  />
                </td>
                <td style={{ width: '45%', verticalAlign: 'top' }}>
                  <p>
                    <strong>Quotation #:</strong>{' '}
                    <EditableField
                      path="quote.number"
                      value={q?.number}
                      widget="text"
                      placeholder="QUO-0001"
                    />
                    <br />
                    <strong>Date:</strong>{' '}
                    <EditableField
                      path="quote.date"
                      value={q?.date}
                      widget="date"
                      placeholder="date"
                    >
                      {formatDateLong(q?.date)}
                    </EditableField>
                    {q?.validUntil ? (
                      <>
                        <br />
                        <strong>Valid until:</strong>{' '}
                        {formatDateLong(q.validUntil)}
                      </>
                    ) : (
                      ''
                    )}
                    {q?.taxMode === 'gst' && (q?.placeOfSupply || buyer?.state) ? (
                      <>
                        <br />
                        <strong>Place of supply:</strong>{' '}
                        {q?.placeOfSupply || buyer?.state}
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

        {/* Quote to */}
        <section>
          <PartyBlock
            heading="Quotation To"
            name={buyer?.name}
            placeholder="[Client name]"
            lines={partyLines(buyer)}
          />
        </section>

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
                  This quotation is valid only for the period stated and is not a
                  tax invoice.
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
