import OpenAI from 'openai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests allowed' });
  }

  // API Key Authorization
  const authHeader = req.headers['authorization'];
  const expectedApiKey = process.env.RIZZASSIST_API_KEY;
  if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== expectedApiKey) {
    return res.status(403).json({ error: 'Forbidden: Invalid API key' });
  }

  // Parse and validate request body
  const { image_base64, vibe, conversation_history, language } = req.body;
  const allowedVibes = ['formal', 'casual', 'flirty', 'dirty', 'over-the-top'];
  if (
    !image_base64 ||
    typeof image_base64 !== 'string' ||
    !vibe ||
    !allowedVibes.includes(vibe) ||
    typeof conversation_history !== 'string' ||
    !language ||
    typeof language !== 'string'
  ) {
    return res.status(400).json({ error: 'Bad Request: Missing or invalid input' });
  }

  const apiKey = process.env.GOOGLE_CLOUD_API_KEY;

  // Support both data URL and raw base64 string
  let base64Data;
  if (image_base64.startsWith('data:image/')) {
    const base64Match = image_base64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!base64Match) {
      return res.status(400).json({ error: 'Bad Request: Invalid image_base64 format' });
    }
    base64Data = base64Match[2];
  } else {
    base64Data = image_base64;
  }

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64Data },
            features: [{ type: 'TEXT_DETECTION' }, { type: 'LABEL_DETECTION', maxResults: 5 }]
          }
        ]
      })
    }
  );

  const data = await response.json();
  const fullText = data.responses?.[0]?.fullTextAnnotation?.text || '';
  const labels = data.responses?.[0]?.labelAnnotations?.map(l => l.description) || [];

  const mockResponse = [
    "Option 1: Smooth opener deploy test",
    "Option 2: Witty compliment",
    "Option 3: Cheeky tease",
    "Option 4: Confident closer"
  ];

  const prompt = `\nYou are a witty assistant helping someone come up with the perfect reply to a visual post or story.\n\nTone: ${vibe}\nLanguage: ${language}\n\n${fullText ? `Text from screenshot:\n"${fullText}"\n` : ''}${labels.length ? `Image context: ${labels.join(', ')}\n` : ''}\nGenerate 5 short, engaging, and creative replies that match the tone and visual impression.\nAvoid repeating the same structure, and make them sound like a real person.\n\nRespond ONLY with a JSON array of 5 strings, nothing else.\n`;

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: 'OpenAI API key is not set in the environment (OPENAI_API_KEY).'
    });
  }

  let suggestions = mockResponse;
  let openaiError = null;
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const openaiData = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 256,
      temperature: 0.9
    });
    if (openaiData.choices && openaiData.choices[0] && openaiData.choices[0].message && openaiData.choices[0].message.content) {
      const raw = openaiData.choices[0].message.content.trim();
      
      // console.log('Raw OpenAI response:', raw);
      
      try {
        let cleaned = raw
          .replace(/^\s*```(?:json)?\s*/i, '') // Remove leading ``` or ```json
          .replace(/\s*```\s*$/, '');          // Remove trailing ```
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed) && parsed.length === 5 && parsed.every(s => typeof s === 'string')) {
          suggestions = parsed;
        } else {
          openaiError = 'OpenAI did not return a valid array of 5 strings.';
        }
      } catch (e) {
        openaiError = 'Failed to parse OpenAI response as JSON.';
      }
    } else {
      openaiError = openaiData;
    }
  } catch (err) {
    openaiError = err.message || 'OpenAI API error';
  }

  // console.log('Suggestions sent:', suggestions);
  return res.status(200).json({ suggestions, fullText, labels, prompt, openaiError });
}
