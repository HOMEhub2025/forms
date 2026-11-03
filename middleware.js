/* ═══ STAFF GATE ═══
   Runs on Vercel before a page is served. The staff companion app and the
   staff event manager can't even be loaded until someone enters the staff
   access code once on that device. Public pages (kiosk sign-in, forms,
   booking, SECH partner page) are NOT listed below, so they stay open.

   The access code lives only in Vercel as the environment variable
   STAFF_ACCESS_CODE — never in this file. Change it there (then redeploy)
   and every device has to enter the new code. 💚 */

export const config = {
  matcher: ['/', '/index', '/index.html', '/event-manager', '/event-manager.html'],
};

const COOKIE = 'hh_staff_gate';

async function expectedToken(code) {
  const data = new TextEncoder().encode('hh-staff-gate-v1:' + code);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function readCookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

function gatePage(message, status) {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>H.O.M.E Hub</title>
<link href="https://fonts.googleapis.com/css2?family=League+Spartan:wght@700&family=Montserrat:wght@500;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;font-family:Montserrat,sans-serif;background:linear-gradient(160deg,#006837 0%,#004d28 55%,#0e386a 100%);color:#fff;display:flex;flex-direction:column;align-items:center;padding:64px 20px}
img{height:62px;margin-bottom:14px}
h1{font-family:'League Spartan',sans-serif;font-size:1.35rem}
p{font-size:.82rem;color:rgba(255,255,255,.82);margin:6px 0 22px;text-align:center;max-width:300px;line-height:1.5}
form{background:#fff;border-radius:16px;padding:20px 18px;width:100%;max-width:360px;display:flex;flex-direction:column;gap:12px}
label{font-size:.72rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em}
input{font-size:16px;padding:13px 14px;border-radius:10px;border:1.5px solid #e2e8f0;font-family:inherit}
button{background:#f58221;color:#fff;border:none;border-radius:12px;padding:15px;font-size:.9rem;font-weight:700;font-family:inherit;cursor:pointer}
.err{background:#fef2f2;border:1.5px solid #fecaca;color:#dc2626;padding:11px 13px;border-radius:10px;font-size:.78rem;font-weight:600}
</style></head><body>
<img src="https://homehub-benfleet.co.uk/wp-content/uploads/2026/03/HOME_HUB_NO_BACKGROUND.png" alt="H.O.M.E Hub">
<h1>H.O.M.E Hub Team</h1>
<p>This area is for the H.O.M.E Hub team. Enter the staff access code to continue.</p>
<form method="POST" action="/api/staff-gate">
  <label for="code">Staff access code</label>
  <input id="code" name="code" type="password" autocomplete="current-password" required autofocus>
  ${message ? `<div class="err">${message}</div>` : ''}
  <button type="submit">Continue</button>
</form>
</body></html>`;
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}

export default async function middleware(request) {
  const code = process.env.STAFF_ACCESS_CODE;
  if (!code) {
    // Fail closed: if the code hasn't been set up, nobody gets in.
    return gatePage('The staff gate isn’t set up yet — please contact Mark.', 503);
  }
  const have = readCookie(request, COOKIE);
  if (have && have === (await expectedToken(code))) {
    return; // let the request through to the page
  }
  const url = new URL(request.url);
  const failed = url.searchParams.get('gate') === 'wrong';
  return gatePage(failed ? 'That code isn’t right — please try again.' : '', 401);
}
