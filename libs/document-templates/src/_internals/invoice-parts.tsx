import { Fragment } from 'react';
import { formatINRWords } from './format';
import {
  cell,
  cellH,
  cellR,
  makeMoney,
  totLbl,
  totVal,
  type ComputeResult,
} from './invoice-compute';

/**
 * A name + address party block (seller / buyer / vendor). `lines` are
 * pre-composed strings (address, city/state/pin, GSTIN, email · phone); empty
 * values are dropped so the block stays tight.
 */
export function PartyBlock({
  heading,
  name,
  placeholder = '[Name]',
  lines,
}: {
  heading?: string;
  name?: string;
  placeholder?: string;
  lines?: (string | false | undefined | null)[];
}) {
  const rest = (lines ?? []).filter(Boolean) as string[];
  return (
    <p>
      {heading ? (
        <>
          <strong>{heading}</strong>
          <br />
        </>
      ) : (
        ''
      )}
      <strong>{name || placeholder}</strong>
      {rest.map((l, i) => (
        <Fragment key={i}>
          <br />
          {l}
        </Fragment>
      ))}
    </p>
  );
}

/** Compose the standard address/identity lines for an invoice-family party. */
export function partyLines(p?: {
  address?: string;
  billingAddress?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  pan?: string;
  email?: string;
  phone?: string;
}): string[] {
  if (!p) return [];
  const cityLine = [p.city, p.state, p.pincode].filter(Boolean).join(', ');
  const contact = [p.email, p.phone].filter(Boolean).join(' · ');
  return [
    p.address || p.billingAddress || '',
    cityLine,
    p.gstin ? `GSTIN: ${p.gstin}` : '',
    p.pan ? `PAN: ${p.pan}` : '',
    contact,
  ].filter(Boolean);
}

/**
 * Shared presentational parts for invoice-family documents (invoice / quotation
 * / purchase order / credit-debit note): the line-items table, the totals
 * block, and the GST rate-wise tax summary. Each takes a `ComputeResult` from
 * `computeInvoice` so the figures are always consistent.
 */

interface PartProps {
  result: ComputeResult;
  currency: string;
}

export function ItemsTable({ result, currency }: PartProps) {
  const money = makeMoney(currency);
  const isGst = result.taxMode === 'gst';
  const showTax = result.taxMode !== 'none';
  const span = isGst ? 9 : 6;
  return (
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
          {showTax && <th style={cellH}>Tax%</th>}
          {showTax && <th style={cellH}>Amount</th>}
        </tr>
      </thead>
      <tbody>
        {result.lines.length > 0 ? (
          result.lines.map((l, i) => (
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
            <td style={cell} colSpan={span}>
              <em>No line items.</em>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

export function TotalsBlock({
  result,
  currency,
  taxLabel = 'Tax',
  showWords = true,
}: PartProps & { taxLabel?: string; showWords?: boolean }) {
  const money = makeMoney(currency);
  const isGst = result.taxMode === 'gst';
  const showTax = result.taxMode !== 'none';
  const half = isGst && !result.interState;
  return (
    <table style={{ width: '100%' }}>
      <tbody>
        <tr>
          <td style={{ width: '55%', verticalAlign: 'top' }}>
            {showWords && currency === 'INR' && result.grand > 0 ? (
              <p>
                <strong>Amount in words:</strong>{' '}
                {formatINRWords(Math.round(result.grand))} Rupees only
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
                  <td style={totVal}>{money(result.itemsTaxable)}</td>
                </tr>
                {result.appliedDiscount > 0 && (
                  <tr>
                    <td style={totLbl}>Discount</td>
                    <td style={totVal}>− {money(result.appliedDiscount)}</td>
                  </tr>
                )}
                {showTax &&
                  (isGst && half ? (
                    <>
                      <tr>
                        <td style={totLbl}>CGST</td>
                        <td style={totVal}>{money(result.taxAfter / 2)}</td>
                      </tr>
                      <tr>
                        <td style={totLbl}>SGST</td>
                        <td style={totVal}>{money(result.taxAfter / 2)}</td>
                      </tr>
                    </>
                  ) : isGst ? (
                    <tr>
                      <td style={totLbl}>IGST</td>
                      <td style={totVal}>{money(result.taxAfter)}</td>
                    </tr>
                  ) : (
                    <tr>
                      <td style={totLbl}>{taxLabel}</td>
                      <td style={totVal}>{money(result.taxAfter)}</td>
                    </tr>
                  ))}
                {result.shipping > 0 && (
                  <tr>
                    <td style={totLbl}>Shipping / charges</td>
                    <td style={totVal}>{money(result.shipping)}</td>
                  </tr>
                )}
                {Math.abs(result.roundOffAmt) >= 0.005 && (
                  <tr>
                    <td style={totLbl}>Round off</td>
                    <td style={totVal}>
                      {result.roundOffAmt >= 0 ? '+ ' : '− '}
                      {money(Math.abs(result.roundOffAmt))}
                    </td>
                  </tr>
                )}
                <tr>
                  <td style={{ ...totLbl, fontWeight: 700 }}>Total</td>
                  <td style={{ ...totVal, fontWeight: 700 }}>
                    {money(result.grand)}
                  </td>
                </tr>
                {result.amountPaid > 0 && (
                  <>
                    <tr>
                      <td style={totLbl}>Paid</td>
                      <td style={totVal}>− {money(result.amountPaid)}</td>
                    </tr>
                    <tr>
                      <td style={{ ...totLbl, fontWeight: 700 }}>Balance due</td>
                      <td style={{ ...totVal, fontWeight: 700 }}>
                        {money(result.balanceDue)}
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
  );
}

export function TaxSummary({ result, currency }: PartProps) {
  const money = makeMoney(currency);
  const half = result.taxMode === 'gst' && !result.interState;
  if (result.taxMode !== 'gst' || result.groups.length === 0) return null;
  return (
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
        {result.groups.map((g) => (
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
  );
}
