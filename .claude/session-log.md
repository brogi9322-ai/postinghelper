# 세션 로그

> 사용자의 프롬프트와 그에 따른 Claude의 작업을 기록한다.
> 새 터미널에서도 이전 맥락을 파악할 수 있도록 항상 업데이트한다.
> 형식: `## [날짜] [순서] 프롬프트 요약` → 작업 내용

---

## 2026-03-18

---

### [01] "Implement the following plan: PostingHelper 프로젝트 초기 세팅 계획"
**작업**: Next.js 15 + TypeScript + Tailwind CSS v4 프로젝트 초기 세팅
- `npx create-next-app` 실행
- `@anthropic-ai/sdk` 설치
- `lib/claude.ts` — Anthropic 클라이언트 싱글턴 생성
- `app/api/generate/route.ts` — 기본 Claude API 호출 엔드포인트
- `app/page.tsx` — 블로그 주제 입력 기본 UI

---

### [02] "에이전트랑 스킬도 들어줘야지" / "지침같은거야" / ".claude 폴더 만들어서 에이전트 확인하고 코딩하는거"
**작업**: Claude Code 에이전트 지침 파일 세팅
- `CLAUDE.md` 생성 — 프로젝트 전체 지침
- `.claude/agents/blog-writer.md`, `ui-builder.md`, `api-designer.md` 생성
- `/api/generate` 에이전트 루프 + `generate_outline`, `generate_tags` tool 추가
- UI에 태그 표시 추가

---

### [03] "수정한 내용 기록 파일, 스프린트 진행 상황 체크 파일도 필요해"
**작업**: 작업 추적 파일 생성
- `.claude/sprints.md` 생성 — 스프린트 현황 및 백로그
- `.claude/changelog.md` 생성 — 변경 이력 기록
- `CLAUDE.md`에 작업 완료 후 두 파일 업데이트 규칙 추가

---

### [04] "세팅부터 하자. 스프린트 단위로 진행, 기억을 파일로 정리해 터미널 새로 열어도 이전 내용 파악되게"
**작업**: 프로젝트 전체 계획 수립 + 메모리 시스템 구축
- `.claude/prd.md` 생성 — 전체 요구사항 문서
- `.claude/sprints.md` 전면 개편 — Sprint 1~8 계획
- `CLAUDE.md` 전면 개편 — 새 아키텍처 반영
- 메모리 파일 생성: `memory/user_profile.md`, `project_context.md`, `feedback.md`

---

### [05] "메모리 파일들은 없니?" / "지침에 꼭 넣어. 메모리 등 기록은 필수"
**작업**: 메모리 업데이트 규칙 강화
- `CLAUDE.md`에 작업 완료 후 반드시 3개 파일 업데이트 규칙 추가
  (sprints.md + changelog.md + memory/)
- `memory/feedback.md`에 기록 필수 규칙 저장

---

### [06] "블로그 포스팅 도우미 만들고 싶어. 플레이스, 쇼핑, 리뷰, 숙소, 여행지, 이슈 종류별 포스팅"
**작업**: 서비스 방향 확정 + PRD 작성
- 포스팅 종류 6개 확정 (쇼핑 1순위, 플레이스 2순위)
- `.claude/prd.md` 전면 작성

---

### [07] "크롤링이 필요한데 웹으로 하기 어려워?" / "실제 서비스화 해야돼"
**작업**: 아키텍처 결정
- 서버사이드 크롤링 검토 → 네이버 차단 문제 확인
- **크롬 익스텐션 content script 방식으로 확정** (무료, 차단 없음)
- `memory/feedback.md`에 서버사이드 크롤링 금지 규칙 저장

---

### [08] "포스팅은 직접 사용자 네이버 블로그에서 한 글자씩 입력, 사진도 번갈아 넣어야돼"
**작업**: 자동 포스팅 방식 확정 + Sprint 계획 전면 개편
- 블로그 자동 입력 방식: 한 글자씩 타이핑 + 이미지 교차 삽입
- Sprint 1~8 전체 계획 재수립
- `.claude/agents/extension-builder.md` 생성

---

### [09] "시작해줘. url도 줄게. https://naver.me/FTdSNwF3 (제휴마케팅 링크)"
**작업**: Sprint 2 + Sprint 3 구현
- **Sprint 2**: 크롬 익스텐션 전체 구조 생성
  - `extension/manifest.json`, `popup/`, `background/`, `content/` 폴더
  - `types/index.ts` 공통 타입 정의
  - `/api/shopping`, `/api/place`, `/api/images/save` 라우트 뼈대
  - Vercel Blob 설치
- **Sprint 3**: 스마트스토어 데이터 수집
  - `extension/content/smartstore.js` 전면 구현
    - 상품명/가격/판매자/배송 추출 (다중 선택자 fallback)
    - 대표 이미지 + 상세페이지 이미지(iframe 포함) 수집
    - 리뷰 탭 클릭 → 최신 3페이지 수집
    - MutationObserver + scroll lazy load 대기
  - brand.naver.com, brandconnect.naver.com manifest 추가

---

### [10] "수정할 때마다 테스트 진행하고있어? 검증 무조건 해야돼. 오류, 보안, 해킹 포함"
**작업**: 전체 보안 감사 + 취약점 수정
- **SSRF 차단** (`/api/images/save`): localhost/내부IP/AWS메타데이터 차단, 네이버만 허용
- **Prompt Injection 방지** (`/api/shopping`, `/api/place`): 길이 제한 + JSON 구조화
- **메시지 검증**: sender.id 검증, 허용된 타입 화이트리스트
- **URL 검증 강화**: HTTPS 전용, 네이버 도메인만 허용
- **이미지 URL 검증**: 신뢰 도메인 whitelist, HTTPS 강제
- **MIME 타입 검증**: 허용된 이미지 타입만 저장
- **파일 크기 제한**: 10MB 초과 차단
- **DoS 방지**: 이미지 최대 50개, 중복 실행 방지 플래그
- **XSS 방지**: textContent 강제, innerHTML 금지
- 보안 테스트 14개 추가 (`__tests__/api-images-save.test.ts`)

---

### [11] "스프린트 완료되면 git 커밋하고 푸시 머지 해줘. 커밋 메시지 꼼꼼하게"
**작업**: Git 워크플로우 확립 + CI/CD 세팅
- GitHub Actions CI 구성 (typecheck + lint + test)
- Jest + ts-jest 설정 (`jest.config.js`)
- `jest.config.ts` → `jest.config.js` 변환 (CI ts-node 없는 환경 대응)
- PR #1 생성 → CI 통과 → main 머지

---

### [12] "제휴 링크 지원 추가"
**작업**: 제휴 마케팅 링크 지원
- `types/index.ts` — `ShoppingData`에 `affiliateUrl` 필드 추가
- 팝업에 제휴 링크 입력창 추가 (쇼핑 감지 시 표시)
- `smartstore.js`에서 `affiliateUrl` 수집 데이터에 포함
- `/api/shopping` 프롬프트에 제휴 링크 삽입 지시 추가

---

### [13] "시작해" (Sprint 4)
**작업**: Sprint 4 — 쇼핑 포스팅 생성 에이전트 루프 + 팝업 미리보기
- `app/api/shopping/route.ts` — 에이전트 루프 완성
  - `plan_structure` tool: Claude가 글 구조(섹션 순서/이미지 인덱스) 직접 결정
  - `generate_tags` tool: SEO 태그 7~12개 생성
  - `sanitizeData()`: Prompt Injection 방지
  - MAX_LOOPS=6 무한루프 방지
- `extension/popup/popup.html` — 미리보기 영역 HTML 추가
- `extension/popup/popup.css` — 미리보기 스타일 추가
- `extension/popup/popup.js` — `showPreview()` 구현 (XSS 방지)
- `__tests__/api-shopping.test.ts` — 에이전트 루프 3단계 모킹 테스트
- typecheck + 14개 테스트 통과 → PR #2 생성

---

### [14] "미리보기가 뭐야?"
**답변**: 포스팅 생성 후 블로그에 올리기 전에 팝업 안에서 결과를 미리 확인하는 기능.
- 제목, 태그(#뱃지), 섹션(텍스트 200자 미리보기 / 이미지 위치 표시)
- "펼치기/접기" 토글로 열고 닫을 수 있음

---

### [17] "ai api키 없으면 수집한내용으로 글 채우기, 키 있으면 글 만들어서 채우기 이렇게 분기처리해야지"
**작업**: service-worker.js에 API 키 유무 분기 처리
- Claude API 호출 성공 → Claude가 쓴 포스팅 사용
- 실패(네트워크 오류/API 키 없음) → `formatRawPosting()`으로 수집 데이터 직접 포맷
- `formatRawPosting()`: 상품명/설명/가격/배송/리뷰/이미지/제휴링크 → 섹션 조립
- 이전에 추가했던 "데이터 확인" 버튼 제거 (팝업 단순화)
- **변경 파일**: `extension/background/service-worker.js`, `extension/popup/popup.html`, `extension/popup/popup.css`, `extension/popup/popup.js`

### [16] "자 이제 다음 작업 진행하자" + "스마트원 사용할거야. 이미지 삽입은 무조건 파일 업로드로 해야돼."
**작업**: Sprint 5 — 네이버 블로그 스마트에디터 ONE 자동 포스팅
- `extension/content/naverblog.js` 전면 구현
  - `waitForEditorDocument()`: mainFrame iframe 대응 + 20초 타임아웃
  - `typeText()`: 글자 한 자씩 20~60ms 랜덤 딜레이
  - `insertImage()`: fetch → MIME 검증 → DataTransfer drop+paste 이중 시도
  - `setTitle()`, `setTags()`: 다중 선택자 fallback
  - `sender.tab` 체크로 다른 content script 메시지 차단
- `service-worker.js`: DO_POSTING 전송, isPosting 플래그 개선, 진행 상황 포워딩
- `manifest.json`: Vercel Blob 도메인 host_permissions 추가
- typecheck + 14개 테스트 통과 → PR 생성 예정

### [15] "내가 입력했던 프롬프트랑 작업을 정리한 파일 만들어줘. 프롬프트 입력할 때마다 기록해줘"
**작업**: 이 파일(`session-log.md`) 생성
- 이전 대화 전체 내용을 소급하여 [01]~[14] 기록
- 이후 매 프롬프트마다 이 파일에 항목 추가

---

### [18] "테스트해보고 괜찮으면 배포할게."
**작업**: 배포 준비 + Sprint 8 진행
- PR #2(sprint/4), PR #3(sprint/5) → main 머지 완료 (CI 통과)
- `lib/cors.ts` 생성 — 크롬 익스텐션 CORS 허용
- 모든 API 라우트에 OPTIONS 핸들러 + `withCors()` 적용
- `manifest.json` — `notifications` 권한 추가
- `service-worker.js` — chrome.storage.local 기반 상태 관리 전환, 팝업 닫혀도 진행 유지
- `popup.js` — storage.onChanged 리스너로 실시간 상태 복원
- `smartstore.js` — 데이터 수집 중 진행 상황 메시지 추가 (32%~50%)
- `service-worker.js` — sendMessageToTab() 최대 5회 재시도 로직

---

### [19] "확장 프로그램을 로드하지 못함 / Could not load icon 'icons/icon16.png'"
**작업**: 아이콘 파일 누락 수정
- Python으로 16/48/128px 파란 원 PNG 아이콘 3개 생성
- `extension/icons/` 폴더에 저장
- 익스텐션 정상 로드 확인

---

### [20] "데이터 수집 실패가 떴어" / 상품 페이지 멈춤 현상
**작업**: smartstore.js :contains() 버그 수정
- `clickReviewTab()`에서 `:contains()` CSS 선택자 → `DOMException` 유발
- 텍스트 기반 탭 탐지 방식으로 교체
- 상품 하단까지 스크롤 후 멈춤 현상 해결

---

### [21] "난 그냥 제휴마케팅 url 입력만 하면 알아서 됐으면 좋겠어"
**작업**: UX 전면 개편 — 제휴 URL 입력만으로 전체 흐름 자동화
- `service-worker.js` — `handleGenerateFromUrl()`: URL 받으면 탭 열기→수집→생성→저장 자동 처리
- 로그인 감지: `nid.naver.com` 리다이렉트 → 로그인 완료 후 자동 진행
- `popup.html/js` — 페이지 감지 로직 제거, 제휴 URL 입력창만 남김
- `formatRawPosting()` — API 키 없을 때 수집 데이터로 포스팅 직접 생성 (폴백)

---

### [23] "직접 해줘" (Vercel 배포)
**작업**: Sprint 8 — Vercel 배포 완료
- `npx vercel --yes`로 배포: https://postinghelper.vercel.app
- `BLOB_READ_WRITE_TOKEN` Vercel 대시보드에서 환경변수 설정
- API 엔드포인트 curl 테스트: CORS ✅, 폴백 동작 ✅

---

### [24] "로그인 안되어있으면 로그인 창 띄워줘"
**작업**: 데이터 수집 단계 로그인 감지 추가
- `handleGenerateFromUrl()`에 `nid.naver.com` 리다이렉트 감지 추가
- 로그인 대기 → 완료 후 원래 상품 URL 재이동
- 기존에는 `handleStartPosting()`에만 로그인 체크가 있었음
- typecheck + 14개 테스트 통과 → 커밋 + 푸시

---

### [26] "익스텐션 사이트에서 해당 프로그램에 오류 버튼 있는데 이게 뭐야?" / CORS 에러
**원인**: 에러 응답(400/500)에 CORS 헤더 누락 + Vercel 구 버전 배포
**작업**:
- `app/api/shopping/route.ts` — 모든 에러 응답에 `withCors()` 추가
- `app/api/place/route.ts` — 모든 에러 응답에 `withCors()` 추가
- Vercel 프로덕션 재배포 (`npx vercel --prod --yes`)
- typecheck + 14개 테스트 통과 → 커밋 + 푸시
- **변경 파일**: `app/api/shopping/route.ts`, `app/api/place/route.ts`

---

### [25] "블로그에 올리기 누르면 죄송합니다. 유효하지 않은 요청입니다. 화면이 출력 돼."
**작업**: PostWriteForm.naver blogId 누락 버그 수정
- 원인: `https://blog.naver.com/PostWriteForm.naver` 접근 시 `blogId` 파라미터 없으면 Naver가 "유효하지 않은 요청입니다" 반환
- 수정: `handleStartPosting()` 에서 먼저 `https://blog.naver.com` 홈으로 이동 → `chrome.scripting.executeScript`로 페이지 링크에서 blogId 추출 → `PostWriteForm.naver?blogId=<blogId>` 로 이동
- typecheck + 14개 테스트 통과 → 커밋 + 푸시
- **변경 파일**: `extension/background/service-worker.js`

---

### [22] "Access to fetch ... blocked by CORS policy" / "vercel 계정 만들었어. 보안 최고로 신경써야돼"
**작업**: CORS 수정 + 배포 준비 + 보안 지침 강화
- CORS: `lib/cors.ts` withCors() + OPTIONS 핸들러 적용 (이미 [18]에서 완료)
- 배포 절차 안내:
  1. `sudo chown -R $(whoami) ~/.npm` (npm 권한 수정)
  2. `npm install -g vercel`
  3. `vercel login` (GitHub)
  4. `vercel` 명령어로 배포
  5. Vercel 대시보드에서 환경변수 설정 (`ANTHROPIC_API_KEY`, `BLOB_READ_WRITE_TOKEN`)
- API 키/토큰은 절대 git에 커밋 금지 — Vercel 대시보드 전용
- `memory/feedback.md` — 4개 파일 업데이트 규칙 강화 (절대 빠지면 안 됨)
