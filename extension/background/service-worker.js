// service-worker.js — 백엔드 API 호출 및 탭 제어

const API_BASE = "https://postinghelper.vercel.app";
// 로컬 개발 시: const API_BASE = "http://localhost:3000";

const SHOPPING_DOMAINS = ["smartstore.naver.com", "brand.naver.com", "brandconnect.naver.com"];
let isGenerating = false; // 중복 생성 방지
let isPosting = false;    // 중복 포스팅 방지

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;

  const ALLOWED_TYPES = [
    "GENERATE_FROM_URL", "START_POSTING",
    "POSTING_PROGRESS", "POSTING_DONE", "ERROR",
  ];
  if (!ALLOWED_TYPES.includes(message.type)) return;

  // naverblog.js → service worker → popup 포워딩
  if (["POSTING_PROGRESS", "POSTING_DONE", "ERROR"].includes(message.type)) {
    if (message.type === "POSTING_DONE" || message.type === "ERROR") {
      isPosting = false;
    }
    chrome.runtime.sendMessage(message).catch(() => {});
    return;
  }

  if (message.type === "GENERATE_FROM_URL") {
    if (!message.payload?.url || typeof message.payload.url !== "string") {
      sendResponse({ success: false, error: "URL이 없습니다." });
      return;
    }
    handleGenerateFromUrl(message.payload.url, sendResponse);
    return true;
  }

  if (message.type === "START_POSTING") {
    if (!validateStartPayload(message.payload)) {
      sendResponse({ success: false, error: "유효하지 않은 포스팅 데이터입니다." });
      return;
    }
    handleStartPosting(message.payload, sendResponse);
    return true;
  }
});

// ---- URL 입력 → 수집 → 생성 → 팝업에 GENERATE_DONE 전송 ----
async function handleGenerateFromUrl(url, sendResponse) {
  if (isGenerating) {
    sendResponse({ success: false, error: "이미 처리 중입니다." });
    return;
  }
  isGenerating = true;
  sendResponse({ success: true }); // 즉시 응답, 이후 진행은 sendGenerateProgress로

  let productTab = null;

  try {
    // 1. 상품 페이지 열기
    sendGenerateProgress(10, "상품 페이지 이동 중...");
    productTab = await chrome.tabs.create({ url, active: true });
    await waitForTabLoad(productTab.id);
    await sleep(2000); // 동적 콘텐츠 로딩 대기

    // 2. 최종 URL로 페이지 타입 결정
    const updatedTab = await chrome.tabs.get(productTab.id);
    const finalUrl = updatedTab.url || "";
    const pageType = SHOPPING_DOMAINS.some((d) => finalUrl.includes(d)) ? "shopping" : "place";

    // 3. 데이터 수집
    sendGenerateProgress(30, "데이터 수집 중...");
    const collectRes = await sendMessageToTab(productTab.id, {
      type: pageType === "shopping" ? "COLLECT_SHOPPING" : "COLLECT_PLACE",
      affiliateUrl: url,
    });

    if (!collectRes?.success) {
      throw new Error(collectRes?.error || "데이터 수집 실패");
    }

    // 상품 탭 닫기
    chrome.tabs.remove(productTab.id).catch(() => {});
    productTab = null;

    const data = collectRes.data;

    // 4. Claude API로 포스팅 생성 시도 → 실패 시 raw 포맷 폴백
    sendGenerateProgress(60, "포스팅 생성 중...");
    let posting = null;

    try {
      const endpoint = pageType === "shopping" ? "/api/shopping" : "/api/place";
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.posting && typeof json.posting === "object") {
        posting = json.posting;
      }
    } catch {
      // 서버 미배포 or API 키 없음 → 폴백
    }

    if (!posting) posting = formatRawPosting(data, pageType);

    // 5. 이미지 Vercel Blob 저장 시도
    sendGenerateProgress(80, "이미지 저장 중...");
    try {
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
            if (s.type === "image") return { ...s, content: savedUrls[idx++] || s.content };
            return s;
          });
        }
      }
    } catch {
      // 이미지 저장 실패해도 원본 URL로 계속 진행
    }

    sendGenerateProgress(100, "생성 완료!");
    chrome.runtime.sendMessage({ type: "GENERATE_DONE", payload: { posting } }).catch(() => {});

  } catch (err) {
    if (productTab) chrome.tabs.remove(productTab.id).catch(() => {});
    chrome.runtime.sendMessage({
      type: "ERROR",
      payload: { message: String(err.message || "오류 발생") },
    }).catch(() => {});
  } finally {
    isGenerating = false;
  }
}

// ---- 블로그 자동 포스팅 ----
async function handleStartPosting({ posting }, sendResponse) {
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
    await sleep(2500); // 에디터 JS 초기화 대기

    await chrome.tabs.sendMessage(tab.id, {
      type: "DO_POSTING",
      payload: { posting },
    });

    sendResponse({ success: true });
  } catch (err) {
    isPosting = false;
    sendResponse({ success: false, error: String(err.message || "블로그 이동 실패") });
  }
}

// ---- API 없을 때 수집 데이터 → 포스팅 포맷 변환 ----
function formatRawPosting(data, pageType) {
  if (pageType === "shopping") {
    const images = Array.isArray(data.images) ? data.images : [];
    const sections = [];

    sections.push({
      type: "text",
      content: [String(data.productName || ""), "", String(data.description || "").slice(0, 500)].join("\n"),
    });

    if (images[0]) sections.push({ type: "image", content: images[0] });

    const priceLines = [];
    if (data.price?.discounted) priceLines.push(`판매가: ${Number(data.price.discounted).toLocaleString()}원`);
    if (data.price?.original) priceLines.push(`정가: ${Number(data.price.original).toLocaleString()}원`);
    if (data.shipping) priceLines.push(`배송: ${String(data.shipping)}`);
    if (data.seller) priceLines.push(`판매자: ${String(data.seller)}`);
    if (priceLines.length) sections.push({ type: "text", content: priceLines.join("\n") });

    if (images[1]) sections.push({ type: "image", content: images[1] });

    const highlights = Array.isArray(data.reviews?.highlights) ? data.reviews.highlights : [];
    if (highlights.length) {
      sections.push({
        type: "text",
        content: [
          `평점: ${data.reviews.rating || "-"}점 (${data.reviews.count || 0}개 리뷰)`,
          "",
          highlights.slice(0, 5).map((h) => `• ${String(h)}`).join("\n"),
        ].join("\n"),
      });
    }

    images.slice(2, 6).forEach((img) => sections.push({ type: "image", content: img }));

    if (data.affiliateUrl) {
      sections.push({
        type: "text",
        content: `구매를 원하신다면 아래 링크를 확인해보세요!\n${String(data.affiliateUrl)}`,
      });
    }

    const tags = String(data.productName || "").split(/\s+/).filter((t) => t.length > 1).slice(0, 8);
    return { title: String(data.productName || "상품 포스팅"), sections, tags };
  }

  return {
    title: String(data.name || "포스팅"),
    sections: [{ type: "text", content: String(data.description || "") }],
    tags: [],
  };
}

// ---- 유틸 ----
function validateStartPayload(payload) {
  if (!payload || typeof payload !== "object") return false;
  if (!payload.posting || typeof payload.posting !== "object") return false;
  if (typeof payload.posting.title !== "string") return false;
  if (!Array.isArray(payload.posting.sections)) return false;
  return true;
}

function sendGenerateProgress(percent, text) {
  chrome.runtime.sendMessage({
    type: "POSTING_PROGRESS",
    payload: { percent, text },
  }).catch(() => {});
}

function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
