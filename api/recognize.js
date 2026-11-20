// api/recognize.js — 통장·카드 캡처 이미지를 읽어 거래 내역 JSON으로 돌려주는 Vercel 서버리스 함수
// 필요한 환경변수 (Vercel → Settings → Environment Variables)
//   ANTHROPIC_API_KEY  : Anthropic API 키 (필수, 없으면 앱 설정의 개인 키를 사용)
//   APP_PASSCODE       : (선택) 설정하면 앱 설정에 같은 값을 넣은 기기만 인식 기능을 쓸 수 있음
//   RECOGNIZE_MODEL    : (선택) 기본 claude-sonnet-5-5

const BANK_CATS = ['급여', '카드대금', '본인이체', '투자·증권', '적금·저축', '대출·이자', '세금', '기타'];
const CARD_CATS = ['외식·카페', '마트·생활', '쇼핑', '교통·차량', '의료', '통신·구독', '보험', '세금', '기타'];

function buildPrompt(today, n) {
  return [
    '한국 은행·카드 앱의 화면 캡처에서 거래 내역을 읽어 JSON으로 옮기세요.',
    `오늘 날짜는 ${today}입니다. 화면에 연도가 없으면 오늘 기준으로 정하고, 오늘보다 미래가 되면 전년도로 적으세요.`,
    n > 1 ? `이미지 ${n}장은 한 화면을 위에서 아래로 자른 조각이고 경계가 조금 겹칩니다. 겹친 거래는 한 번만 적으세요.` : '이미지는 한 장입니다.',
    '화면 종류(screen): "bank" = 은행 계좌 거래내역(입출금과 거래 후 잔액), "card" = 카드 이용내역이나 토스 같은 소비내역, "other" = 그 밖의 화면.',
    '우리은행 "우리 SUPER주거래 통장"은 마이너스 통장이라 잔액이 -로 표시됩니다. 잔액의 - 부호를 빠뜨리지 마세요.',
    '규칙:',
    '1. 보이는 거래를 화면의 위에서 아래 순서 그대로 items에 넣으세요.',
    '2. amount는 숫자만(쉼표·원 제외). 은행: 입금 +, 출금 -. 카드: 결제 +, 취소·환불 -.',
    '3. balance는 거래 후 잔액이 보이면 부호 포함 숫자, 없으면 null.',
    '4. date는 YYYY-MM-DD. "11월 20일" 같은 날짜 머리글을 그 아래 거래에 적용하세요. time은 "HH:MM" 또는 null.',
    '5. card(카드 화면만): 발급사로 정규화해 농협(NH, 올바른SAFE 등) | 롯데(KT DC PLUS, SKYPASS 등) | 신한(네이버페이 등) | 삼성 | 현대(코스트코 등) | 국민(KB) | 기타. 은행 화면이면 null.',
    '   은행 화면의 "롯데카드(주)", "KB카드출금", "삼성카드" 같은 줄은 카드값 출금입니다. card는 null, category는 카드대금.',
    `6. category: bank는 ${BANK_CATS.join(', ')} 중 하나. card는 ${CARD_CATS.join(', ')} 중 하나.`,
    '7. desc는 화면에 보이는 거래처·적요를 그대로 짧게.',
    '8. 숫자를 확실히 읽을 수 없는 거래는 추측하지 말고 빼고 notes에 적으세요. 화면 경계에서 잘린 거래도 빼세요.',
    'account(bank만): 계좌 은행 "우리" | "농협" | "신한" | "기타". screen_balance: 화면 위쪽 등에 현재 잔액이 크게 보이면 그 숫자, 없으면 null.',
    'JSON 하나만 답하세요. 설명 문장이나 코드 블록 표시는 쓰지 마세요. 예:',
    '{"screen":"bank","account":"우리","screen_balance":null,"items":[{"date":"2026-11-20","time":"08:15","desc":"배형우","amount":10531209,"balance":-41505973,"card":null,"category":"본인이체"}],"notes":""}',
  ].join('\n');
}

function parseJson(text) {
  const t = String(text || '').trim();
  try { return JSON.parse(t); } catch (e) { /* fall through */ }
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) { try { return JSON.parse(fence[1]); } catch (e) { /* fall through */ } }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { /* fall through */ } }
  return null;
}

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 지원합니다.' });

  const pass = process.env.APP_PASSCODE;
  if (pass && req.headers['x-app-passcode'] !== pass) {
    return res.status(401).json({ error: '인식 암호가 맞지 않습니다. 앱 설정에서 인식 암호를 확인하세요.', code: 'passcode' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const images = Array.isArray(body.images) ? body.images.slice(0, 6) : [];
  const today = /^\d{4}-\d{2}-\d{2}$/.test(body.today || '') ? body.today : new Date().toISOString().slice(0, 10);
  const key = process.env.ANTHROPIC_API_KEY || req.headers['x-user-api-key'];
  if (!key) return res.status(400).json({ error: 'API 키가 없습니다. Vercel 환경변수 ANTHROPIC_API_KEY를 설정하거나 앱 설정에 개인 키를 넣어주세요.', code: 'nokey' });
  if (!images.length) return res.status(400).json({ error: '이미지가 없습니다.' });

  const content = images.map((b64) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: String(b64).replace(/^data:image\/\w+;base64,/, '') } }));
  content.push({ type: 'text', text: buildPrompt(today, images.length) });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: process.env.RECOGNIZE_MODEL || 'claude-sonnet-5-5', max_tokens: 4000, messages: [{ role: 'user', content }] }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: (data.error && data.error.message) || `Anthropic API 오류 (${r.status})` });
    const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
    const result = parseJson(text);
    if (!result) return res.status(502).json({ error: '인식 결과를 해석하지 못했습니다. 다시 시도해 주세요.', raw: text.slice(0, 500) });
    return res.status(200).json({ result, model: data.model, usage: data.usage });
  } catch (e) {
    return res.status(500).json({ error: e.message || '서버 오류가 발생했습니다.' });
  }
}
