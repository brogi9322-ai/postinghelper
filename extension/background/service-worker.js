// service-worker.js — 백엔드 API 호출 및 탭 제어

const API_BASE = "https://postinghelper.vercel.app";
// 로컬 개발 시: const API_BASE = "http://localhost:3000";

const ALLOWED_PAGE_TYPES = ["shopping", "place"];
let isPosting = false; // 중복 포스팅 방지 (DoS 방어)

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 메시지 발신자 검증 — 같은 익스텐션에서만 허용
  if (sender.id !== chrome.runtime.id) {
    console.warn("알 수 없는 발신자:", sender.id);
    return;
  }

  // 허용된 메시지 타입만 처리
  if (!["GENERATE_POSTING", "START_POSTING"].includes(message.type)) return;

  if (message.type === "GENERATE_POSTING") {
    if (!validateGeneratePayload(message.payload)) {
      sendResponse({ success: false, error: "유효하지 않은 요청입니다." });
      return;
    }
    handleGeneratePosting(message.payload, sendResponse);
    return true;
  }

  if (message.type === "START_POSTING") {
    if (!validateStartPayload(message.payload)) {
      sendResponse({ success: false, error: "유효하지 않은 포스팅 데이터입니다." });
      return;
    }
    handleStartPosting(message.payload, sender, sendResponse);
    return true;
  }
});

// ---- 페이로드 검증 ----
function validateGeneratePayload(payload) {
  if (!payload || typeof payload !== "object") return false;
  if (!ALLOWED_PAGE_TYPES.includes(payload.pageType)) return false;
  if (!payload.data || typeof payload.data !== "object") return false;
  if (payload.pageType === "shopping" && !payload.data.productName) return false;
  if (payload.pageType === "place" && !payload.data.name) return false;
  return true;
}

function validateStartPayload(payload) {
  if (!payload || typeof payload !== "object") return false;
  if (!payload.posting || typeof payload.posting !== "object") return false;
  if (typeof payload.posting.title !== "string") return false;
  if (!Array.isArray(payload.posting.sections)) return false;
  return true;
}

// ---- 포스팅 생성 ----
async function handleGeneratePosting({ pageType, data }, sendResponse) {
  try {
    const endpoint = pageType === "shopping" ? "/api/shopping" : "/api/place";

    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      sendResponse({ success: false, error: String(json.error || "API 오류") });
      return;
    }

    if (!json.posting || typeof json.posting !== "object") {
      sendResponse({ success: false, error: "응답 형식 오류" });
      return;
    }

    const { posting } = json;

    // 이미지 저장 (Vercel Blob)
    const imageUrls = posting.sections
      .filter((s) => s.type === "image" && s.content)
      .map((s) => s.content);

    if (imageUrls.length > 0) {
      const saveRes = await fetch(`${API_BASE}/api/images/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: imageUrls }),
      });

      if (saveRes.ok) {
        const saveJson = await saveRes.json().catch(() => ({}));
        const savedUrls = Array.isArray(saveJson.savedUrls) ? saveJson.savedUrls : [];

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
    sendResponse({ success: false, error: String(err.message || "알 수 없는 오류") });
  }
}

// ---- 블로그 자동 포스팅 ----
async function handleStartPosting({ posting }, sender, sendResponse) {
  if (isPosting) {
    sendResponse({ success: false, error: "이미 포스팅이 진행 중입니다." });
    return;
  }

  isPosting = true;
  try {
    const tab = await chrome.tabs.create({
      url: "https://blog.naver.com/PostWriteForm.naver",
    });

    await waitForTabLoad(tab.id);

    await chrome.tabs.sendMessage(tab.id, {
      type: "START_POSTING",
      payload: { posting },
    });

    sendResponse({ success: true });
  } catch (err) {
    sendResponse({ success: false, error: String(err.message || "블로그 이동 실패") });
  } finally {
    isPosting = false;
  }
}

// ---- 탭 로딩 완료 대기 ----
function waitForTabLoad(tabId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("탭 로딩 타임아웃"));
    }, 30000);

    function listener(id, info) {
      if (id === tabId && info.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}
