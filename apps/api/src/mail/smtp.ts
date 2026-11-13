// A tiny SMTP client (no extra packages): connects with TLS (port 465), logs in, and sends one HTML + plain-text email.
// Works with Gmail (smtp.gmail.com:465 + an "app password"), Brevo SMTP (smtp-relay.brevo.com uses 587, so use the HTTP API there) and
// any other server that offers implicit TLS on port 465.
import * as tls from 'tls';

// Everything needed to send one email over SMTP.
export interface SmtpMail {
  host: string; port: number; user: string; pass: string;
  from: string; fromName: string; to: string; toName: string; replyTo: string; replyToName: string;
  subject: string; html: string; text: string;
  tlsOptions?: tls.ConnectionOptions; // tests only (self-signed certificate)
}

// Remove line breaks so a value can never inject extra headers.
const oneLine = (s: string) => String(s || '').replace(/[\r\n]+/g, ' ').trim();
// Encode a header value as UTF-8 base64 (RFC 2047) so ₹, é … survive.
const encWord = (s: string) => '=?UTF-8?B?' + Buffer.from(oneLine(s), 'utf8').toString('base64') + '?=';
// "Name" <addr> with the name encoded.
const addr = (name: string, email: string) => (name ? `${encWord(name)} <${oneLine(email)}>` : oneLine(email));
// Base64 body wrapped at 76 characters per line.
const b64 = (s: string) => (Buffer.from(s, 'utf8').toString('base64').match(/.{1,76}/g) || []).join('\r\n');

/** Build the full MIME message (multipart/alternative: plain text + HTML). */
export function buildMime(m: SmtpMail, boundary = 'sf-' + Math.random().toString(36).slice(2)) {
  const host = (m.from.split('@')[1] || 'localhost');
  return [
    `From: ${addr(m.fromName, m.from)}`, `To: ${addr(m.toName, m.to)}`, `Reply-To: ${addr(m.replyToName, m.replyTo)}`,
    `Subject: ${encWord(m.subject)}`, `Date: ${new Date().toUTCString()}`, `Message-ID: <${Date.now()}.${Math.random().toString(36).slice(2)}@${host}>`,
    'MIME-Version: 1.0', `Content-Type: multipart/alternative; boundary="${boundary}"`, '',
    `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(m.text),
    `--${boundary}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(m.html),
    `--${boundary}--`, '',
  ].join('\r\n');
}

/** Send one email. Resolves when the server accepted it; rejects with a readable message otherwise. */
export function sendSmtp(m: SmtpMail): Promise<void> {
  return new Promise((resolve, reject) => {
    let buf = ''; let done = false; let waiter: ((code: number, text: string) => void) | null = null;
    const sock = tls.connect({ host: m.host, port: m.port, servername: m.host, ...(m.tlsOptions || {}) });
    sock.setEncoding('utf8'); sock.setTimeout(20000);
    // Fail once. Node reports a blocked or unreachable host as an AggregateError with an empty message, so name the error code.
    const fail = (e: any) => {
      if (done) return; done = true; try { sock.destroy(); } catch { /* ignore */ }
      const code = e?.code || e?.errors?.[0]?.code || ''; if (!e?.message && code) e = new Error('Cannot connect (' + code + ')');
      reject(e);
    };
    sock.on('error', fail); sock.on('timeout', () => fail(new Error('Cannot connect (ETIMEDOUT): the mail server took too long to answer.')));
    sock.on('close', () => fail(new Error('The mail server closed the connection.')));
    // Collect server lines; a reply ends at the line whose 4th character is a space ("250 OK"), earlier lines have "250-".
    sock.on('data', (d: string) => {
      buf += d;
      for (;;) {
        const lines = buf.split('\r\n'); if (lines.length < 2) return;
        const end = lines.findIndex((l, i) => i < lines.length - 1 && /^\d{3} /.test(l)); if (end < 0) return;
        const text = lines.slice(0, end + 1).join('\n'); buf = lines.slice(end + 1).join('\r\n');
        const w = waiter; waiter = null; if (w) w(Number(text.slice(0, 3)), text);
      }
    });
    // Wait for the next reply and require the given code(s).
    const expect = (...ok: number[]) => new Promise<string>((res, rej) => { waiter = (c, t) => (ok.includes(c) ? res(t) : rej(new Error('The mail server said: ' + t.replace(/\n/g, ' ').slice(0, 200)))); });
    // Send one command line and wait for the reply.
    const cmd = (line: string, ...ok: number[]) => { sock.write(line + '\r\n'); return expect(...ok); };
    (async () => {
      await expect(220);
      await cmd('EHLO squarefeets-crm', 250);
      await cmd('AUTH PLAIN ' + Buffer.from('\0' + m.user + '\0' + m.pass, 'utf8').toString('base64'), 235);
      await cmd(`MAIL FROM:<${oneLine(m.from)}>`, 250);
      await cmd(`RCPT TO:<${oneLine(m.to)}>`, 250, 251);
      await cmd('DATA', 354);
      const body = buildMime(m).replace(/^\./gm, '..'); // dot-stuffing: a line that starts with "." gets one more "."
      await cmd(body + '\r\n.', 250);
      sock.write('QUIT\r\n'); done = true; sock.end(); resolve();
    })().catch((e) => fail(e));
  });
}
