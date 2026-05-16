/**
 * Vercel Serverless Function: /api/chat
 * Proxies requests to Groq API server-side so the API key is never exposed in frontend code.
 * The GROQ_API_KEY environment variable is set only in Vercel's dashboard.
 */
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing GROQ_API_KEY environment variable. Please add it in the Vercel dashboard.' });
  }

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(req.body),
    });

    const data = await groqRes.json();

    if (!groqRes.ok) {
      return res.status(groqRes.status).json(data);
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('Groq proxy error:', err);
    return res.status(500).json({ error: 'Internal server error while contacting Groq.' });
  }
}
