# PostingHelper — 프로젝트 지침

크롬 익스텐션 + Next.js 백엔드 구성의 블로그 포스팅 자동화 서비스.
사용자가 네이버 스마트스토어 / 네이버 지도 페이지를 열면 익스텐션이 데이터를 수집하고,
Claude AI가 포스팅 글을 생성한 뒤, 네이버 블로그에 글과 이미지를 자동 입력한다.

## 새 터미널에서 시작할 때 필독

순서대로 읽고 현재 상태를 파악한 뒤 작업을 시작한다.

1. `.claude/sprints.md` — 현재 스프린트, 남은 작업 확인
2. `.claude/changelog.md` — 마지막으로 어떤 작업을 했는지 확인
3. `.claude/prd.md` — 기능 요구사항 전체 확인 (필요 시)

## 작업 완료 후 필수 업데이트 ⚠️ 절대 빠뜨리지 말 것

코드 작업이 끝날 때마다 아래 3개 파일을 반드시 업데이트하고 커밋한다.

| 파일 | 업데이트 내용 |
|---|---|
| `.claude/sprints.md` | 완료한 항목 ✅ 체크, 현재 스프린트 상태 갱신 |
| `.claude/changelog.md` | 날짜 / 작업 내용 / 변경된 파일 추가 |
| `~/.claude/projects/.../memory/` | 새로운 결정사항, 피드백, 프로젝트 변경사항 반영 |

메모리 파일 경로: `/Users/heerok/.claude/projects/-Users-heerok-Desktop----ai-Hackathon-postinghelper/memory/`
- `project_context.md` — 아키텍처/기술 결정사항 변경 시
- `feedback.md` — 사용자가 새로운 규칙/피드백 줄 때
- `user_profile.md` — 사용자 정보 추가될 때

---

## 기술 스택

| 역할 | 기술 |
|---|---|
| 크롬 익스텐션 | Manifest V3, Vanilla JS (또는 React) |
| 백엔드 | Next.js 15 (App Router), TypeScript |
| 스타일링 | Tailwind CSS v4 |
| AI | Claude API (`@anthropic-ai/sdk`) — `claude-opus-4-6` |
| 이미지 저장 | Vercel Blob |
| 배포 | 백엔드: Vercel / 익스텐션: Chrome Web Store |
| 테스트 | Jest (유닛), Playwright (E2E) |
| CI | GitHub Actions |

---

## 프로젝트 구조

```
postinghelper/
├── app/
│   ├── page.tsx                  # 메인 페이지 (추후 대시보드)
│   ├── layout.tsx
│   ├── globals.css
│   └── api/
│       ├── shopping/route.ts     # 쇼핑 포스팅 생성
│       ├── place/route.ts        # 플레이스 포스팅 생성
│       └── images/
│           └── save/route.ts     # 이미지 → Vercel Blob 저장
├── extension/                    # 크롬 익스텐션
│   ├── manifest.json
│   ├── popup/                    # 팝업 UI
│   ├── background/               # Service Worker
│   └── content/
│       ├── smartstore.ts         # 스마트스토어 데이터 수집
│       ├── navermap.ts           # 네이버 지도 데이터 수집
│       └── naverblog.ts          # 네이버 블로그 자동 입력
├── lib/
│   └── claude.ts                 # Anthropic 클라이언트
├── types/
│   └── index.ts                  # 공통 TypeScript 타입
├── __tests__/                    # Jest 테스트
├── .github/workflows/ci.yml      # GitHub Actions CI
└── .claude/
    ├── sprints.md                # 스프린트 현황 ← 항상 확인
    ├── changelog.md              # 변경 기록 ← 완료 후 업데이트
    ├── prd.md                    # 기능 요구사항 전체
    └── agents/                   # 역할별 서브에이전트
```

---

## 전체 플로우

```
1. 사용자가 스마트스토어 or 네이버 지도 페이지 열기
2. 익스텐션 팝업에서 [포스팅 생성] 클릭
3. content script → 페이지 데이터 수집
4. 백엔드 /api/shopping or /api/place 호출
5. Claude가 포스팅 글 + 이미지 삽입 위치 생성
6. /api/images/save → 이미지 Vercel Blob 저장
7. 익스텐션이 네이버 블로그 에디터로 이동
8. 글자 한 자씩 타이핑 + 이미지 교차 삽입
9. 저장 완료
```

---

## Claude API 패턴

각 API 라우트는 아래 구조를 따른다:

1. **system prompt** — 포스팅 종류별 에이전트 지침
2. **tools** — 스킬 목록 (outline, tags, image_placement 등)
3. **에이전트 루프** — `tool_use` → tool result → `end_turn`

새 스킬 추가 시: `tools` 배열에 추가 + 루프 처리 분기 추가.

---

## 코딩 규칙

- `any` 타입 금지 — 항상 명시적 타입 사용
- 새 API 라우트는 `app/api/<기능>/route.ts` 패턴 유지
- 환경변수는 `.env.local`에 정의, 코드에 하드코딩 금지
- 컴포넌트/클래스 파일명은 PascalCase, 유틸은 camelCase
- 작업 완료 시 반드시 `npm run typecheck && npm run test` 통과 확인

---

## 개발 명령어

```bash
npm run dev          # 로컬 서버 (http://localhost:3000)
npm run typecheck    # TypeScript 타입 체크
npm run lint         # ESLint
npm run test         # Jest 테스트
npm run test:ci      # CI용 테스트 (coverage 포함)
```

---

## 에이전트 역할 분리

| 에이전트 파일 | 담당 |
|---|---|
| `blog-writer.md` | Claude API 로직, system prompt, tools 수정 |
| `ui-builder.md` | 팝업 UI, 프론트엔드 컴포넌트 |
| `api-designer.md` | API 라우트 설계 및 수정 |
| `extension-builder.md` | 크롬 익스텐션 content script, background, manifest |
