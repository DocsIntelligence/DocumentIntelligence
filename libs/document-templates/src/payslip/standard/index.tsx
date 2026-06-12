import type { PayslipData } from '@org/document-schema';
import { EditableField } from '../../_internals/EditableField';
import {
  formatDateLong,
  formatINRWords,
  formatMoney,
} from '../../_internals/format';
import { PagePrintStyles } from '../../_internals/Page';
import { Paginator } from '../../_internals/Paginator';
import type { PageSizeKey } from '../../_internals/page-sizes';

interface Props {
  data: Partial<PayslipData>;
  pageSize: PageSizeKey;
}

const cellH: React.CSSProperties = {
  border: '1px solid #ccc',
  padding: '4pt 6pt',
  textAlign: 'left',
  background: '#f3f4f6',
  fontSize: '9.5pt',
};
const cell: React.CSSProperties = {
  border: '1px solid #ccc',
  padding: '4pt 6pt',
  textAlign: 'left',
  fontSize: '9.5pt',
};
const cellR: React.CSSProperties = { ...cell, textAlign: 'right' };
const cellRH: React.CSSProperties = { ...cellH, textAlign: 'right' };

function Detail({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <tr>
      <td style={{ padding: '1pt 8pt 1pt 0', color: '#555' }}>{label}</td>
      <td style={{ padding: '1pt 0', fontWeight: 600 }}>{value}</td>
    </tr>
  );
}

/**
 * Payslip / Salary slip (A4), India + global. Net pay is computed from the
 * earnings and deductions components (gross − deductions) so it can never drift.
 * Earnings and deductions render side-by-side; net pay is shown in figures and
 * (for INR) in words. No statutory citations are authored.
 */
export function PayslipStandard({ data, pageSize }: Props) {
  const meta = data.payslip;
  const employer = data.employer;
  const employee = data.employee;
  const currency = meta?.currency ?? 'INR';
  const money = (n: number) => formatMoney(n, currency);

  const earnings = (data.earnings ?? []).filter(
    (e) => e?.component?.trim() || (e?.amount ?? 0) > 0,
  );
  const deductions = (data.deductions ?? []).filter(
    (d) => d?.component?.trim() || (d?.amount ?? 0) > 0,
  );
  const gross = earnings.reduce((s, e) => s + Number(e?.amount ?? 0), 0);
  const totalDeductions = deductions.reduce(
    (s, d) => s + Number(d?.amount ?? 0),
    0,
  );
  const net = gross - totalDeductions;
  const rows = Math.max(earnings.length, deductions.length, 1);

  return (
    <>
      <PagePrintStyles pageSize={pageSize} />
      <Paginator pageSize={pageSize}>
        <h1 style={{ textAlign: 'center', marginBottom: '2pt' }}>
          {employer?.name || '[Employer name]'}
        </h1>
        {employer?.address ? (
          <p style={{ textAlign: 'center', fontSize: '9.5pt', color: '#555' }}>
            {employer.address}
            {employer?.gstinPan ? ` · ${employer.gstinPan}` : ''}
          </p>
        ) : (
          ''
        )}
        <h2 style={{ textAlign: 'center', textTransform: 'uppercase' }}>
          Payslip for{' '}
          <EditableField
            path="payslip.payPeriodLabel"
            value={meta?.payPeriodLabel}
            widget="text"
            placeholder="June 2026"
          />
        </h2>

        {/* Employee details */}
        <section>
          <table style={{ width: '100%' }}>
            <tbody>
              <tr>
                <td style={{ width: '50%', verticalAlign: 'top' }}>
                  <table>
                    <tbody>
                      <Detail label="Employee" value={employee?.name} />
                      <Detail label="Employee ID" value={employee?.code} />
                      <Detail
                        label="Designation"
                        value={employee?.designation}
                      />
                      <Detail
                        label="Department"
                        value={employee?.department}
                      />
                      <Detail
                        label="Date of joining"
                        value={
                          employee?.dateOfJoining
                            ? formatDateLong(employee.dateOfJoining)
                            : undefined
                        }
                      />
                    </tbody>
                  </table>
                </td>
                <td style={{ width: '50%', verticalAlign: 'top' }}>
                  <table>
                    <tbody>
                      <Detail
                        label="Pay date"
                        value={
                          meta?.payDate
                            ? formatDateLong(meta.payDate)
                            : undefined
                        }
                      />
                      <Detail
                        label="Paid days"
                        value={
                          meta?.paidDays != null
                            ? String(meta.paidDays)
                            : undefined
                        }
                      />
                      <Detail
                        label="LOP days"
                        value={
                          meta?.lopDays ? String(meta.lopDays) : undefined
                        }
                      />
                      <Detail label="PAN" value={employee?.pan} />
                      <Detail label="UAN" value={employee?.uan} />
                      <Detail label="ESI no." value={employee?.esiNumber} />
                      <Detail
                        label="Bank A/c"
                        value={
                          employee?.bankAccount
                            ? `${employee.bankAccount}${
                                employee?.bankName
                                  ? ` (${employee.bankName})`
                                  : ''
                              }`
                            : undefined
                        }
                      />
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Earnings + deductions side-by-side */}
        <section>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={cellH}>Earnings</th>
                <th style={cellRH}>Amount</th>
                <th style={cellH}>Deductions</th>
                <th style={cellRH}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rows }).map((_, i) => (
                <tr key={i}>
                  <td style={cell}>{earnings[i]?.component ?? ''}</td>
                  <td style={cellR}>
                    {earnings[i] ? money(Number(earnings[i].amount ?? 0)) : ''}
                  </td>
                  <td style={cell}>{deductions[i]?.component ?? ''}</td>
                  <td style={cellR}>
                    {deductions[i]
                      ? money(Number(deductions[i].amount ?? 0))
                      : ''}
                  </td>
                </tr>
              ))}
              <tr>
                <td style={{ ...cell, fontWeight: 700 }}>Gross Earnings</td>
                <td style={{ ...cellR, fontWeight: 700 }}>{money(gross)}</td>
                <td style={{ ...cell, fontWeight: 700 }}>Total Deductions</td>
                <td style={{ ...cellR, fontWeight: 700 }}>
                  {money(totalDeductions)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Net pay */}
        <section>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td
                  style={{
                    ...cell,
                    fontWeight: 700,
                    fontSize: '11pt',
                    background: '#f3f4f6',
                  }}
                >
                  Net Pay
                </td>
                <td
                  style={{
                    ...cellR,
                    fontWeight: 700,
                    fontSize: '11pt',
                    background: '#f3f4f6',
                  }}
                >
                  {money(net)}
                </td>
              </tr>
            </tbody>
          </table>
          {currency === 'INR' && net > 0 ? (
            <p style={{ fontSize: '9.5pt' }}>
              <strong>In words:</strong> {formatINRWords(Math.round(net))}{' '}
              Rupees only
            </p>
          ) : (
            ''
          )}
        </section>

        {data.notes?.note ? (
          <section>
            <p style={{ fontSize: '9.5pt' }}>{data.notes.note}</p>
          </section>
        ) : null}

        <section>
          <p style={{ fontSize: '8.5pt', color: '#666', marginTop: '16pt' }}>
            This is a computer-generated payslip and does not require a signature.
          </p>
        </section>
      </Paginator>
    </>
  );
}
