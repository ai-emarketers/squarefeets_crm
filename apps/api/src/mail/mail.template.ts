// Builds the "matched properties" email (HTML + plain text). Layout uses tables and inline styles because email
// apps ignore most modern CSS. All text coming from records is escaped before it goes into the HTML.

// One property as shown in the email.
export interface MailProperty { id: string; title: string; loc: string; facts: string; price: string; score?: number }
// Everything the template needs.
export interface MatchesMailData {
  clientName: string; reqSummary: string; intro: string; properties: MailProperty[];
  brokerName: string; brokerEmail: string; orgName: string; orgAddress: string;
}

// Escape text for safe use inside HTML.
export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
// 'Sale price in lakhs' -> "₹1.48 Cr" / "₹85 L".
export const fmtLakh = (v: number) => (v >= 100 ? '₹' + (v / 100).toFixed(2).replace(/\.?0+$/, '') + ' Cr' : '₹' + v + ' L');
// 'Monthly rent in thousands' -> "₹35,000/mo".
export const fmtRentK = (k: number) => '₹' + Math.round(k * 1000).toLocaleString('en-IN') + '/mo';

const TEAL = '#0F6B66'; const INK = '#10243A'; const MUTED = '#4A5F75'; const LINE = '#D5DEE7';

// One property card (table row).
function card(p: MailProperty) {
  return `<tr><td style="padding:0 32px 14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:12px"><tr><td style="padding:16px 18px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font:700 16px Arial,Helvetica,sans-serif;color:${INK}">${esc(p.title)}</td>
      ${typeof p.score === 'number' ? `<td align="right" style="white-space:nowrap"><span style="font:700 12px Arial,Helvetica,sans-serif;color:#0A4F4B;background:#CFE8E6;padding:4px 9px;border-radius:999px">${Math.round(p.score)}% match</span></td>` : ''}
    </tr></table>
    <div style="font:13px Arial,Helvetica,sans-serif;color:${MUTED};padding-top:6px">${esc(p.loc)}${p.facts ? ' · ' + esc(p.facts) : ''}</div>
    <div style="font:700 18px Arial,Helvetica,sans-serif;color:${TEAL};padding-top:6px">${esc(p.price)}</div>
  </td></tr></table></td></tr>`;
}

// The HTML version of the email.
export function matchesHtml(d: MatchesMailData) {
  const reply = `mailto:${encodeURIComponent(d.brokerEmail)}?subject=${encodeURIComponent('Site visit request')}`;
  const stop = `mailto:${encodeURIComponent(d.brokerEmail)}?subject=${encodeURIComponent('Please stop these emails')}`;
  return `<!doctype html><html><body style="margin:0;background:#E9EEF3"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#E9EEF3"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background:#fff;border-radius:12px;overflow:hidden">
    <tr><td style="background:${TEAL};padding:20px 32px;font:600 17px Arial,Helvetica,sans-serif;color:#fff">${esc(d.orgName)}</td></tr>
    <tr><td style="padding:28px 32px 8px"><div style="font:700 22px Arial,Helvetica,sans-serif;color:${INK};line-height:1.3">Hi ${esc(d.clientName.split(' ')[0])}, we found ${d.properties.length === 1 ? '1 home' : d.properties.length + ' homes'} for you</div>
      <p style="font:15px/1.6 Arial,Helvetica,sans-serif;color:#2B4258;margin:12px 0 0">${esc(d.intro)}</p></td></tr>
    <tr><td style="height:12px"></td></tr>
    ${d.properties.map(card).join('')}
    <tr><td align="center" style="padding:14px 32px 8px"><a href="${reply}" style="display:inline-block;font:600 15px Arial,Helvetica,sans-serif;background:${TEAL};color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px">Book a site visit</a>
      <div style="font:13.5px Arial,Helvetica,sans-serif;color:${MUTED};padding-top:12px">Or just reply to this email and we will arrange it.</div></td></tr>
    <tr><td style="padding:18px 32px"><div style="border-top:1px solid #E3E9EF;padding-top:16px;font:14px Arial,Helvetica,sans-serif;color:${INK}"><b>${esc(d.brokerName)}</b><br><span style="color:${MUTED};font-size:13px">${esc(d.orgName)} · ${esc(d.brokerEmail)}</span></div></td></tr>
    <tr><td style="background:#F3F6F9;padding:16px 32px;font:12px/1.6 Arial,Helvetica,sans-serif;color:#566B80">You are receiving this because you asked ${esc(d.orgName)} to find properties for you. <a href="${stop}" style="color:${TEAL}">Stop these emails</a>${d.orgAddress ? '<br>' + esc(d.orgAddress) : ''}</td></tr>
  </table></td></tr></table></body></html>`;
}

// The plain-text version (for email apps that block HTML).
export function matchesText(d: MatchesMailData) {
  const lines = d.properties.map((p, i) => `${i + 1}. ${p.title} – ${p.loc}\n   ${[p.facts, p.price].filter(Boolean).join(' · ')}${typeof p.score === 'number' ? ' · ' + Math.round(p.score) + '% match' : ''}`);
  return `Hi ${d.clientName.split(' ')[0]},\n\n${d.intro}\n\n${lines.join('\n\n')}\n\nTo book a site visit, just reply to this email.\n\n${d.brokerName}\n${d.orgName} · ${d.brokerEmail}\n\nReply "stop" if you do not want these emails.`;
}
