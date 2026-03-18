// service-worker.js — 백엔드 API 호출 및 탭 제어

const API_BASE = "https://postinghelper.vercel.app"; // 배포 후 실제 URL로 변경
// 로컬 개발 시: const API_BASE = "http://localhost:3000";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GENERATE_POSTING") {
    handleGeneratePosting(message.payload, sendResponse);
    return true; // 비동기 응답 유지
  }

  if (message.type === "START_POSTING") {
    handleStartPosting(message.payload, sender, sendResponse);
    return true;
  }
});

// ---- 포스팅 생성 ----
async function handleGeneratePosting({ pageType, data }, sendResponse) {
  try {
    const endpoint = pageType === "shopping" ? "/api/shopping" : "/api/place";

    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });

    if (!res.ok) {
      const err = await res.json();
      sendResponse({ success: false, error: err.error || "API 오류" });
      return;
    }

    const { posting } = await res.json();

    // 이미지 저장 (Vercel Blob)
    const imageUrls = posting.sections
      .filter((s) => s.type === "image")
      .map((s) => s.content);

    if (imageUrls.length > 0) {
      const saveRes = await fetch(`${API_BASE}/api/images/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: imageUrls }),
      });

      if (saveRes.ok) {
        const { savedUrls } = await saveRes.json();
        // 원본 URL을 저장된 URL로 교체
        let idx = 0;
        posting.sections = posting.sections.map((s) => {
          if (s.type === "image") {
            return { ...s, content: savedUrls[idx++] || s.content };
          }
          return s;
        });
      }
    }

    sendResponse({ success: true, posting });
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}

// ---- 블로그 자동 포스팅 ----
async function handleStartPosting({ posting }, sender, sendResponse) {
  try {
    // 네이버 블로그 에디터 탭 열기
    const tab = await chrome.tabs.create({
      url: "https://blog.naver.com/PostWriteForm.naver",
    });

    // 탭 로딩 완료 대기
    await waitForTabLoad(tab.id);

    // naverblog.js content script에 포스팅 데이터 전달
    await chrome.tabs.sendMessage(tab.id, {
      type: "START_POSTING",
      payload: { posting },
    });

    sendResponse({ success: true });
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}

// ---- 탭 로딩 완료 대기 ----
function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.onUpdated.addListener(function listener(id, info) {
      if (id === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    });
  });
}
