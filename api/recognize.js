// api/recognize.js — 통장·카드 캡처 이미지를 읽어 거래 내역 JSON으로 돌려주는 Vercel 서버리스 함수
// 필요한 환경변수 (Vercel → Settings → Environment Variables)
//   ANTHROPIC_API_KEY  : Anthropic API 키 (필수, 없으면 앱 설정의 개인 키를 사용)
//   APP_PASSCODE       : (선택) 설정하면 앱 설정에 같은 값을 넣은 기기만 인식 기능을 쓸 수 있음
//   RECOGNIZE_MODEL    : (선택) 기본 claude-sonnet-5-5

const BANK_CATS = ['급여', '카드대금', '본인이체', '투자·증권', '적금·저축', '대출·이자', '세금', '기타'];
const CARD_CATS = ['외식·카페', '마트·생활', '쇼핑', '교통·차량', '의료', '통신·구독', '보험', '세금', '기타'];

function buildPrompt(today, n, hint, product) {
  return [
    '한국 은행·카드·토스 앱의 화면 캡처에서 거래 내역을 읽어 JSON으로 옮기세요.',
    `오늘 날짜는 ${today}입니다. 화면에 연도가 없으면 오늘 기준으로 정하고, 오늘보다 미래가 되면 전년도로 적으세요.`,
    n > 1 ? `이미지 ${n}장은 한 화면을 위에서 아래로 자른 조각이고 경계가 조금 겹칩니다. 겹친 거래는 한 번만 적으세요.` : '이미지는 한 장입니다.',
    hint ? `사용자가 이 캡처를 "${hint}카드" 내역이라고 지정했습니다.${product ? ` 카드 상품은 "${product}"입니다.` : ''}` : '',
    '',
    '[화면 종류 screen]',
    '"bank" = 은행 계좌 거래내역(입출금과 거래 후 잔액). "card" = 카드사 앱의 이용내역(카드 결제만). "mixed" = 토스 "전체" 탭처럼 카드·간편결제, 계좌 이체, 송금, 입금이 섞인 목록. "other" = 그 밖.',
    '우리은행 "우리 SUPER주거래 통장"은 마이너스 통장이라 잔액이 -로 표시됩니다. 잔액의 - 부호를 빠뜨리지 마세요.',
    '',
    '[읽는 순서]',
    '1. 먼저 날짜를 찾으세요: 날짜 머리글("20일 금요일", "11.20(금)", "11월 20일"), 행 안의 날짜, 상단 주간 달력에서 선택(강조)된 날짜.',
    '2. period(from=가장 이른 날짜, to=가장 늦은 날짜)를 정하세요.',
    '3. 그다음 거래 행을 위에서 아래 순서대로 읽으세요.',
    '',
    '[날짜 규칙]',
    '- 날짜 머리글은 그 아래 거래들에 적용합니다.',
    '- 목록 맨 위 거래들 위에 머리글이 잘려 안 보이면: 상단 달력에서 선택된 날짜가 있고 그 날짜가 첫 머리글보다 하루 이상 뒤면 그 날짜를 쓰세요. 근거가 없으면 date를 null로 두세요. 추측하지 마세요.',
    '- 화면 위·아래 경계에서 잘려 금액이 안 보이는 행은 빼세요.',
    '',
    '[금액 규칙]',
    '- amount는 숫자만(쉼표·원 제외).',
    '- bank 화면: 입금 +, 출금 -.',
    '- card·mixed 화면의 결제(kind=spend)는 +, 결제 취소·환불(kind=refund)은 -. 토스처럼 결제가 -로 표시돼도 +로 바꿔 적으세요.',
    '- card·mixed 화면의 그 밖의 행(kind가 spend·refund가 아님)은 통장처럼 들어온 돈 +, 나간 돈 -.',
    '- 취소선이 그어진 원래 가격과 실제 결제액이 함께 보이면 실제 결제액(굵고 큰 금액)을 쓰세요.',
    '- balance는 거래 후 잔액이 보이면 부호 포함 숫자, 없으면 null.',
    '',
    '[행 종류 kind] (card·mixed 화면만, bank는 null)',
    '"spend" = 카드·간편결제(네이버페이·카카오페이·토스페이 등) 결제. "refund" = 결제 취소·환불. "own_transfer" = 내 계좌끼리 이체("내 계좌 이체", "신한 → 우리"). "transfer" = 다른 사람에게 송금하거나 받은 돈. "income" = 급여·이자·증권 매매대금 정산 등 입금. "other" = 그 밖(1원송금, 수수료 등).',
    '',
    '[카드사 card] (kind가 spend·refund인 행만, 나머지는 null)',
    '- 화면에서 카드사가 보일 때만: 농협(NH, 올바른SAFE) | 롯데(KT DC PLUS, SKYPASS, LOCA) | 신한(신한카드, Deep, 네이버페이 신한카드) | 삼성 | 현대(코스트코 현대카드) | 국민(KB) | 기타.',
    '- "네이버페이", "카카오페이"처럼 결제 수단만 보이고 카드사가 안 보이면 "기타".',
    '- 화면 전체가 한 카드사 앱이면 top-level card에 그 카드사를 적으세요. 아니면 null.',
    '- 같은 카드사에 카드가 여러 장입니다. 화면에 카드 상품명이나 카드 이름이 보이면 각 행(또는 화면 전체)의 product에 보이는 그대로 짧게 적으세요. 롯데: KT DC PLUS, SKYPASS / 삼성: THE Platinum, MILEAGE PLATINUM(스카이패스) / 현대: 코스트코 리워드, 대한항공 070. 보이지 않으면 null.',
    '- 은행 화면의 "롯데카드(주)", "KB카드출금", "삼성카드" 같은 줄은 카드값 출금입니다. card는 null, category는 카드대금.',
    '',
    `[분류 category] bank: ${BANK_CATS.join(', ')} 중 하나. card·mixed: ${CARD_CATS.join(', ')} 중 하나(이체·입금 행은 기타).`,
    '[desc] 화면에 보이는 가맹점·거래처·적요를 그대로 짧게. 결제 수단(네이버페이 등)이 따로 보이면 method에 적으세요.',
    '',
    '[합계 검증용]',
    '- day_totals: 날짜별 합계가 화면에 보이면(예: 토스 주간 달력 아래 +970,561 / -328,968) [{"date":"YYYY-MM-DD","in":들어온 합계(양수),"out":나간 합계(양수)}]. 없으면 [].',
    '- list_total: 화면에 보이는 결제 목록 전체의 이용금액 합계가 따로 표시돼 있고 그 기간이 목록과 같으면 숫자, 아니면 null.',
    '- screen_balance: 화면 위쪽에 계좌 현재 잔액이 크게 보이면 그 숫자, 없으면 null.',
    '',
    '숫자를 확실히 읽을 수 없는 거래는 추측하지 말고 빼고 notes에 적으세요.',
    'account(bank만): "우리" | "농협" | "신한" | "기타". 신한은행 FNA 통장 화면은 "신한"입니다.',
    'JSON 하나만 답하세요. 설명 문장이나 코드 블록 표시는 쓰지 마세요. 키 순서는 screen, account, card, period, day_totals, list_total, screen_balance, items, notes 입니다. 예:',
    '{"screen":"mixed","account":null,"card":null,"period":{"from":"2026-11-19","to":"2026-11-20"},"day_totals":[{"date":"2026-11-20","in":7241274,"out":793510}],"list_total":null,"screen_balance":null,"items":[{"date":"2026-11-20","time":null,"desc":"박준뷰티랩","method":"네이버페이","amount":4180,"balance":null,"card":"기타","product":null,"kind":"spend","category":"쇼핑"},{"date":"2026-11-20","time":null,"desc":"내 계좌 이체 신한 → 우리","method":null,"amount":-250000,"balance":null,"card":null,"product":null,"kind":"own_transfer","category":"기타"}],"notes":""}',
  ].filter((l) => l !== null).join('\n');
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
  const hint = typeof body.cardHint === 'string' && /^(농협|롯데|신한|삼성|현대|국민)$/.test(body.cardHint) ? body.cardHint : '';
  const product = typeof body.cardProduct === 'string' ? body.cardProduct.replace(/[^\p{L}\p{N} &()·+\-]/gu, '').slice(0, 40) : '';
  content.push({ type: 'text', text: buildPrompt(today, images.length, hint, product) });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: process.env.RECOGNIZE_MODEL || 'claude-sonnet-5-5', max_tokens: 6000, messages: [{ role: 'user', content }] }),
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
