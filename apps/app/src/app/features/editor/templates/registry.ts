import type { DocumentTemplate } from './types';

const PAGE_BREAK = '<div data-page-break></div>';

export const TEMPLATES: DocumentTemplate[] = [
  {
    id: 'blank',
    name: 'Blank Document',
    description: 'Start from an empty canvas. No placeholders, no structure.',
    category: 'General',
    icon: '📄',
    html: '<h1>Untitled Document</h1><p></p>',
    placeholders: [],
  },
  {
    id: 'rent-agreement',
    name: 'Rent Agreement',
    description:
      'Residential rental contract with tenant, landlord, and terms.',
    category: 'Legal',
    icon: '🏠',
    html: `<h1 style="text-align: center">RENT AGREEMENT</h1>
<p>This Rent Agreement (the "Agreement") is made and executed on <strong>{{date}}</strong> at <strong>{{city}}</strong> between:</p>
<h2>1. Parties</h2>
<p><strong>Landlord:</strong> {{landlordName}}, residing at {{landlordAddress}} (hereinafter referred to as the "Landlord").</p>
<p><strong>Tenant:</strong> {{tenantName}}, residing at {{tenantAddress}} (hereinafter referred to as the "Tenant").</p>
<h2>2. Premises</h2>
<p>The Landlord agrees to let out the premises situated at <strong>{{propertyAddress}}</strong> ("Premises") to the Tenant for residential use only.</p>
<h2>3. Term</h2>
<p>The tenancy shall commence on <strong>{{startDate}}</strong> and continue for a period of <strong>{{durationMonths}}</strong> months, unless terminated earlier in accordance with this Agreement.</p>
<h2>4. Rent & Deposit</h2>
<ol>
<li>Monthly rent of <strong>₹{{rentAmount}}</strong> shall be paid on or before the {{dueDay}} day of each calendar month.</li>
<li>A refundable security deposit of <strong>₹{{depositAmount}}</strong> has been paid by the Tenant to the Landlord on signing.</li>
<li>Payment method: <strong>{{paymentMethod}}</strong>.</li>
</ol>
${PAGE_BREAK}
<h2>5. Termination</h2>
<p>Either party may terminate this Agreement by providing not less than <strong>{{noticeMonths}}</strong> months prior written notice.</p>
<h2>6. Use & Conduct</h2>
<p>The Tenant shall not sublet the Premises or use them for any purpose other than residential. The Tenant shall maintain the Premises in good condition, normal wear and tear excepted.</p>
<h2>7. Governing Law</h2>
<p>This Agreement shall be governed by and construed in accordance with the laws of India, and disputes shall be subject to the exclusive jurisdiction of the courts at {{jurisdictionCity}}.</p>
<h2>8. Signatures</h2>
<p>IN WITNESS WHEREOF, the parties have executed this Agreement on the date first written above.</p>
<p><br></p>
<p>______________________________<br><strong>Landlord:</strong> {{landlordName}}</p>
<p><br></p>
<p>______________________________<br><strong>Tenant:</strong> {{tenantName}}</p>
<p><br></p>
<p><strong>Witness 1:</strong> ______________________________</p>
<p><strong>Witness 2:</strong> ______________________________</p>`,
    placeholders: [
      { key: 'date', label: 'Agreement Date', type: 'date' },
      {
        key: 'city',
        label: 'City of Execution',
        type: 'text',
        placeholder: 'Bengaluru',
      },
      { key: 'landlordName', label: 'Landlord Name', type: 'text' },
      {
        key: 'landlordAddress',
        label: 'Landlord Address',
        type: 'textarea',
        wide: true,
      },
      { key: 'tenantName', label: 'Tenant Name', type: 'text' },
      {
        key: 'tenantAddress',
        label: 'Tenant Address',
        type: 'textarea',
        wide: true,
      },
      {
        key: 'propertyAddress',
        label: 'Property Address',
        type: 'textarea',
        wide: true,
      },
      { key: 'startDate', label: 'Start Date', type: 'date' },
      {
        key: 'durationMonths',
        label: 'Duration (months)',
        type: 'number',
        default: '11',
      },
      { key: 'rentAmount', label: 'Monthly Rent (₹)', type: 'number' },
      {
        key: 'dueDay',
        label: 'Due Day of Month',
        type: 'number',
        default: '5',
      },
      { key: 'depositAmount', label: 'Security Deposit (₹)', type: 'number' },
      {
        key: 'paymentMethod',
        label: 'Payment Method',
        type: 'select',
        default: 'Bank Transfer',
        options: [
          { value: 'Bank Transfer', label: 'Bank Transfer' },
          { value: 'UPI', label: 'UPI' },
          { value: 'Cheque', label: 'Cheque' },
          { value: 'Cash', label: 'Cash' },
        ],
      },
      {
        key: 'noticeMonths',
        label: 'Notice Period (months)',
        type: 'number',
        default: '1',
      },
      { key: 'jurisdictionCity', label: 'Jurisdiction City', type: 'text' },
    ],
  },
  {
    id: 'nda',
    name: 'Non-Disclosure Agreement',
    description: 'Mutual NDA between two parties protecting confidential info.',
    category: 'Legal',
    icon: '🔒',
    html: `<h1 style="text-align: center">MUTUAL NON-DISCLOSURE AGREEMENT</h1>
<p>This Non-Disclosure Agreement (the "Agreement") is entered into on <strong>{{effectiveDate}}</strong> by and between:</p>
<p><strong>{{partyA}}</strong>, located at {{partyAAddress}} ("Party A"), and</p>
<p><strong>{{partyB}}</strong>, located at {{partyBAddress}} ("Party B").</p>
<h2>1. Purpose</h2>
<p>The parties wish to explore a potential business relationship in connection with <em>{{purpose}}</em> (the "Purpose"), and in the course of doing so, may disclose to each other certain Confidential Information.</p>
<h2>2. Confidential Information</h2>
<p>"Confidential Information" means any non-public information disclosed by one party to the other, including but not limited to technical data, trade secrets, know-how, research, product plans, customer lists, financials, and business strategy.</p>
<h2>3. Obligations</h2>
<ol>
<li>Each party shall hold the other's Confidential Information in strict confidence.</li>
<li>Neither party shall use the Confidential Information for any purpose outside the scope of this Agreement.</li>
<li>Each party shall protect the Confidential Information with the same degree of care it uses for its own confidential material, but in no event less than reasonable care.</li>
</ol>
<h2>4. Term</h2>
<p>The obligations under this Agreement shall remain in effect for a period of <strong>{{termYears}}</strong> years from the Effective Date.</p>
${PAGE_BREAK}
<h2>5. Exclusions</h2>
<p>Confidential Information shall not include information that: (a) is or becomes publicly known through no fault of the receiving party; (b) was rightfully known by the receiving party prior to disclosure; (c) is independently developed without use of the disclosing party's Confidential Information; or (d) is rightfully obtained from a third party without restriction.</p>
<h2>6. Governing Law</h2>
<p>This Agreement shall be governed by the laws of <strong>{{governingLaw}}</strong>.</p>
<h2>7. Signatures</h2>
<p><br></p>
<p><strong>{{partyA}}</strong></p>
<p>By: ______________________________</p>
<p>Name: {{partyASigner}}</p>
<p>Title: {{partyATitle}}</p>
<p><br></p>
<p><strong>{{partyB}}</strong></p>
<p>By: ______________________________</p>
<p>Name: {{partyBSigner}}</p>
<p>Title: {{partyBTitle}}</p>`,
    placeholders: [
      { key: 'effectiveDate', label: 'Effective Date', type: 'date' },
      { key: 'partyA', label: 'Party A (Company)', type: 'text' },
      {
        key: 'partyAAddress',
        label: 'Party A Address',
        type: 'textarea',
        wide: true,
      },
      { key: 'partyB', label: 'Party B (Company)', type: 'text' },
      {
        key: 'partyBAddress',
        label: 'Party B Address',
        type: 'textarea',
        wide: true,
      },
      {
        key: 'purpose',
        label: 'Purpose of Disclosure',
        type: 'textarea',
        wide: true,
      },
      { key: 'termYears', label: 'Term (years)', type: 'number', default: '3' },
      {
        key: 'governingLaw',
        label: 'Governing Law',
        type: 'text',
        placeholder: 'State / Country',
      },
      { key: 'partyASigner', label: 'Party A Signer Name', type: 'text' },
      { key: 'partyATitle', label: 'Party A Signer Title', type: 'text' },
      { key: 'partyBSigner', label: 'Party B Signer Name', type: 'text' },
      { key: 'partyBTitle', label: 'Party B Signer Title', type: 'text' },
    ],
  },
  {
    id: 'offer-letter',
    name: 'Offer Letter',
    description: 'Employment offer with compensation, role, and start date.',
    category: 'HR',
    icon: '💼',
    html: `<p style="text-align: right">{{companyName}}<br>{{companyAddress}}</p>
<p>{{offerDate}}</p>
<p><strong>{{candidateName}}</strong><br>{{candidateAddress}}</p>
<p>Dear {{candidateName}},</p>
<h1>Offer of Employment</h1>
<p>We are delighted to extend an offer for the position of <strong>{{jobTitle}}</strong> at <strong>{{companyName}}</strong>, reporting to <strong>{{managerName}}</strong>.</p>
<h2>Compensation</h2>
<ul>
<li><strong>Annual base salary:</strong> ₹{{annualSalary}}, payable monthly.</li>
<li><strong>Joining bonus:</strong> ₹{{joiningBonus}}.</li>
<li><strong>Employment type:</strong> {{employmentType}}.</li>
</ul>
<h2>Start Date & Location</h2>
<p>Your tentative start date is <strong>{{startDate}}</strong>, with primary work location at <strong>{{workLocation}}</strong>.</p>
<h2>Probation</h2>
<p>You will be on a probationary period of <strong>{{probationMonths}}</strong> months from your start date, after which your employment will be confirmed subject to performance review.</p>
<h2>Acceptance</h2>
<p>Please sign and return this letter by <strong>{{acceptanceDeadline}}</strong> to confirm your acceptance of this offer.</p>
<p>We look forward to welcoming you to the team.</p>
<p><br></p>
<p>Sincerely,</p>
<p>______________________________<br>{{signerName}}<br>{{signerTitle}}, {{companyName}}</p>
<p><br></p>
<p><strong>Accepted by:</strong> ______________________________ ({{candidateName}})</p>
<p><strong>Date:</strong> ______________________________</p>`,
    placeholders: [
      { key: 'companyName', label: 'Company Name', type: 'text' },
      {
        key: 'companyAddress',
        label: 'Company Address',
        type: 'textarea',
        wide: true,
      },
      { key: 'offerDate', label: 'Offer Date', type: 'date' },
      { key: 'candidateName', label: 'Candidate Name', type: 'text' },
      {
        key: 'candidateAddress',
        label: 'Candidate Address',
        type: 'textarea',
        wide: true,
      },
      { key: 'jobTitle', label: 'Job Title', type: 'text' },
      { key: 'managerName', label: 'Reporting Manager', type: 'text' },
      { key: 'annualSalary', label: 'Annual Salary (₹)', type: 'number' },
      {
        key: 'joiningBonus',
        label: 'Joining Bonus (₹)',
        type: 'number',
        default: '0',
      },
      {
        key: 'employmentType',
        label: 'Employment Type',
        type: 'select',
        default: 'Full-time',
        options: [
          { value: 'Full-time', label: 'Full-time' },
          { value: 'Part-time', label: 'Part-time' },
          { value: 'Contract', label: 'Contract' },
          { value: 'Intern', label: 'Intern' },
        ],
      },
      { key: 'startDate', label: 'Tentative Start Date', type: 'date' },
      { key: 'workLocation', label: 'Work Location', type: 'text' },
      {
        key: 'probationMonths',
        label: 'Probation (months)',
        type: 'number',
        default: '3',
      },
      { key: 'acceptanceDeadline', label: 'Acceptance Deadline', type: 'date' },
      { key: 'signerName', label: 'Signed By (Name)', type: 'text' },
      { key: 'signerTitle', label: 'Signed By (Title)', type: 'text' },
    ],
  },
  {
    id: 'invoice',
    name: 'Invoice',
    description: 'Service invoice with bill-to, line items, and totals.',
    category: 'Finance',
    icon: '🧾',
    html: `<h1>INVOICE</h1>
<p><strong>Invoice #:</strong> {{invoiceNumber}}<br>
<strong>Issue Date:</strong> {{issueDate}}<br>
<strong>Due Date:</strong> {{dueDate}}</p>
<h2>From</h2>
<p><strong>{{senderName}}</strong><br>{{senderAddress}}<br>GSTIN: {{senderGstin}}</p>
<h2>Bill To</h2>
<p><strong>{{clientName}}</strong><br>{{clientAddress}}<br>GSTIN: {{clientGstin}}</p>
<h2>Description of Services</h2>
<p>{{serviceDescription}}</p>
<h2>Charges</h2>
<ul>
<li><strong>Subtotal:</strong> ₹{{subtotal}}</li>
<li><strong>Tax ({{taxRate}}%):</strong> ₹{{taxAmount}}</li>
<li><strong>Total Due:</strong> ₹{{totalAmount}}</li>
</ul>
<h2>Payment Instructions</h2>
<p>Please remit payment by <strong>{{dueDate}}</strong> via {{paymentMethod}}.</p>
<p>{{paymentDetails}}</p>
<p><br></p>
<p><em>Thank you for your business.</em></p>`,
    placeholders: [
      {
        key: 'invoiceNumber',
        label: 'Invoice Number',
        type: 'text',
        placeholder: 'INV-0001',
      },
      { key: 'issueDate', label: 'Issue Date', type: 'date' },
      { key: 'dueDate', label: 'Due Date', type: 'date' },
      { key: 'senderName', label: 'Your Business Name', type: 'text' },
      {
        key: 'senderAddress',
        label: 'Your Address',
        type: 'textarea',
        wide: true,
      },
      { key: 'senderGstin', label: 'Your GSTIN', type: 'text' },
      { key: 'clientName', label: 'Client Name', type: 'text' },
      {
        key: 'clientAddress',
        label: 'Client Address',
        type: 'textarea',
        wide: true,
      },
      { key: 'clientGstin', label: 'Client GSTIN', type: 'text' },
      {
        key: 'serviceDescription',
        label: 'Service Description',
        type: 'textarea',
        wide: true,
      },
      { key: 'subtotal', label: 'Subtotal (₹)', type: 'number' },
      { key: 'taxRate', label: 'Tax Rate (%)', type: 'number', default: '18' },
      { key: 'taxAmount', label: 'Tax Amount (₹)', type: 'number' },
      { key: 'totalAmount', label: 'Total Due (₹)', type: 'number' },
      {
        key: 'paymentMethod',
        label: 'Payment Method',
        type: 'select',
        default: 'Bank Transfer',
        options: [
          { value: 'Bank Transfer', label: 'Bank Transfer' },
          { value: 'UPI', label: 'UPI' },
          { value: 'Cheque', label: 'Cheque' },
          { value: 'Razorpay', label: 'Razorpay' },
        ],
      },
      {
        key: 'paymentDetails',
        label: 'Payment Details',
        type: 'textarea',
        wide: true,
        placeholder: 'Bank: HDFC, A/C: xxxx, IFSC: xxxx',
      },
    ],
  },
];

export function getTemplateById(id: string): DocumentTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
