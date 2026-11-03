// Checks the staff access code from the gate page and, if it's right,
// remembers this device for 90 days with a secure cookie. The code itself
// lives only in the Vercel environment variable STAFF_ACCESS_CODE.
const crypto = require('crypto');

function token(code) {
  return crypto.createHash('sha256').update('hh-staff-gate-v1:' + code).digest('hex');
}

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    if (typeof req.body === 'string') return resolve(Object.fromEntries(new URLSearchParams(req.body)));
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => resolve(Object.fromEntries(new URLSearchParams(data))));
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end('Method not allowed'); }
  const expected = process.env.STAFF_ACCESS_CODE;
  const body = await readBody(req);
  const given = String((body && body.code) || '');

  // Small delay on every attempt makes guessing slow.
  await new Promise((r) => setTimeout(r, 600));

  const ok = expected && given.length > 0 &&
    crypto.timingSafeEqual(Buffer.from(token(given)), Buffer.from(token(expected)));

  if (!ok) {
    res.statusCode = 303;
    res.setHeader('Location', '/?gate=wrong');
    return res.end();
  }
  res.setHeader('Set-Cookie',
    'hh_staff_gate=' + token(expected) + '; Path=/; Max-Age=' + (90 * 24 * 60 * 60) + '; HttpOnly; Secure; SameSite=Lax');
  res.statusCode = 303;
  res.setHeader('Location', '/');
  res.end();
};
