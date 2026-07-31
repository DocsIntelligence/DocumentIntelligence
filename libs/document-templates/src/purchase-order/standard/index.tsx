import type { PurchaseOrderData } from '@org/document-schema';
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
  data: Partial<PurchaseOrderData>;
  pageSize: PageSizeKey;
  headerText?: string;
  footerText?: string;
}

/**
 * Purchase Order (A4), India + global. Buyer-issued order to a vendor; reuses
 * the shared invoice compute engine and parts so totals never drift. Shows the
 * issuing buyer, the vendor, a ship-to/required-by, the line items, totals, and
 * terms. No statutory citations are authored.
 */
export function PurchaseOrderStandard({ data, pageSize, headerText, footerText }: Props) {
  const po = data.po;
  const buyer = data.buyer;
  const vendor = data.vendor;
  const currency = po?.currency ?? 'INR';
  const result = computeInvoice({
    taxMode: po?.taxMode,
    inclusive: po?.pricesIncludeTax,
    items: data.items,
    sellerState: vendor?.state,
    supplyState: po?.placeOfSupply || buyer?.state,
    additionalDiscount: data.summary?.additionalDiscount,
    shipping: data.summary?.shipping,
    roundOff: data.summary?.roundOff,
  });
  const taxLabel =
    po?.taxMode === 'single' ? po?.singleTaxLabel || 'Tax' : 'Tax';

  return (
    <>
      <PagePrintStyles pageSize={pageSize} />
      <Paginator pageSize={pageSize} headerText={headerText} footerText={footerText}>
        <h1 style={{ textAlign: 'center', textTransform: 'uppercase' }}>
          Purchase Order
        </h1>

        {/* Buyer (issuing) + PO meta */}
        <section>
          <table style={{ width: '100%' }}>
            <tbody>
              <tr>
                <td style={{ width: '55%', verticalAlign: 'top' }}>
                  <PartyBlock
                    heading="Buyer"
                    name={buyer?.name}
                    placeholder="[Your organisation]"
                    lines={partyLines(buyer)}
                  />
                </td>
                <td style={{ width: '45%', verticalAlign: 'top' }}>
                  <p>
                    <strong>PO #:</strong>{' '}
                    <EditableField
                      path="po.number"
                      value={po?.number}
                      widget="text"
                      placeholder="PO-0001"
                    />
                    <br />
                    <strong>Date:</strong>{' '}
                    <EditableField
                      path="po.date"
                      value={po?.date}
                      widget="date"
                      placeholder="date"
                    >
                      {formatDateLong(po?.date)}
                    </EditableField>
                    {po?.requiredBy ? (
                      <>
                        <br />
                        <strong>Required by:</strong>{' '}
                        {formatDateLong(po.requiredBy)}
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

        {/* Vendor + ship-to */}
        <section>
          <table style={{ width: '100%' }}>
            <tbody>
              <tr>
                <td style={{ width: '50%', verticalAlign: 'top' }}>
                  <PartyBlock
                    heading="Vendor"
                    name={vendor?.name}
                    placeholder="[Supplier name]"
                    lines={partyLines(vendor)}
                  />
                </td>
                {po?.shipTo ? (
                  <td style={{ width: '50%', verticalAlign: 'top' }}>
                    <p>
                      <strong>Ship To</strong>
                      <br />
                      {po.shipTo}
                    </p>
                  </td>
                ) : (
                  <td style={{ width: '50%' }} />
                )}
              </tr>
            </tbody>
          </table>
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
                  Please quote this PO number on all invoices and delivery notes.
                </td>
                <td style={{ width: '40%', textAlign: 'right' }}>
                  <p style={{ marginTop: '28pt' }}>
                    ____________________________
                    <br />
                    For {buyer?.name || '[Buyer]'}
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
