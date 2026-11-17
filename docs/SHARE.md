# Sending matched properties: PDF + documents (email and WhatsApp)

From **Matches → Send to client** (and the **Share** button on a property page) the realtor sends the client **one PDF** of the selected properties
(price, size, amenities, photo, why each one fits the requirement) **plus the properties' shareable documents**.

| Channel | What the client gets |
|---|---|
| Email | The PDF and each document **attached**. Files over `MAIL_MAX_ATTACH_MB` in total go as download links in the email body. |
| WhatsApp | A short message with a **link to the PDF** and **a link per document**. A `wa.me` link cannot carry files, so links are used. They do not expire by default; set `SHARE_LINK_DAYS` to a number to make new links expire after that many days. A link still stops working if the file is unshared or the sender is deactivated. The official WhatsApp Business API can attach files later. |

## Rules (enforced on the server, `apps/api/src/share/`)
* Only documents marked **Shareable** on the chosen **properties** (`scope = prop:<id>`) can leave. Deal, KYC, owner ID and every other scope never can.
* The browser sends **ids only**. Property details, the client's email and the files are read from the database.
* Download links are signed (HMAC) with a key derived from `JWT_SECRET` (separate from login tokens), expire, and are **re-checked on every download**:
  un-sharing a file, deactivating the sender, or a property no longer being Available makes the link return 404.
* Every send is written to the audit log (who, to whom, which properties/documents).

## Files
* `pdf.ts` — small dependency-free PDF writer (embedded DejaVu Sans subset in `apps/api/assets/fonts`, so ₹ prints; JPEG photos).
* `matches-pdf.ts` — the page layout (summary page + one page per property).
* `share.service.ts` — reads data, builds the PDF, sends the email, prepares the WhatsApp message, resolves links.
* `share.controller.ts` — `POST /api/share/matches` (signed in) and public `GET /api/share/f/:token`.
* `share.token.ts` — signed expiring tokens. `test/share.test.ts` — `npm run test:share`.

## Settings (Railway → api → Variables), all optional
`PUBLIC_WEB_URL`, `SHARE_LINK_DAYS`, `SHARE_LINK_SECRET`, `MAIL_MAX_ATTACH_MB`. Email itself needs a provider (Brevo/Resend/SMTP), see `.env.example`.
Uploaded documents live in `UPLOAD_DIR`: keep it on the Railway volume so files survive a redeploy.
