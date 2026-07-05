const Stripe = require('stripe');

const config = { api: { bodyParser: false } };

function buffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on('data', (chunk) => chunks.push(chunk));
    readable.on('end', () => resolve(Buffer.concat(chunks)));
    readable.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe signature check failed:', err.message);
    res.status(400).send('Webhook signature verification failed');
    return;
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const bookingId = session.client_reference_id;

      if (bookingId) {
        const supabaseUrl = process.env.SUPABASE_URL || 'https://tdwxyzjwktdwhszugkah.supabase.co';
        const resp = await fetch(supabaseUrl + '/rest/v1/session_bookings?id=eq.' + bookingId, {
          method: 'PATCH',
          headers: {
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal'
          },
          body: JSON.stringify({ payment_status: 'paid' })
        });
        if (!resp.ok) {
          console.error('Supabase update failed:', resp.status, await resp.text());
        }
      } else {
        console.warn('checkout.session.completed with no client_reference_id — cannot match a booking');
      }
    }
  } catch (err) {
    console.error('Error handling Stripe event:', err);
    /* Still tell Stripe we got it, so it doesn't retry forever on our bug */
  }

  res.status(200).json({ received: true });
};

module.exports.config = config;
