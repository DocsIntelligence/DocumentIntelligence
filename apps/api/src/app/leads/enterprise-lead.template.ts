import { baseTemplate } from '../mail/templates/base.template';
import type { EnterpriseLeadDto } from '@org/dto';

export function enterpriseLeadTemplate(data: EnterpriseLeadDto): string {
  return baseTemplate(`
    <p>New enterprise / self-hosted inquiry:</p>
    <p>
      <strong>Name:</strong> ${data.name}<br/>
      <strong>Email:</strong> ${data.email}<br/>
      <strong>Company:</strong> ${data.company}<br/>
      <strong>Team size:</strong> ${data.teamSize ?? 'not specified'}
    </p>
    ${data.message ? `<p><strong>Message:</strong><br/>${data.message.replace(/\n/g, '<br/>')}</p>` : ''}
  `);
}
