# 스프린트 현황

> Claude Code가 새 터미널에서 열릴 때 반드시 읽는다.
> 작업 시작 전 "현재 스프린트" 확인 → 작업 완료 후 체크박스 업데이트.

---

## 현재 스프린트

**Sprint 8** — 🔴 진행 예정 (배포: Vercel + Chrome Web Store)

---

## 전체 스프린트 현황

### ✅ Sprint 1 — 프로젝트 기반 세팅
**기간**: 2026-03-18 | **상태**: 완료

| 항목 | 상태 |
|---|---|
| Next.js 15 + Tailwind CSS v4 + TypeScript | ✅ |
| Claude API 연동 + 에이전트 루프 + 스킬(tool_use) | ✅ |
| 기본 UI | ✅ |
| CLAUDE.md + .claude/agents/ 에이전트 정의 | ✅ |
| .claude/sprints.md + changelog.md + prd.md | ✅ |
| Jest + GitHub Actions CI | ✅ |
| GitHub 레포 생성 및 푸시 | ✅ |

---

### ✅ Sprint 2 — 프로젝트 구조 재설계 + 익스텐션 기반 세팅
**기간**: 2026-03-18 | **상태**: 완료

| 항목 | 상태 |
|---|---|
| 크롬 익스텐션 폴더 구조 생성 (`extension/`) | ✅ |
| manifest.json 작성 (MV3) | ✅ |
| 익스텐션 popup UI 기본 틀 | ✅ |
| background service worker 기본 틀 | ✅ |
| `/api/shopping` 라우트 뼈대 생성 | ✅ |
| `/api/place` 라우트 뼈대 생성 | ✅ |
| `/api/images/save` 라우트 뼈대 생성 | ✅ |
| 공통 TypeScript 타입 정의 (`types/index.ts`) | ✅ |
| Vercel Blob 패키지 설치 및 환경변수 세팅 | ✅ |

---

### ✅ Sprint 3 — 쇼핑: 스마트스토어 데이터 수집
**기간**: 2026-03-18 | **상태**: 완료

| 항목 | 상태 |
|---|---|
| 스마트스토어 content script 작성 | ✅ |
| 상품명 / 가격(정가·할인가) 추출 | ✅ |
| 상품 상세 설명 추출 | ✅ |
| 이미지 URL 목록 추출 (대표 + 상세 + iframe) | ✅ |
| 리뷰 (평점, 주요 리뷰 3페이지, 리뷰 수) 추출 | ✅ |
| 배송 정보 / 판매자 정보 추출 | ✅ |
| brandconnect.naver.com 도메인 manifest 추가 | ✅ |
| /api/shopping 유닛 테스트 작성 | ✅ |

---

### ✅ Sprint 4 — 쇼핑: 포스팅 생성 + 이미지 저장
**기간**: 2026-03-18 | **상태**: 완료

| 항목 | 상태 |
|---|---|
| `/api/shopping` 엔드포인트 구현 (에이전트 루프) | ✅ |
| 쇼핑 전용 system prompt + tools 작성 | ✅ |
| Claude가 글 구조 + 이미지 삽입 위치 결정 (`plan_structure`) | ✅ |
| SEO 태그 생성 (`generate_tags`) | ✅ |
| `/api/images/save` — 이미지 URL → Vercel Blob 저장 | ✅ |
| 팝업에서 생성된 포스팅 미리보기 | ✅ |
| 유닛 테스트 작성 (14개 통과) | ✅ |

---

### ✅ Sprint 5 — 쇼핑: 네이버 블로그 자동 포스팅
**기간**: 2026-03-18 | **상태**: 완료

| 항목 | 상태 |
|---|---|
| 네이버 블로그 에디터 content script 작성 | ✅ |
| 글자 한 자씩 타이핑 입력 구현 (20~60ms 랜덤 딜레이) | ✅ |
| 이미지 삽입 구현 (fetch→File→DataTransfer drop+paste) | ✅ |
| 글 → 사진 → 글 → 사진 교차 삽입 | ✅ |
| mainFrame iframe 대응 (waitForEditorDocument) | ✅ |
| 제목/태그 자동 입력 | ✅ |
| service-worker 진행 상황 포워딩 (팝업에 POSTING_PROGRESS 전달) | ✅ |
| manifest Vercel Blob 도메인 추가 | ✅ |

---

### 🔲 Sprint 6 — 플레이스: 데이터 수집
**목표**: 네이버 지도에서 장소 데이터 추출

| 항목 | 상태 |
|---|---|
| 네이버 지도 content script 작성 | 🔲 |
| 장소명 / 카테고리 / 주소 추출 | 🔲 |
| 영업시간 추출 | 🔲 |
| 메뉴 및 가격 추출 | 🔲 |
| 리뷰 (평점, 주요 리뷰) 추출 | 🔲 |
| 장소 이미지 추출 | 🔲 |
| 유닛 테스트 작성 | 🔲 |

---

### 🔲 Sprint 7 — 플레이스: 포스팅 생성 + 블로그 자동 포스팅
**목표**: 플레이스 포스팅 생성 및 자동 업로드

| 항목 | 상태 |
|---|---|
| `/api/place` 엔드포인트 구현 | 🔲 |
| 플레이스 전용 system prompt + tools 작성 | 🔲 |
| 블로그 자동 포스팅 (Sprint 5 스크립트 재활용) | 🔲 |
| 유닛 테스트 작성 | 🔲 |

---

### 🔄 Sprint 8 — 마무리 및 배포
**목표**: 안정화, Chrome Web Store 배포, Vercel 배포

| 항목 | 상태 |
|---|---|
| PR #2, #3 main 머지 | ✅ |
| CORS 헤더 추가 | ✅ |
| Vercel CLI 설치 | 🔲 |
| 백엔드 Vercel 배포 | 🔲 |
| Vercel 환경변수 설정 (대시보드에서 직접) | 🔲 |
| 익스텐션 실제 테스트 (end-to-end) | 🔲 |
| 익스텐션 Chrome Web Store 배포 | 🔲 |

---

## 백로그 (우선순위 미정)

| 아이디어 | 우선순위 |
|---|---|
| 리뷰 포스팅 | 추후 |
| 숙소 포스팅 | 추후 |
| 여행지 포스팅 | 추후 |
| 이슈 포스팅 | 추후 |
| 사용자 로그인 / 포스팅 히스토리 | 미정 |
