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
