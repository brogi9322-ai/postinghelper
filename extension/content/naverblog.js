// naverblog.js — 네이버 블로그 에디터 자동 입력 content script
// Sprint 5에서 실제 구현

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "START_POSTING") return;

  const { posting } = message.payload;
  startPosting(posting).then(() => {
    sendResponse({ success: true });
  }).catch((err) => {
    sendResponse({ success: false, error: err.message });
  });

  return true;
});

async function startPosting(posting) {
  // TODO Sprint 5: 실제 구현
  // 1. 에디터 영역 찾기
  // 2. sections 순서대로 처리
  //    - type === "text": 한 글자씩 타이핑
  //    - type === "image": 이미지 파일 삽입
  // 3. 저장
  console.log("포스팅 시작:", posting.title);
}

// 한 글자씩 타이핑 (봇 감지 우회)
async function typeText(element, text) {
  for (const char of text) {
    element.focus();
    document.execCommand("insertText", false, char);
    await delay(50 + Math.random() * 100); // 50~150ms 랜덤 딜레이
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
