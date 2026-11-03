// /api/pin-login.js
// Heartwood — reception PIN sign-in, checked on the server.
//
// The reception PIN used to be checked in the browser, which meant the
// reception account's email AND password sat in Heartwood's page code for
// anyone to read. Now the browser only sends the PIN here; the PIN and the
// reception login live in Vercel environment variables, and this function
// hands back a normal Supabase session if (and only if) the PIN is right.
//
// Setup in Vercel (home-hub project → Settings → Environment Variables):
//   RECEPTION_PIN       the PIN reception taps in (e.g. a new 4–6 digit PIN)
//   RECEPTION_EMAIL     reception@homehub.local
//   RECEPTION_PASSWORD  the reception account's NEW password (after resetting it in Supabase)

const crypto = require('crypto');

const SB_URL = 'https://tdwxyzjwktdwhszugkah.supabase.co';
const SB_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkd3h5emp3a3Rkd2hzenVna2FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDI1MjMsImV4cCI6MjA5NDU3ODUyM30.66D9iFNhJ-vXhFIUnUoSru_NpoGtSdKiSMjChLfCKXo';

function same(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    if (typeof req.body === 'string') { try { return resolve(JSON.parse(req.body)); } catch (e) { return resolve({}); } }
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { resolve({}); } });
  });
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(JSON.stringify({ error: 'Method not allowed' })); }

  const PIN = process.env.RECEPTION_PIN;
  const EMAIL = process.env.RECEPTION_EMAIL;
  const PASSWORD = process.env.RECEPTION_PASSWORD;
  if (!PIN || !EMAIL || !PASSWORD) {
    res.statusCode = 503;
    return res.end(JSON.stringify({ error: 'Reception PIN sign-in isn’t set up yet — please use your normal login.' }));
  }

  const body = await readBody(req);
  const pin = String((body && body.pin) || '');

  // A short pause on every attempt makes guessing PINs slow.
  await new Promise((r) => setTimeout(r, 800));

  if (!pin || !same(pin, PIN)) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ error: 'Incorrect PIN — try again' }));
  }

  try {
    const r = await fetch(SB_URL + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { apikey: SB_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    const data = await r.json();
    if (!r.ok || !data.access_token) {
      res.statusCode = 502;
      return res.end(JSON.stringify({ error: 'The reception account couldn’t sign in — check RECEPTION_PASSWORD matches Supabase.' }));
    }
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify({ access_token: data.access_token, refresh_token: data.refresh_token }));
  } catch (e) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: 'Sign-in service unavailable' }));
  }
};
