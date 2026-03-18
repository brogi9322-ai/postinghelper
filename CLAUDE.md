# PostingHelper — 프로젝트 지침

AI 해커톤용 블로그 포스팅 도우미. Claude API를 활용해 사용자가 입력한 주제로 블로그 글을 자동 생성한다.

## 새 터미널에서 시작할 때 필독

순서대로 읽고 현재 상태를 파악한 뒤 작업을 시작한다.

1. `.claude/sprints.md` — 현재 스프린트, 남은 작업 확인
2. `.claude/changelog.md` — 마지막으로 어떤 작업을 했는지 확인

## 작업 완료 후 필수 업데이트 (매번 반드시)

코드 작업이 끝날 때마다 아래 두 파일을 업데이트한다. 빠뜨리지 말 것.

| 파일 | 업데이트 내용 |
|---|---|
| `.claude/sprints.md` | 완료한 항목 ✅ 체크, 현재 스프린트 상태 갱신 |
| `.claude/changelog.md` | 날짜 / 작업 내용 / 변경된 파일 추가 |

## 기술 스택

- **프레임워크**: Next.js 15 (App Router)
- **스타일링**: Tailwind CSS v4
- **AI**: Claude API (`@anthropic-ai/sdk`) — `claude-opus-4-6` 모델 사용
- **언어**: TypeScript (strict)
- **배포**: Vercel

## 프로젝트 구조

```
app/
  page.tsx              # 메인 UI (클라이언트 컴포넌트)
  layout.tsx            # 루트 레이아웃
  globals.css           # Tailwind 글로벌 스타일
  api/
    generate/
      route.ts          # Claude API 호출 — 에이전트 루프 + 스킬(tool_use)
lib/
  claude.ts             # Anthropic 클라이언트 싱글턴
components/             # 재사용 UI 컴포넌트 (추가 시 여기에)
__tests__/              # Jest 테스트 파일
.github/workflows/
  ci.yml                # GitHub Actions CI (typecheck + lint + test)
.claude/
  sprints.md            # 스프린트 현황 및 백로그 ← 작업 전 확인, 완료 후 업데이트
  changelog.md          # 변경 기록 ← 작업 완료 후 반드시 추가
  agents/               # 역할별 서브에이전트 정의
```

## 개발 명령어

```bash
npm run dev          # 로컬 서버 실행
npm run typecheck    # TypeScript 타입 체크
npm run lint         # ESLint
npm run test         # Jest 테스트
npm run test:ci      # CI용 테스트 (coverage 포함)
```

## Claude API 패턴

`app/api/generate/route.ts`는 다음 구조를 따른다:

1. **system prompt** — 에이전트 지침 (블로그 작가 페르소나, 작성 원칙)
2. **tools** — 스킬 목록 (`generate_outline`, `generate_tags`)
3. **에이전트 루프** — `stop_reason === "tool_use"`이면 tool result를 붙여 재호출, `end_turn`이면 종료

새 스킬(tool) 추가 시 `route.ts`의 `tools` 배열에 추가하고, 루프 내 처리 분기도 추가한다.

## 코딩 규칙

- `any` 타입 금지 — 항상 명시적 타입 사용
- 새 API 라우트는 `app/api/<기능>/route.ts` 패턴 유지
- 환경변수는 반드시 `.env.local`에 정의, 코드에 하드코딩 금지
- 컴포넌트 파일명은 PascalCase, 유틸 파일명은 camelCase
- `npm run dev` 후 `http://localhost:3000`에서 확인

## 에이전트 역할 분리

복잡한 작업은 `.claude/agents/`의 서브에이전트를 참고해 역할을 나눈다:

- `blog-writer.md` — 블로그 글 생성 로직 관련 작업
- `ui-builder.md` — 프론트엔드 UI/UX 관련 작업
- `api-designer.md` — API 라우트 설계 및 수정 작업
