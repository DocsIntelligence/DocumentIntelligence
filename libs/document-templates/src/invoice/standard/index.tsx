import type { InvoiceData, InvoiceItem } from '@org/document-schema';
import { EditableField } from '../../_internals/EditableField';
import { formatDateLong, formatINRWords } from '../../_internals/format';
import { PagePrintStyles } from '../../_internals/Page';
import { Paginator } from '../../_internals/Paginator';
import type { PageSizeKey } from '../../_internals/page-sizes';

interface Props {
  data: Partial<InvoiceData>;
  pageSize: PageSizeKey;
  headerText?: string;
  footerText?: string;
}

interface ComputedLine {
  item: InvoiceItem;
  taxable: number;
  taxRate: number;
  tax: number;
  total: number;
}

interface RateGroup {
  rate: number;
  taxable: number;
  tax: number;
}

/**
 * Compute every figure from the raw line items so totals can never drift from
 * inputs. Handles: tax-exclusive/inclusive pricing, per-line discount %,
 * GST/single/none tax, and a proportional invoice-level additional discount.
 */
function compute(data: Partial<InvoiceData>) {
  const inv = data.invoice;
  const taxMode = inv?.taxMode ?? 'gst';
  const inclusive = inv?.pricesIncludeTax === true;
  const items = (data.items ?? []).filter(
    (it) => it && (it.description?.trim() || (it.quantity ?? 0) > 0),
  );

  const lines: ComputedLine[] = items.map((item) => {
    const qty = Number(item.quantity ?? 0);
    const rate = Number(item.rate ?? 0);
    const disc = Number(item.discountPct ?? 0);
    const taxRate = taxMode === 'none' ? 0 : Number(item.taxRate ?? 0);
    const afterDisc = qty * rate * (1 - disc / 100);
    let taxable: number;
    let tax: number;
    if (inclusive && taxRate > 0) {
      taxable = afterDisc / (1 + taxRate / 100);
      tax = afterDisc - taxable;
    } else {
      taxable = afterDisc;
      tax = taxable * (taxRate / 100);
    }
    return { item, taxable, taxRate, tax, total: taxable + tax };
  });

  const itemsTaxable = lines.reduce((s, l) => s + l.taxable, 0);
  const itemsTax = lines.reduce((s, l) => s + l.tax, 0);

  // Invoice-level discount applied proportionally to the taxable base so tax
  // stays consistent with the reduced base.
  const addlDiscount = Number(data.summary?.additionalDiscount ?? 0);
  const factor =
    addlDiscount > 0 && itemsTaxable > 0
      ? Math.max(0, 1 - addlDiscount / itemsTaxable)
      : 1;
  const appliedDiscount = itemsTaxable - itemsTaxable * factor;
  const taxableAfter = itemsTaxable * factor;
  const taxAfter = itemsTax * factor;

  // Rate-wise grouping for the tax summary.
  const groupMap = new Map<number, RateGroup>();
  for (const l of lines) {
    const g = groupMap.get(l.taxRate) ?? { rate: l.taxRate, taxable: 0, tax: 0 };
    g.taxable += l.taxable * factor;
    g.tax += l.tax * factor;
    groupMap.set(l.taxRate, g);
  }
  const groups = [...groupMap.values()]
    .filter((g) => g.rate > 0)
    .sort((a, b) => a.rate - b.rate);

  // Intra- vs inter-state (GST): CGST+SGST when same state, else IGST.
  const sellerState = data.seller?.state?.trim().toLowerCase();
  const supplyState = (inv?.placeOfSupply || data.buyer?.state || '')
    .trim()
    .toLowerCase();
  const interState =
    !!sellerState && !!supplyState && sellerState !== supplyState;

  const shipping = Number(data.summary?.shipping ?? 0);
  const preRound = taxableAfter + taxAfter + shipping;
  const roundOff = data.summary?.roundOff !== false;
  const grand = roundOff ? Math.round(preRound) : preRound;
  const roundOffAmt = grand - preRound;
  const amountPaid = Number(data.summary?.amountPaid ?? 0);
  const balanceDue = grand - amountPaid;

  return {
    taxMode,
    inclusive,
    lines,
    groups,
    interState,
    itemsTaxable,
    appliedDiscount,
    taxableAfter,
    taxAfter,
    shipping,
    roundOffAmt,
    grand,
    amountPaid,
    balanceDue,
  };
}

/**
 * Full tax invoice (A4), India + global. Computes all totals from the line
 * items; renders an items table, a tax-mode-aware totals block, a rate-wise
 * GST summary (CGST/SGST or IGST), amount in words (INR), payment details, and
 * notes/terms. No statutory citations are authored.
 */
export function InvoiceStandard({ data, pageSize, headerText, footerText }: Props) {
  const inv = data.invoice;
  const seller = data.seller;
  const buyer = data.buyer;
  const c = compute(data);
  const currency = inv?.currency ?? 'INR';
  const isGst = c.taxMode === 'gst';
  const showTax = c.taxMode !== 'none';

  const fmt = new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const money = (n: number) => fmt.format(Number.isFinite(n) ? n : 0);
  const taxLabel =
    c.taxMode === 'single' ? inv?.singleTaxLabel || 'Tax' : 'Tax';

  const title = isGst ? 'Tax Invoice' : 'Invoice';
  const half = isGst && !c.interState; // CGST + SGST each half

  return (
    <>
      <PagePrintStyles pageSize={pageSize} />
      <Paginator pageSize={pageSize} headerText={headerText} footerText={footerText}>
        <h1 style={{ textAlign: 'center', textTransform: 'uppercase' }}>
          {title}
        </h1>
        {inv?.reverseCharge && (
          <p style={{ textAlign: 'center', fontSize: '9pt' }}>
            (Tax payable under reverse charge)
          </p>
        )}

        {/* Seller + invoice meta */}
        <section>
          <table style={{ width: '100%' }}>
            <tbody>
              <tr>
                <td style={{ width: '55%', verticalAlign: 'top' }}>
                  <p>
                    <strong>{seller?.name || '[Seller / business name]'}</strong>
                    {seller?.address ? (
                      <>
                        <br />
                        {seller.address}
                      </>
                    ) : (
                      ''
                    )}
                    {seller?.city || seller?.state || seller?.pincode ? (
                      <>
                        <br />
                        {[seller?.city, seller?.state, seller?.pincode]
                          .filter(Boolean)
                          .join(', ')}
                      </>
                    ) : (
                      ''
                    )}
                    {seller?.gstin ? (
                      <>
                        <br />
                        GSTIN: {seller.gstin}
                      </>
                    ) : (
                      ''
                    )}
                    {seller?.pan ? (
                      <>
                        <br />
                        PAN: {seller.pan}
                      </>
                    ) : (
                      ''
                    )}
                    {seller?.email || seller?.phone ? (
                      <>
                        <br />
                        {[seller?.email, seller?.phone]
                          .filter(Boolean)
                          .join(' · ')}
                      </>
                    ) : (
                      ''
                    )}
                  </p>
                </td>
                <td style={{ width: '45%', verticalAlign: 'top' }}>
                  <p>
                    <strong>Invoice #:</strong>{' '}
                    <EditableField
                      path="invoice.number"
                      value={inv?.number}
                      widget="text"
                      placeholder="INV-0001"
                    />
                    <br />
                    <strong>Date:</strong>{' '}
                    <EditableField
                      path="invoice.date"
                      value={inv?.date}
                      widget="date"
                      placeholder="date"
                    >
                      {formatDateLong(inv?.date)}
                    </EditableField>
                    {inv?.dueDate ? (
                      <>
                        <br />
                        <strong>Due:</strong> {formatDateLong(inv.dueDate)}
                      </>
                    ) : (
                      ''
                    )}
                    {inv?.poReference ? (
                      <>
                        <br />
                        <strong>PO/Ref:</strong> {inv.poReference}
                      </>
                    ) : (
                      ''
                    )}
                    {isGst && (inv?.placeOfSupply || buyer?.state) ? (
                      <>
                        <br />
                        <strong>Place of supply:</strong>{' '}
                        {inv?.placeOfSupply || buyer?.state}
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

        {/* Bill to / Ship to */}
        <section>
          <table style={{ width: '100%' }}>
            <tbody>
              <tr>
                <td style={{ width: '50%', verticalAlign: 'top' }}>
                  <p>
                    <strong>Bill To</strong>
                    <br />
                    {buyer?.name || '[Customer name]'}
                    {buyer?.billingAddress ? (
                      <>
                        <br />
                        {buyer.billingAddress}
                      </>
                    ) : (
                      ''
                    )}
                    {buyer?.city || buyer?.state || buyer?.pincode ? (
                      <>
                        <br />
                        {[buyer?.city, buyer?.state, buyer?.pincode]
                          .filter(Boolean)
                          .join(', ')}
                      </>
                    ) : (
                      ''
                    )}
                    {buyer?.gstin ? (
                      <>
                        <br />
                        GSTIN: {buyer.gstin}
                      </>
                    ) : (
                      ''
                    )}
                  </p>
                </td>
                {buyer?.shippingAddress ? (
                  <td style={{ width: '50%', verticalAlign: 'top' }}>
                    <p>
                      <strong>Ship To</strong>
                      <br />
                      {buyer.shippingAddress}
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
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={cellH}>#</th>
                <th style={{ ...cellH, textAlign: 'left' }}>Description</th>
                {isGst && <th style={cellH}>HSN/SAC</th>}
                <th style={cellH}>Qty</th>
                <th style={cellH}>Rate</th>
                <th style={cellH}>Disc%</th>
                <th style={cellH}>{showTax ? 'Taxable' : 'Amount'}</th>
                {showTax && <th style={cellH}>{taxLabel}%</th>}
                {showTax && <th style={cellH}>Amount</th>}
              </tr>
            </thead>
            <tbody>
              {c.lines.length > 0 ? (
                c.lines.map((l, i) => (
                  <tr key={i}>
                    <td style={cell}>{i + 1}</td>
                    <td style={{ ...cell, textAlign: 'left' }}>
                      {l.item.description}
                      {l.item.unit ? (
                        <span style={{ color: '#777' }}> ({l.item.unit})</span>
                      ) : (
                        ''
                      )}
                    </td>
                    {isGst && <td style={cell}>{l.item.hsnSac || '—'}</td>}
                    <td style={cellR}>{l.item.quantity ?? 0}</td>
                    <td style={cellR}>{money(Number(l.item.rate ?? 0))}</td>
                    <td style={cellR}>
                      {l.item.discountPct ? `${l.item.discountPct}%` : '—'}
                    </td>
                    <td style={cellR}>{money(l.taxable)}</td>
                    {showTax && <td style={cellR}>{l.taxRate}%</td>}
                    {showTax && <td style={cellR}>{money(l.total)}</td>}
                  </tr>
                ))
              ) : (
                <tr>
                  <td style={cell} colSpan={isGst ? 9 : 6}>
                    <em>No line items.</em>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* Totals */}
        <section>
          <table style={{ width: '100%' }}>
            <tbody>
              <tr>
                <td style={{ width: '55%', verticalAlign: 'top' }}>
                  {currency === 'INR' && c.grand > 0 ? (
                    <p>
                      <strong>Amount in words:</strong>{' '}
                      {formatINRWords(Math.round(c.grand))} Rupees only
                    </p>
                  ) : (
                    ''
                  )}
                </td>
                <td style={{ width: '45%' }}>
                  <table style={{ width: '100%' }}>
                    <tbody>
                      <tr>
                        <td style={totLbl}>Subtotal</td>
                        <td style={totVal}>{money(c.itemsTaxable)}</td>
                      </tr>
                      {c.appliedDiscount > 0 && (
                        <tr>
                          <td style={totLbl}>Discount</td>
                          <td style={totVal}>− {money(c.appliedDiscount)}</td>
                        </tr>
                      )}
                      {showTax &&
                        (isGst && half ? (
                          <>
                            <tr>
                              <td style={totLbl}>CGST</td>
                              <td style={totVal}>{money(c.taxAfter / 2)}</td>
                            </tr>
                            <tr>
                              <td style={totLbl}>SGST</td>
                              <td style={totVal}>{money(c.taxAfter / 2)}</td>
                            </tr>
                          </>
                        ) : isGst ? (
                          <tr>
                            <td style={totLbl}>IGST</td>
                            <td style={totVal}>{money(c.taxAfter)}</td>
                          </tr>
                        ) : (
                          <tr>
                            <td style={totLbl}>{taxLabel}</td>
                            <td style={totVal}>{money(c.taxAfter)}</td>
                          </tr>
                        ))}
                      {c.shipping > 0 && (
                        <tr>
                          <td style={totLbl}>Shipping / charges</td>
                          <td style={totVal}>{money(c.shipping)}</td>
                        </tr>
                      )}
                      {Math.abs(c.roundOffAmt) >= 0.005 && (
                        <tr>
                          <td style={totLbl}>Round off</td>
                          <td style={totVal}>
                            {c.roundOffAmt >= 0 ? '+ ' : '− '}
                            {money(Math.abs(c.roundOffAmt))}
                          </td>
                        </tr>
                      )}
                      <tr>
                        <td style={{ ...totLbl, fontWeight: 700 }}>Total</td>
                        <td style={{ ...totVal, fontWeight: 700 }}>
                          {money(c.grand)}
                        </td>
                      </tr>
                      {c.amountPaid > 0 && (
                        <>
                          <tr>
                            <td style={totLbl}>Paid</td>
                            <td style={totVal}>− {money(c.amountPaid)}</td>
                          </tr>
                          <tr>
                            <td style={{ ...totLbl, fontWeight: 700 }}>
                              Balance due
                            </td>
                            <td style={{ ...totVal, fontWeight: 700 }}>
                              {money(c.balanceDue)}
                            </td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* GST rate-wise tax summary */}
        {isGst && c.groups.length > 0 && (
          <section>
            <h2>Tax Summary</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={cellH}>Rate</th>
                  <th style={cellH}>Taxable</th>
                  {half ? (
                    <>
                      <th style={cellH}>CGST</th>
                      <th style={cellH}>SGST</th>
                    </>
                  ) : (
                    <th style={cellH}>IGST</th>
                  )}
                  <th style={cellH}>Total Tax</th>
                </tr>
              </thead>
              <tbody>
                {c.groups.map((g) => (
                  <tr key={g.rate}>
                    <td style={cell}>{g.rate}%</td>
                    <td style={cellR}>{money(g.taxable)}</td>
                    {half ? (
                      <>
                        <td style={cellR}>{money(g.tax / 2)}</td>
                        <td style={cellR}>{money(g.tax / 2)}</td>
                      </>
                    ) : (
                      <td style={cellR}>{money(g.tax)}</td>
                    )}
                    <td style={cellR}>{money(g.tax)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Payment + notes */}
        {(data.payment?.bankName ||
          data.payment?.upiId ||
          data.payment?.terms) && (
          <section>
            <h2>Payment</h2>
            <p>
              {data.payment?.terms ? (
                <>
                  Terms: {data.payment.terms}
                  <br />
                </>
              ) : (
                ''
              )}
              {data.payment?.bankName ? (
                <>
                  Bank: {data.payment.bankName}
                  {data.payment?.accountName
                    ? `, ${data.payment.accountName}`
                    : ''}
                  <br />
                  {data.payment?.accountNumber
                    ? `A/c: ${data.payment.accountNumber}`
                    : ''}
                  {data.payment?.ifsc ? `  IFSC/SWIFT: ${data.payment.ifsc}` : ''}
                  <br />
                </>
              ) : (
                ''
              )}
              {data.payment?.upiId ? <>UPI: {data.payment.upiId}</> : ''}
            </p>
          </section>
        )}

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
                  This is a computer-generated invoice.
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

const cellH: React.CSSProperties = {
  border: '1px solid #ccc',
  padding: '4pt 6pt',
  textAlign: 'right',
  background: '#f3f4f6',
  fontSize: '9.5pt',
};
const cell: React.CSSProperties = {
  border: '1px solid #ccc',
  padding: '4pt 6pt',
  textAlign: 'center',
  fontSize: '9.5pt',
};
const cellR: React.CSSProperties = { ...cell, textAlign: 'right' };
const totLbl: React.CSSProperties = {
  padding: '2pt 6pt',
  textAlign: 'right',
  color: '#444',
};
const totVal: React.CSSProperties = {
  padding: '2pt 6pt',
  textAlign: 'right',
  width: '40%',
};
