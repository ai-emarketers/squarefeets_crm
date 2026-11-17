// The short email that carries the matched-properties PDF. The properties themselves are in the attached PDF, not in the email body.
import { esc } from '../mail/mail.template';

export interface ShareMailData {
  clientName: string; intro: string; propertyCount: number; attached: string[]; linked: { name: string; url: string }[];
  brokerName: string; brokerEmail: string; brokerPhone: string; orgName: string; orgAddress: string; days: number;
}
const INK = '#1B1F2A', MUT = '#6B7280', LINE = '#E3E6EC', BLUE = '#2B4FD8';

export function shareHtml(d: ShareMailData) {
  const li = (s: string) => `<li style="margin:4px 0">${s}</li>`;
  return `<!doctype html><html><body style="margin:0;background:#F4F6FA;font-family:Arial,Helvetica,sans-serif;color:${INK}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6FA"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid ${LINE};border-radius:10px">
<tr><td style="background:${BLUE};color:#fff;padding:18px 24px;border-radius:10px 10px 0 0;font-size:16px;font-weight:bold">${esc(d.orgName)}</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:22px">
<p style="margin:0 0 12px">Hi ${esc(d.clientName.split(' ')[0] || d.clientName)},</p>
<p style="margin:0 0 12px">${esc(d.intro)}</p>
<p style="margin:0 0 8px"><b>${d.propertyCount} ${d.propertyCount === 1 ? 'property' : 'properties'}</b> with price, size, amenities and why each one fits are in the attached PDF.</p>
<p style="margin:12px 0 4px;color:${MUT};font-size:13px">Attached</p><ul style="margin:0;padding-left:20px;font-size:14px">${d.attached.map((n) => li(esc(n))).join('')}</ul>
${d.linked.length ? `<p style="margin:14px 0 4px;color:${MUT};font-size:13px">Too large to attach: download links</p><ul style="margin:0;padding-left:20px;font-size:14px">${d.linked.map((l) => li(`<a href="${esc(l.url)}" style="color:${BLUE}">${esc(l.name)}</a>`)).join('')}</ul>` : ''}
<p style="margin:18px 0 0">Would you like to see any of them? Just reply to this email and I will set up a visit.</p>
<p style="margin:18px 0 0">${esc(d.brokerName)}<br><span style="color:${MUT};font-size:13px">${[d.brokerPhone, d.brokerEmail].filter(Boolean).map(esc).join(' · ')}</span></p>
</td></tr>
<tr><td style="padding:14px 24px;border-top:1px solid ${LINE};color:${MUT};font-size:12px">${esc(d.orgName)}${d.orgAddress ? ' · ' + esc(d.orgAddress) : ''}. Prices and availability are indicative and may change.</td></tr>
</table></td></tr></table></body></html>`;
}
export function shareText(d: ShareMailData) {
  return [`Hi ${d.clientName.split(' ')[0] || d.clientName},`, '', d.intro, '', `${d.propertyCount} ${d.propertyCount === 1 ? 'property' : 'properties'} are in the attached PDF.`,
    '', 'Attached:', ...d.attached.map((n) => '- ' + n), ...(d.linked.length ? ['', `Too large to attach (download links):`, ...d.linked.map((l) => `- ${l.name}: ${l.url}`)] : []),
    '', 'Would you like to see any of them? Just reply to this email and I will set up a visit.', '', d.brokerName, [d.brokerPhone, d.brokerEmail].filter(Boolean).join(' · '),
    '', d.orgName + (d.orgAddress ? ' · ' + d.orgAddress : '')].join('\n');
}
