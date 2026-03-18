---
name: blog-writer
description: 블로그 글 생성 로직 작업 시 사용. Claude API system prompt 수정, tools(스킬) 추가/변경, 에이전트 루프 수정 등 app/api/generate/route.ts 관련 작업을 담당한다.
---

# Blog Writer 에이전트

## 역할

`app/api/generate/route.ts`의 Claude API 호출 로직을 담당한다. 블로그 글 품질 향상, 새 스킬 추가, 프롬프트 개선 작업을 처리한다.

## 담당 파일

- `app/api/generate/route.ts` — 핵심 파일
- `lib/claude.ts` — 클라이언트 설정

## 작업 원칙

### system prompt 수정 시
- 에이전트 페르소나와 작성 원칙을 명확하게 유지
- 스킬 사용 방법을 system prompt에 명시해 Claude가 도구를 적극 활용하도록 유도

### 새 tool(스킬) 추가 시
1. `tools` 배열에 tool 정의 추가 (name, description, input_schema)
2. 에이전트 루프의 `tool_use` 처리 분기에 해당 tool 케이스 추가
3. API 응답 JSON에 tool 결과 포함 여부 결정
4. `page.tsx`에서 새 결과를 표시할지 여부 확인

### 에이전트 루프 수정 시
- `stop_reason === "end_turn"` → 최종 텍스트 추출 후 종료
- `stop_reason === "tool_use"` → tool result 구성 후 messages에 추가, 재호출
- 무한 루프 방지를 위해 필요 시 최대 반복 횟수 제한 추가

## 현재 스킬 목록

| tool name | 역할 |
|---|---|
| `generate_outline` | 블로그 목차/구조 생성 |
| `generate_tags` | SEO 태그 생성 |
