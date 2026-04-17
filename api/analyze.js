// api/analyze.js — Vercel 서버리스 함수 (CORS 우회 프록시)
// GitHub 저장소 루트에 api 폴더를 만들고 이 파일을 넣어주세요.

export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { apiKey, prompt } = req.body;

  // 환경변수 우선, 없으면 프론트에서 전달한 키 사용
  const key = process.env.ANTHROPIC_API_KEY || apiKey;

  if (!key) {
    return res.status(400).json({ error: 'API 키가 없습니다. Vercel 환경변수 ANTHROPIC_API_KEY를 설정하거나 앱에서 키를 입력해 주세요.' });
  }

  if (!prompt) {
    return res.status(400).json({ error: '분석 내용이 없습니다.' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || `Anthropic API 오류 (${response.status})`,
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Anthropic API error:', error);
    return res.status(500).json({ error: error.message || '서버 오류가 발생했습니다.' });
  }
}
