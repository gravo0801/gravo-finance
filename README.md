# Gravo Finance — 마통 관리

우리은행 마이너스통장 감축을 위한 개인 앱입니다.

- 통장·카드 캡처를 붙여넣으면 `/api/recognize`가 Anthropic API로 거래를 읽어 옵니다.
- 통장 화면은 "이전 잔액 ± 거래 = 다음 잔액"으로 검증하고, 모두 맞으면 바로 반영합니다.
- 데이터는 Firebase Firestore `gravo_finance_v2/<동기화 코드>__mt` 문서 하나에 저장되어 모든 기기에서 같습니다.

## Vercel 환경변수
| 이름 | 필수 | 설명 |
|---|---|---|
| `ANTHROPIC_API_KEY` | 예 | 캡처 인식용 키 |
| `APP_PASSCODE` | 권장 | 설정하면 앱 설정에 같은 암호를 넣은 기기만 인식 사용 |
| `RECOGNIZE_MODEL` | 아니오 | 기본 `claude-sonnet-5-5` |

빌드 과정 없이 정적 파일(`index.html`, `app.js`, `seed.js`, `style.css`)과 서버리스 함수 하나로 동작합니다.
