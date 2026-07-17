// /api/generate-post.js
// H.O.M.E Hub — Social Media Post Generator (Hub app copy)
//
// Adapted from Heartwood's own /api/generate-post.js. Same voice, same
// three postType handling (session, room, general — volunteer omitted here
// since the Hub app only needs room/session for now). Two additions on top
// of Heartwood's original:
//   1. Every post gets "Honour & Love / H.O.M.E Hub 💚" appended
//      PROGRAMMATICALLY after the AI writes it — not left to the prompt,
//      so it's never accidentally dropped.
//   2. Facebook posts get an explicit instruction to include a few emojis
//      that are genuinely relevant to the content.
//
// Setup needed in Vercel (one-time, done by Coxy in the dashboard):
//   forms project → Settings → Environment Variables → add
//   ANTHROPIC_API_KEY (same value as Heartwood_Socials_Key in home-hub)

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.Heartwood_Socials_Key;
  if (!apiKey) {
    res.status(500).json({ error: 'No API key found — set ANTHROPIC_API_KEY in Vercel environment variables for this project' });
    return;
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const postType = body.postType || 'session';

    const baseVoice = `You write social media posts for H.O.M.E Hub — a heart-led community wellbeing space in Benfleet, Essex (also serving Hadleigh, Thundersley and Canvey Island). Their tagline is "Bringing unity back to the Community." H.O.M.E stands for Helping, Overcoming, Motivating, Exploring — their four guiding virtues, rooted in compassion, connection and the belief that communities thrive when people support one another.

Real language they actually use — draw on this vocabulary and warmth, don't invent a different voice:
- "A free community wellbeing space"
- "Free to attend, no referral needed — just walk through the door"
- "When people are seen, heard, supported and connected, positive change becomes possible"
- "Helping one another with empathy, kindness and compassion"
- "Creating space for reflection, learning, creativity and personal development"
- Warm, sincere, community-first — never corporate, never cold, never salesy

Style rules for social media specifically: keep it SHORT and PUNCHY even though the underlying voice is heart-felt — social media readers scroll fast, so lead with warmth in as few words as possible, not a paragraph of values language. Short sentences. A genuine full stop can be a whole sentence. No hashtag spam, no corporate buzzwords like "synergy" or "leverage," no fake urgency ("don't miss out!!"). It should read like a caring person from the community wrote it, informed by everything above, not like a marketing team.

Do NOT write a sign-off or closing line yourself (no "Honour & Love," no "H.O.M.E Hub," no name at the end) — that gets added afterwards automatically. Just write the body of the post itself.

Always output ONLY valid JSON, no markdown fences, no preamble, in this exact shape:
{"instagram": "...", "whatsapp": "...", "facebook": "..."}

Rules for each:
- instagram: short, punchy, 2-4 short lines, can use 1-2 emojis naturally (not decorative spam), end with 3-5 relevant hashtags on their own line (can include #BringingUnityBackToTheCommunity or #HOMEHub where it fits naturally).
- whatsapp: very short — like a message you'd actually send to a community group. 2-3 sentences max. No hashtags, no emojis needed unless it feels natural.
- facebook: a little warmer and slightly longer than Instagram, 3-5 short sentences, still punchy, no hashtags needed. Include 2-4 emojis that are genuinely relevant to what the post is actually about (e.g. a moon/stars emoji for an astrology session, a leaf for a wellbeing class, a cup for the café) — never generic decoration, never more than a handful, woven naturally into the sentences rather than stacked at the end.

Never invent details not provided.`;

    let systemPrompt, userPrompt;

    if (postType === 'volunteer') {
      const { roleName, roleDescription, timeCommitment, howToApply } = body;
      if (!roleName) { res.status(400).json({ error: 'Role name is required' }); return; }

      systemPrompt = baseVoice + `\n\nThis particular post is a VOLUNTEER CALL-OUT — asking the community for someone to take on a specific role. It should feel like an invitation to belong and contribute, not a job advert. Warmly explain what the role involves and why it matters to the Hub and the people it serves, then invite people to get in touch. Always naturally include how to apply/get in touch if given.`;

      userPrompt = `Write a volunteer recruitment post set for this role:\n\nRole: ${roleName}\nWhat's involved: ${roleDescription || '(not specified — keep it warm and inviting about helping out generally in this role)'}\nTime commitment: ${timeCommitment || '(not specified — do not invent hours, just invite people to ask)'}\nHow to apply / get in touch: ${howToApply || '(not given — invite people to pop into the Hub or message the page)'}`;

    } else if (postType === 'general') {
      const { topic, details, callToAction } = body;
      if (!topic) { res.status(400).json({ error: 'Topic is required' }); return; }

      systemPrompt = baseVoice + `\n\nThis is a GENERAL community update or announcement — not tied to a specific bookable session. It could be news, a thank-you, a reflection, an update on something happening at the Hub, or anything else community-facing. Match the tone and length naturally to what's being said.`;

      userPrompt = `Write a general community post set about this:\n\nTopic: ${topic}\nExtra details: ${details || '(none given — keep it simple and warm)'}\nCall to action / link (if any): ${callToAction || '(none given — no need to force one)'}`;

    } else if (postType === 'group') {
      const { name, facilitatorName, category, whenText, description, isFree, price, ctaLabel } = body;
      if (!name) { res.status(400).json({ error: 'Group name is required' }); return; }

      const priceLine = isFree ? 'This is completely free to attend.' : (price ? `This costs \u00a3${Number(price).toFixed(2)}.` : '');

      systemPrompt = baseVoice + `\n\nThis is one of H.O.M.E Hub's ONGOING COMMUNITY GROUPS or programmes — not a one-off event, something that runs regularly (weekly, drop-in, or similar) and people can just turn up to, or come back to again and again. It should read like a warm invitation to join an existing, welcoming circle of people, not a countdown to a single date. Mention when it runs if given. There's no online booking for these — the call to action below tells you how to phrase the invitation; follow it rather than defaulting to generic "come along" wording if something more specific is given.`;

      userPrompt = `Write a social media post set for this community group:\n\nName: ${name}\nRun by: ${facilitatorName || 'H.O.M.E Hub'}\nCategory: ${category || '(not specified)'}\nWhen: ${whenText || '(not specified — keep it simple, just invite people to ask)'}\nDescription: ${description || '(no extra description given — keep it warm and welcoming)'}\n${priceLine}\nCall to action: ${ctaLabel || 'Just come along, or get in touch first if unsure'}`;

    } else if (postType === 'room') {
      const { roomName, capacity, description, rateInfo, contactMethod } = body;
      if (!roomName) { res.status(400).json({ error: 'Room name is required' }); return; }

      systemPrompt = baseVoice + `\n\nThis is a ROOM HIRE promotion — inviting local practitioners, businesses or community groups to hire a space at the Hub. It should feel like a warm, practical invitation to make use of a lovely, flexible community space, not a corporate venue-hire advert. Mention capacity and rates only if given — never invent numbers. There's no online booking for rooms, so always invite people to get in touch to check availability rather than implying instant booking.`;

      userPrompt = `Write a social media post set inviting people to hire this room:\n\nRoom: ${roomName}\nCapacity: ${capacity || '(not specified — do not invent a number)'}\nDescription: ${description || '(none given — keep it warm and simple)'}\nRates: ${rateInfo || '(not specified — invite people to ask for rates)'}\nHow to enquire: ${contactMethod || 'Get in touch with H.O.M.E Hub'}`;

    } else {
      // 'session' — a bookable session or workshop
      const {
        name, facilitatorName, description, dayLabel, timeLabel,
        isFree, price, bookingUrl, ctaLabel
      } = body;

      if (!name) { res.status(400).json({ error: 'Session name is required' }); return; }

      const priceLine = isFree ? 'This is completely free.' : `This costs \u00a3${Number(price || 0).toFixed(2)}.`;

      systemPrompt = baseVoice + `\n\nAlways naturally include the booking link if one is given. The call to action given below shapes how you should invite people to respond — if it talks about "letting us know you're coming" this is a free, no-pressure RSVP, not a formal booking, so keep it casual; if it mentions a waitlist, be upfront and warm that the session is currently full but people can ask to be added; if it's a standard booking, invite people to book their spot in the usual way. Match your wording to which one it is rather than defaulting to "book now" language regardless.\n\nThe "When" field may already carry real urgency baked in — things like "this Saturday", "tomorrow", or "in 3 weeks' time" rather than a flat date. When it does, actually use that framing naturally rather than restating it as a plain date — e.g. lead with "Coming soon..." or "This Saturday..." for something close, or a calmer "In a few weeks..." for something further off. Don't force it if the When field is a recurring pattern like "Every Wednesday" — that doesn't need urgency framing, just say it plainly.`;

      userPrompt = `Write a social media post set for this session/workshop:\n\nName: ${name}\nFacilitator: ${facilitatorName || 'H.O.M.E Hub'}\nWhen: ${dayLabel || 'See link for dates'}${timeLabel ? ' at ' + timeLabel : ''}\nDescription: ${description || '(no extra description given — keep it inviting and simple)'}\n${priceLine}\nCall to action: ${ctaLabel || "Let us know you're coming"}\nLink: ${bookingUrl || '(no link given — just invite people to get in touch)'}`;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 700,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(502).json({ error: 'Claude API error', detail: errText });
      return;
    }

    const data = await response.json();
    const textBlock = (data.content || []).find(function(b){ return b.type === 'text'; });
    const raw = textBlock ? textBlock.text : '{}';
    const clean = raw.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      res.status(502).json({ error: 'Could not parse Claude response', raw: clean });
      return;
    }

    // Guaranteed sign-off — added here, not left to the prompt, so it's
    // never missing or worded inconsistently.
    const SIGNOFF = '\n\nHonour & Love\nH.O.M.E Hub \uD83D\uDC9A';
    if (parsed.instagram) parsed.instagram = parsed.instagram.trim() + SIGNOFF;
    if (parsed.whatsapp) parsed.whatsapp = parsed.whatsapp.trim() + SIGNOFF;
    if (parsed.facebook) parsed.facebook = parsed.facebook.trim() + SIGNOFF;

    res.status(200).json(parsed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
