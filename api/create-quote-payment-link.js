// /api/create-quote-payment-link.js
// Heartwood — Stripe Payment Link for a room hire quote deposit
//
// Called from the Room Hire quote PDF generator (staff-only, inside the
// authenticated app) once a quote's total is already known and reviewed.
// Creates a one-off Stripe Payment Link for the deposit amount, with a
// custom "thank you for your booking" confirmation message shown the
// moment payment completes — no separate webhook or redirect needed for
// that message, Stripe shows it on its own hosted confirmation page.
//
// Setup needed in Vercel (one-time): STRIPE_SECRET_KEY environment variable
// (already set for the existing payment-intent endpoint).

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    res.status(500).json({ error: 'STRIPE_SECRET_KEY is not set in Vercel environment variables' });
    return;
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const { amount, description, quoteRef, contactEmail } = body;

    const amountPounds = Number(amount);
    if (!amountPounds || amountPounds < 1) {
      res.status(400).json({ error: 'Invalid amount' });
      return;
    }
    const amountPence = Math.round(amountPounds * 100);

    const productName = (description || 'H.O.M.E Hub room hire deposit').slice(0, 250);
    const thankYouMessage = 'Thank you for your booking! We\u2019ve received your deposit and your date is now secured. We\u2019ll be in touch about the remaining balance closer to the date. If you have any questions in the meantime, reach us at info@homehub-benfleet.co.uk \ud83d\udc9a';

    // The reference on the Payment Link itself doesn't carry through to the
    // actual payment automatically — set it on payment_intent_data too, so
    // the quote ref shows directly on the Description column in Stripe's
    // Payments dashboard and in the reconciliation/webhook data, not just
    // buried on the Payment Link object.
    const paymentDescription = quoteRef ? (productName + ' \u2014 ' + quoteRef) : productName;

    const params = new URLSearchParams();
    params.append('line_items[0][price_data][currency]', 'gbp');
    params.append('line_items[0][price_data][product_data][name]', productName);
    params.append('line_items[0][price_data][unit_amount]', String(amountPence));
    params.append('line_items[0][quantity]', '1');
    params.append('after_completion[type]', 'hosted_confirmation');
    params.append('after_completion[hosted_confirmation][custom_message]', thankYouMessage);
    if (quoteRef) {
      params.append('metadata[quote_ref]', String(quoteRef));
      params.append('payment_intent_data[description]', paymentDescription.slice(0, 250));
      params.append('payment_intent_data[metadata][quote_ref]', String(quoteRef));
    }

    const response = await fetch('https://api.stripe.com/v1/payment_links', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + secretKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await response.json();
    if (!response.ok) {
      res.status(502).json({ error: (data.error && data.error.message) || 'Stripe could not create the payment link' });
      return;
    }

    let url = data.url;
    if (contactEmail && url) {
      url += (url.indexOf('?') > -1 ? '&' : '?') + 'prefilled_email=' + encodeURIComponent(contactEmail);
    }

    res.status(200).json({ url: url, payment_link_id: data.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
