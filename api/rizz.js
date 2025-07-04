export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests allowed' });
  }

  const { imageUrl } = req.body;
  const apiKey = process.env.GOOGLE_CLOUD_API_KEY;

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { source: { imageUri: imageUrl } },
            features: [{ type: 'LABEL_DETECTION', maxResults: 5 }]
          }
        ]
      })
    }
  );

  const data = await response.json();

  const mockResponse = [
    "Option 1: Smooth opener deploy test",
    "Option 2: Witty compliment",
    "Option 3: Cheeky tease",
    "Option 4: Confident closer"
  ];

  return res.status(200).json({ results: mockResponse });
}
