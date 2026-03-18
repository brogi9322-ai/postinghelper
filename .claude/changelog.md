# Changelog

> 작업할 때마다 Claude Code가 이 파일을 업데이트한다.
> 형식: `날짜 | 작업 내용 | 변경된 파일`

---

## 2026-03-18

### 프로젝트 초기 세팅
- Next.js 15 + Tailwind CSS v4 + TypeScript 프로젝트 생성
- **변경 파일**: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`

### Claude API 연동
- `lib/claude.ts` — Anthropic 클라이언트 싱글턴 생성
- `app/api/generate/route.ts` — 단순 Claude API 호출 구현
- **변경 파일**: `lib/claude.ts`, `app/api/generate/route.ts`

### 기본 UI 구현
- 블로그 주제 입력, 톤/길이 선택, 결과 표시 UI
- **변경 파일**: `app/page.tsx`, `app/layout.tsx`

### 에이전트 + 스킬 추가
- system prompt (에이전트 지침) 추가
- `generate_outline`, `generate_tags` tool(스킬) 추가
- 에이전트 루프 구현 (tool_use → end_turn)
- UI에 태그 표시 추가
- **변경 파일**: `app/api/generate/route.ts`, `app/page.tsx`

### 프로젝트 컨텍스트 파일 생성
- `CLAUDE.md` — 프로젝트 전체 지침
- `.claude/agents/blog-writer.md`, `ui-builder.md`, `api-designer.md`
- **변경 파일**: `CLAUDE.md`, `.claude/agents/*`

### CI/CD + 테스트 세팅
- GitHub Actions CI (typecheck + lint + test)
- Jest + ts-jest 설정
- `/api/generate` 유닛 테스트 2개
- `npm run test`, `npm run test:ci`, `npm run typecheck` 스크립트 추가
- **변경 파일**: `.github/workflows/ci.yml`, `jest.config.ts`, `jest.setup.ts`, `__tests__/api-generate.test.ts`, `package.json`

### 스프린트 추적 파일 생성
- `.claude/sprints.md` — 스프린트 현황 및 백로그
- `.claude/changelog.md` — 이 파일
- **변경 파일**: `.claude/sprints.md`, `.claude/changelog.md`, `CLAUDE.md`

### 보안 감사 및 전체 취약점 수정
- **SSRF 차단** (`/api/images/save`): localhost, 내부IP, AWS메타데이터 서버 차단, 네이버 도메인만 허용
- **Prompt Injection 방지** (`/api/shopping`, `/api/place`): 입력 데이터 길이 제한 + JSON 구조화 전달
- **메시지 검증** (service-worker, popup): sender.id 검증, 허용된 타입 화이트리스트
- **URL 검증 강화** (popup, smartstore.js): HTTPS 전용, 네이버 도메인만 허용
- **이미지 URL 검증** (smartstore.js): 신뢰 도메인 whitelist, HTTPS 강제
- **MIME 타입 검증** (images/save): 허용된 이미지 타입만 Blob 저장
- **파일 크기 제한** (images/save): 10MB 초과 차단
- **DoS 방지**: 이미지 최대 50개, 포스팅 중복 실행 방지 플래그
- **XSS 방지** (popup): textContent 사용 강제, innerHTML 금지
- **JSON 파싱 강화** (shopping/route): 배열 범위 검증, 타입 검증
- **보안 테스트 14개** (`__tests__/api-images-save.test.ts`) 전부 통과
- **변경 파일**: `app/api/images/save/route.ts`, `app/api/shopping/route.ts`, `extension/background/service-worker.js`, `extension/popup/popup.js`, `extension/content/smartstore.js`, `__tests__/api-images-save.test.ts`

### Sprint 8 — 배포 완료 + 로그인 감지 수정
- `npx vercel`로 Vercel 배포 완료: https://postinghelper.vercel.app
- `BLOB_READ_WRITE_TOKEN` Vercel 환경변수 설정 완료
- `service-worker.js` — `handleGenerateFromUrl()`에 로그인 감지 추가
  - 상품 탭 로드 후 `nid.naver.com` 리다이렉트 감지 → 로그인 대기 → 상품 URL 재이동
- **변경 파일**: `extension/background/service-worker.js`

### 배포 준비 + 버그 수정 (Sprint 5 후속)
- PR #2(sprint/4), PR #3(sprint/5) → main 머지 완료 (CI 통과)
- `lib/cors.ts` 생성 — 크롬 익스텐션 CORS 허용 (`Access-Control-Allow-Origin: *`)
- 모든 API 라우트에 OPTIONS 핸들러 + `withCors()` 적용
- `extension/manifest.json` — `notifications` 권한 추가
- `service-worker.js` — chrome.storage.local 기반 상태 관리로 전면 전환
  - 팝업 닫혀도 진행 상황 유지, 완료 시 Chrome 알림 표시
- `popup.js` — storage.onChanged 리스너로 실시간 상태 복원
- `smartstore.js` — `:contains()` CSS 선택자 제거 (DOMException 유발 버그 수정)
- 데이터 수집 중 진행 상황 메시지 추가 (32%~50% 구간)
- `service-worker.js` — sendMessageToTab() 최대 5회 재시도 로직 추가
- 로그인 감지: nid.naver.com 리다이렉트 감지 → 로그인 완료 후 자동 진행
- UX 전면 개편: 제휴 URL 입력만으로 전체 흐름 자동화 (상품 페이지 직접 방문 불필요)
- `formatRawPosting()`: API 키 없을 때 수집 데이터로 포스팅 직접 생성 (폴백)
- **변경 파일**: `lib/cors.ts`, `app/api/shopping/route.ts`, `app/api/place/route.ts`, `app/api/images/save/route.ts`, `extension/manifest.json`, `extension/background/service-worker.js`, `extension/popup/popup.html`, `extension/popup/popup.js`, `extension/content/smartstore.js`

### Sprint 5 — 네이버 블로그 자동 포스팅
- `extension/content/naverblog.js` 전면 구현
  - `waitForEditorDocument()`: mainFrame iframe 대응, 20초 타임아웃
  - `getContentEditable()`: 스마트에디터 ONE 다중 선택자 fallback
  - `typeText()`: 한 글자씩 20~60ms 랜덤 딜레이 타이핑
  - `insertImage()`: fetch → MIME 검증 → File → DataTransfer drop+paste 이중 시도
  - `setTitle()`: 제목 입력란 다중 선택자 대응, 한 글자씩 입력
  - `setTags()`: 태그 최대 10개, 30자 제한, Enter로 확정
  - 메시지 보안: `sender.tab` 체크로 다른 content script 차단
- `extension/background/service-worker.js` 업데이트
  - `handleStartPosting()`: `DO_POSTING` 전송 + 2.5초 에디터 초기화 대기
  - `isPosting` 플래그: POSTING_DONE/ERROR 수신 시 해제 (이전엔 즉시 해제)
  - POSTING_PROGRESS/POSTING_DONE/ERROR 메시지 팝업으로 포워딩
  - `sleep()` 유틸 함수 추가
- `extension/manifest.json`: Vercel Blob 도메인 host_permissions 추가
- **변경 파일**: `extension/content/naverblog.js`, `extension/background/service-worker.js`, `extension/manifest.json`

### Sprint 4 — 쇼핑 포스팅 생성 + 미리보기
- `/api/shopping` 에이전트 루프 완성: `plan_structure` → `generate_tags` → `end_turn`
  - `plan_structure` tool: Claude가 글 구조(텍스트/이미지 순서, imageIndex) 결정
  - `generate_tags` tool: SEO 최적화 태그 7~12개 생성
  - `sanitizeData()` 함수로 Prompt Injection 방지 (길이 제한 + JSON 구조화)
  - affiliateUrl HTTPS 검증, MAX_LOOPS=6 무한루프 방지
- 팝업 미리보기 기능 추가
  - `popup.html`: `#preview-wrap`, `#preview-title`, `#preview-tags`, `#preview-sections` 추가
  - `popup.css`: 미리보기 스타일 추가 (토글, 태그 뱃지, 텍스트/이미지 섹션)
  - `popup.js`: `showPreview()` 함수 — textContent/createElement만 사용 (XSS 방지), 토글 버튼 구현
- `__tests__/api-shopping.test.ts`: 에이전트 루프 3단계 모킹 테스트로 업데이트 (14개 전부 통과)
- **변경 파일**: `app/api/shopping/route.ts`, `extension/popup/popup.html`, `extension/popup/popup.css`, `extension/popup/popup.js`, `__tests__/api-shopping.test.ts`

### 제휴 링크 지원 추가
- `ShoppingData` 타입에 `affiliateUrl` 필드 추가
- 팝업에 제휴 링크 입력창 추가 (쇼핑 페이지 감지 시 표시)
- `brand.naver.com` manifest 및 content_scripts에 추가
- `smartstore.js`에서 `affiliateUrl` 수집 데이터에 포함
- `/api/shopping` 프롬프트에 제휴 링크 삽입 지시 추가
- **변경 파일**: `types/index.ts`, `extension/manifest.json`, `extension/popup/popup.html`, `extension/popup/popup.css`, `extension/popup/popup.js`, `extension/content/smartstore.js`, `app/api/shopping/route.ts`, `__tests__/api-shopping.test.ts`

### Sprint 3 — 스마트스토어 데이터 수집
- `extension/content/smartstore.js` 전면 구현
  - 상품명, 가격(정가/할인가), 판매자, 배송 추출 (다중 선택자 fallback)
  - 대표 이미지 슬라이더 + 상세페이지 이미지(iframe 포함) 수집
  - 리뷰 탭 클릭 → 최신 리뷰 3페이지 수집 (평점, 리뷰수, 주요 리뷰)
  - 동적 콘텐츠 대기 (MutationObserver + scroll lazy load)
- `extension/manifest.json` — brandconnect.naver.com 도메인 추가
- `__tests__/api-shopping.test.ts` 유닛 테스트 2개
- **변경 파일**: `extension/content/smartstore.js`, `extension/manifest.json`, `__tests__/api-shopping.test.ts`

### Sprint 2 — 프로젝트 구조 재설계 + 익스텐션 기반 세팅
- 크롬 익스텐션 전체 구조 생성 (`extension/manifest.json`, `popup/`, `background/`, `content/`)
- `types/index.ts` 공통 타입 정의 (ShoppingData, PlaceData, PostingSection, GeneratedPosting 등)
- `/api/shopping`, `/api/place`, `/api/images/save` 라우트 뼈대
- Vercel Blob 설치 (`@vercel/blob`), `.env.local`에 `BLOB_READ_WRITE_TOKEN` 추가
- content script 뼈대: `smartstore.js`, `navermap.js`, `naverblog.js`
- **변경 파일**: `extension/*`, `types/index.ts`, `app/api/shopping/route.ts`, `app/api/place/route.ts`, `app/api/images/save/route.ts`, `.env.local`, `package.json`

### 메모리 파일 생성
- `user_profile.md`, `project_context.md`, `feedback.md` 생성
- CLAUDE.md에 메모리 업데이트 필수 규칙 추가
- **변경 파일**: `CLAUDE.md`, `memory/*.md`

### 요구사항 확정 + 전체 계획 수립
- 서비스 방향 확정: 크롬 익스텐션 + Next.js 백엔드
- 포스팅 종류 6개 (쇼핑 1순위, 플레이스 2순위)
- 블로그 자동 입력 방식 확정: 한 글자씩 타이핑 + 이미지 교차 삽입
- `.claude/prd.md` 생성 — 전체 요구사항 문서
- `.claude/sprints.md` 전면 개편 — Sprint 1~8 전체 계획
- `CLAUDE.md` 전면 개편 — 새 아키텍처 반영
- `.claude/agents/extension-builder.md` 생성
- **변경 파일**: `.claude/prd.md`, `.claude/sprints.md`, `CLAUDE.md`, `.claude/agents/extension-builder.md`
