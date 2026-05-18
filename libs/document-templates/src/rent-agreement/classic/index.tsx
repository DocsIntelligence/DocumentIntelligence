import type { RentAgreementData } from '@org/document-schema';
import { EditableField } from '../../_internals/EditableField';
import {
  formatDateLong,
  formatINR,
  formatINRWords,
} from '../../_internals/format';
import { PagePrintStyles } from '../../_internals/Page';
import { Paginator } from '../../_internals/Paginator';
import { StampPaperFrame } from '../../_internals/StampPaperFrame';
import type { PageSizeKey } from '../../_internals/page-sizes';

interface Props {
  data: Partial<RentAgreementData>;
  pageSize: PageSizeKey;
}

/**
 * Classic English rent-agreement template. Single column. Renders into
 * paginated <Page> containers. Tuned for India: stamp-paper-aware, party
 * blocks in the customary "S/o" / "D/o" form, witness block at bottom.
 *
 * User-fillable values are wrapped with <EditableField/>. When rendered
 * inside the live preview (TemplateRenderer with editable=true), each
 * wrapped value becomes click-to-edit and posts an event up to the
 * builder shell. PDF/Puppeteer rendering uses editable=false → plain text.
 */
export function RentAgreementClassic({ data, pageSize }: Props) {
  const ll = data.parties?.landlord;
  const tn = data.parties?.tenant;
  const prop = data.property;
  const term = data.term;
  const rent = data.rent_deposit;
  const utils = data.utilities;
  const rules = data.rules;
  const witnesses = data.witnesses ?? [];
  const cityForExecution = data.city || prop?.city || '';

  return (
    <>
      <PagePrintStyles pageSize={pageSize} />
      <StampPaperFrame pageSize={pageSize}>
        <Paginator pageSize={pageSize}>
          <h1>Rent Agreement</h1>

          <p>
            This <strong>Rent Agreement</strong> is made and executed on{' '}
            <strong>
              <EditableField
                path="executionDate"
                value={data.executionDate}
                widget="date"
                placeholder="execution date"
              >
                {formatDateLong(data.executionDate)}
              </EditableField>
            </strong>{' '}
            at{' '}
            <strong>
              <EditableField
                path="city"
                value={cityForExecution}
                widget="text"
                placeholder="city"
              />
            </strong>
            , by and between:
          </p>

          <section>
            <h2>Landlord</h2>
            <p>
              <strong>
                <EditableField
                  path="parties.landlord.name"
                  value={ll?.name}
                  widget="text"
                  placeholder="Landlord name"
                />
              </strong>
              {', '}
              <EditableField
                path="parties.landlord.parentRelation"
                value={ll?.parentRelation}
                widget="select"
                placeholder="S/o, D/o, W/o"
              />{' '}
              <EditableField
                path="parties.landlord.parentName"
                value={ll?.parentName}
                widget="text"
                placeholder="parent/spouse name"
              />
              , aged about{' '}
              <EditableField
                path="parties.landlord.age"
                value={ll?.age}
                widget="number"
                placeholder="age"
              />{' '}
              years,{' '}
              <EditableField
                path="parties.landlord.occupation"
                value={ll?.occupation}
                widget="text"
                placeholder="occupation"
              />{' '}
              by occupation, residing at{' '}
              <EditableField
                path="parties.landlord.address"
                value={ll?.address}
                widget="textarea"
                placeholder="address"
              />{' '}
              (hereinafter referred to as the &ldquo;Landlord&rdquo;, which
              expression shall, unless repugnant to the context, include their
              heirs, executors, administrators, and assigns).
            </p>
          </section>

          <section>
            <h2>Tenant</h2>
            <p>
              <strong>
                <EditableField
                  path="parties.tenant.name"
                  value={tn?.name}
                  widget="text"
                  placeholder="Tenant name"
                />
              </strong>
              {', '}
              <EditableField
                path="parties.tenant.parentRelation"
                value={tn?.parentRelation}
                widget="select"
                placeholder="S/o, D/o, W/o"
              />{' '}
              <EditableField
                path="parties.tenant.parentName"
                value={tn?.parentName}
                widget="text"
                placeholder="parent/spouse name"
              />
              , aged about{' '}
              <EditableField
                path="parties.tenant.age"
                value={tn?.age}
                widget="number"
                placeholder="age"
              />{' '}
              years,{' '}
              <EditableField
                path="parties.tenant.occupation"
                value={tn?.occupation}
                widget="text"
                placeholder="occupation"
              />{' '}
              by occupation, residing at{' '}
              <EditableField
                path="parties.tenant.address"
                value={tn?.address}
                widget="textarea"
                placeholder="address"
              />{' '}
              (hereinafter referred to as the &ldquo;Tenant&rdquo;, which
              expression shall, unless repugnant to the context, include their
              heirs, executors, administrators, and permitted assigns).
            </p>
          </section>

          <section>
            <h2>1. Premises</h2>
            <p>
              The Landlord hereby lets out to the Tenant the premises situated
              at{' '}
              <strong>
                <EditableField
                  path="property.address"
                  value={prop?.address}
                  widget="textarea"
                  placeholder="street address"
                />
                ,{' '}
                <EditableField
                  path="property.city"
                  value={prop?.city}
                  widget="text"
                  placeholder="city"
                />
                ,{' '}
                <EditableField
                  path="property.state"
                  value={prop?.state}
                  widget="text"
                  placeholder="state"
                />{' '}
                <EditableField
                  path="property.pincode"
                  value={prop?.pincode}
                  widget="text"
                  placeholder="pincode"
                />
              </strong>
              , admeasuring approximately{' '}
              <EditableField
                path="property.builtUpAreaSqft"
                value={prop?.builtUpAreaSqft}
                widget="number"
                placeholder="area sqft"
              />{' '}
              sq. ft.,{' '}
              <EditableField
                path="property.furnished"
                value={prop?.furnished}
                widget="select"
                placeholder="furnishing"
              >
                {prop?.furnished ? prop.furnished.replace('_', '-') : undefined}
              </EditableField>
              {' '}(the &ldquo;Premises&rdquo;).
            </p>
            {(prop?.inventory?.length ?? 0) > 0 && (
              <p>
                <em>Inventory of fittings/fixtures:</em>{' '}
                {(prop?.inventory ?? []).join('; ')}.
              </p>
            )}
          </section>

          <section>
            <h2>2. Term</h2>
            <p>
              The tenancy shall commence on{' '}
              <strong>
                <EditableField
                  path="term.startDate"
                  value={term?.startDate}
                  widget="date"
                  placeholder="start date"
                >
                  {formatDateLong(term?.startDate)}
                </EditableField>
              </strong>{' '}
              and shall continue for a period of{' '}
              <strong>
                <EditableField
                  path="term.durationMonths"
                  value={term?.durationMonths}
                  widget="number"
                  placeholder="months"
                />{' '}
                months
              </strong>
              {term?.renewable
                ? ', renewable by mutual written consent of both parties.'
                : ', and is not renewable except by a fresh agreement.'}
              {' '}Either party may terminate this Agreement by giving{' '}
              <strong>
                <EditableField
                  path="term.noticePeriodDays"
                  value={term?.noticePeriodDays}
                  widget="number"
                  placeholder="30"
                />{' '}
                days
              </strong>{' '}
              prior written notice.
              {term?.lockInMonths
                ? (
                    <>
                      {' '}A lock-in period of{' '}
                      <EditableField
                        path="term.lockInMonths"
                        value={term.lockInMonths}
                        widget="number"
                        placeholder="months"
                      />{' '}
                      month(s) shall apply.
                    </>
                  )
                : ''}
            </p>
          </section>

          <section>
            <h2>3. Rent</h2>
            <p>
              The Tenant shall pay to the Landlord a monthly rent of{' '}
              <strong>
                <EditableField
                  path="rent_deposit.rentMonthly"
                  value={rent?.rentMonthly}
                  widget="currency"
                  placeholder="monthly rent"
                >
                  {formatINR(rent?.rentMonthly)}
                </EditableField>
              </strong>{' '}
              {rent?.rentMonthly
                ? `(${formatINRWords(rent.rentMonthly)} Rupees only)`
                : ''}
              , payable in advance on or before the{' '}
              <strong>
                <EditableField
                  path="rent_deposit.rentDueDay"
                  value={rent?.rentDueDay}
                  widget="number"
                  placeholder="day"
                />
              </strong>
              th day of each calendar month.
              {rent?.escalationPercent
                ? (
                    <>
                      {' '}The rent shall be escalated by{' '}
                      <EditableField
                        path="rent_deposit.escalationPercent"
                        value={rent.escalationPercent}
                        widget="number"
                        placeholder="%"
                      />
                      % every{' '}
                      <EditableField
                        path="rent_deposit.escalationEveryMonths"
                        value={rent.escalationEveryMonths}
                        widget="number"
                        placeholder="months"
                      />{' '}
                      months.
                    </>
                  )
                : ''}
              {rent?.lateFeePerDay
                ? (
                    <>
                      {' '}Delayed payment shall attract a late fee of{' '}
                      <EditableField
                        path="rent_deposit.lateFeePerDay"
                        value={rent.lateFeePerDay}
                        widget="currency"
                        placeholder="late fee/day"
                      >
                        {formatINR(rent.lateFeePerDay)}
                      </EditableField>{' '}
                      per day.
                    </>
                  )
                : ''}
            </p>
          </section>

          <section>
            <h2>4. Security Deposit</h2>
            <p>
              The Tenant has, on or before the execution of this Agreement,
              paid to the Landlord an interest-free refundable security deposit
              of{' '}
              <strong>
                <EditableField
                  path="rent_deposit.depositAmount"
                  value={rent?.depositAmount}
                  widget="currency"
                  placeholder="deposit"
                >
                  {formatINR(rent?.depositAmount)}
                </EditableField>
              </strong>
              {rent?.depositAmount
                ? ` (${formatINRWords(rent.depositAmount)} Rupees only)`
                : ''}
              , receipt of which the Landlord hereby acknowledges. The deposit
              shall be refunded to the Tenant within{' '}
              <strong>
                <EditableField
                  path="rent_deposit.depositReturnDays"
                  value={rent?.depositReturnDays}
                  widget="number"
                  placeholder="days"
                />
              </strong>{' '}
              days of vacating the Premises, after deducting arrears of rent,
              electricity, and any damage beyond normal wear and tear.
            </p>
          </section>

          <section>
            <h2>5. Utilities</h2>
            <table>
              <tbody>
                <tr>
                  <td>Electricity</td>
                  <td>
                    <EditableField
                      path="utilities.electricityPaidBy"
                      value={utils?.electricityPaidBy}
                      widget="select"
                      placeholder="who pays"
                    />
                  </td>
                </tr>
                <tr>
                  <td>Water</td>
                  <td>
                    <EditableField
                      path="utilities.waterPaidBy"
                      value={utils?.waterPaidBy}
                      widget="select"
                      placeholder="who pays"
                    />
                  </td>
                </tr>
                <tr>
                  <td>Maintenance</td>
                  <td>
                    <EditableField
                      path="utilities.maintenancePaidBy"
                      value={utils?.maintenancePaidBy}
                      widget="select"
                      placeholder="who pays"
                    />
                  </td>
                </tr>
                <tr>
                  <td>Internet</td>
                  <td>
                    <EditableField
                      path="utilities.internetPaidBy"
                      value={utils?.internetPaidBy}
                      widget="select"
                      placeholder="who pays"
                    />
                  </td>
                </tr>
                <tr>
                  <td>Society charges</td>
                  <td>
                    <EditableField
                      path="utilities.societyChargesPaidBy"
                      value={utils?.societyChargesPaidBy}
                      widget="select"
                      placeholder="who pays"
                    />
                  </td>
                </tr>
                <tr>
                  <td>Property tax</td>
                  <td>
                    <EditableField
                      path="utilities.propertyTaxPaidBy"
                      value={utils?.propertyTaxPaidBy}
                      widget="select"
                      placeholder="who pays"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2>6. Use of Premises &amp; House Rules</h2>
            <p>
              The Tenant shall use the Premises solely for{' '}
              {rules?.commercialUseAllowed ? 'lawful commercial' : 'lawful residential'}{' '}
              purposes. The Tenant shall not assign, sublet, or part with
              possession of the Premises{' '}
              {rules?.subletAllowed ? '' : 'without the prior written consent of the Landlord'}.
              {rules?.alterationsAllowed
                ? ' Structural alterations may be made with prior written consent.'
                : ' No structural alterations shall be made to the Premises.'}
              {' '}Pets are {rules?.petsAllowed ? 'permitted' : 'not permitted'}; smoking is{' '}
              {rules?.smokingAllowed ? 'permitted' : 'not permitted'} within the Premises.
              {rules?.maxOccupants
                ? (
                    <>
                      {' '}The Premises shall not be occupied by more than{' '}
                      <EditableField
                        path="rules.maxOccupants"
                        value={rules.maxOccupants}
                        widget="number"
                        placeholder="occupants"
                      />{' '}
                      persons.
                    </>
                  )
                : ''}
            </p>
            {(rules?.customRules?.length ?? 0) > 0 && (
              <ol>
                {(rules?.customRules ?? []).map((r: string, i: number) => (
                  <li key={i}>{r}</li>
                ))}
              </ol>
            )}
          </section>

          <section>
            <h2>7. Termination</h2>
            <p>
              The Landlord may terminate this Agreement forthwith in the event
              of non-payment of rent for two consecutive months, breach of any
              term herein, or use of the Premises for any unlawful purpose. The
              Tenant shall, upon termination, hand over peaceful and vacant
              possession of the Premises in the same condition in which it was
              received, subject to normal wear and tear.
            </p>
          </section>

          <section>
            <h2>8. Governing Law &amp; Jurisdiction</h2>
            <p>
              This Agreement shall be governed by and construed in accordance
              with the laws of India. The courts at{' '}
              <strong>
                <EditableField
                  path="property.city"
                  value={prop?.city || cityForExecution}
                  widget="text"
                  placeholder="city"
                />
              </strong>{' '}
              shall have exclusive jurisdiction over any disputes arising
              hereunder.
            </p>
          </section>

          <section>
            <p>
              <em>
                IN WITNESS WHEREOF, the parties have signed this Agreement on
                the day, month, and year first above written.
              </em>
            </p>
          </section>

          <section>
            <table style={{ marginTop: '14pt' }}>
              <tbody>
                <tr>
                  <td style={{ width: '50%', paddingRight: '8pt' }}>
                    <p style={{ marginTop: '24pt' }}>
                      ____________________________
                    </p>
                    <p>
                      <strong>Landlord</strong>
                      <br />
                      {ll?.name || ''}
                    </p>
                  </td>
                  <td style={{ width: '50%', paddingLeft: '8pt' }}>
                    <p style={{ marginTop: '24pt' }}>
                      ____________________________
                    </p>
                    <p>
                      <strong>Tenant</strong>
                      <br />
                      {tn?.name || ''}
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
                {witnesses.map(
                  (w: { name: string; address?: string }, i: number) => (
                    <li key={i}>
                      {w.name}
                      {w.address ? `, ${w.address}` : ''}
                    </li>
                  ),
                )}
              </ol>
            </section>
          )}
        </Paginator>
      </StampPaperFrame>
    </>
  );
}
