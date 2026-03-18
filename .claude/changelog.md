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
