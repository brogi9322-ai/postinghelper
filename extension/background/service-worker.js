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
  const ALLOWED_TYPES = ["GENERATE_POSTING", "START_POSTING", "POSTING_PROGRESS", "POSTING_DONE", "ERROR"];
  if (!ALLOWED_TYPES.includes(message.type)) return;

  // naverblog.js에서 올라오는 진행 상황 → 팝업으로 포워딩
  if (["POSTING_PROGRESS", "POSTING_DONE", "ERROR"].includes(message.type)) {
    if (message.type === "POSTING_DONE" || message.type === "ERROR") {
      isPosting = false;
    }
    chrome.runtime.sendMessage(message).catch(() => {});
    return;
  }

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

    let posting = null;

    // Claude API 호출 시도 — 실패 시 raw 데이터 포맷으로 폴백
    try {
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
      // 네트워크 오류 or 서버 미배포 → 폴백
    }

    // API 키 없음 / 서버 오류 → 수집 데이터 직접 포맷
    if (!posting) {
      posting = formatRawPosting(data, pageType);
    }

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
    // 에디터 JS 초기화 시간 확보
    await sleep(2500);

    await chrome.tabs.sendMessage(tab.id, {
      type: "DO_POSTING",
      payload: { posting },
    });

    sendResponse({ success: true });
    // isPosting은 POSTING_DONE / ERROR 수신 시 해제됨
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

    // 도입부
    const intro = [
      `${String(data.productName || "")}`,
      "",
      String(data.description || "").slice(0, 500),
    ].join("\n");
    sections.push({ type: "text", content: intro });

    // 이미지 1
    if (images[0]) sections.push({ type: "image", content: images[0] });

    // 가격/배송 정보
    const priceLines = [];
    if (data.price?.discounted) {
      priceLines.push(`판매가: ${Number(data.price.discounted).toLocaleString()}원`);
    }
    if (data.price?.original) {
      priceLines.push(`정가: ${Number(data.price.original).toLocaleString()}원`);
    }
    if (data.shipping) priceLines.push(`배송: ${String(data.shipping)}`);
    if (data.seller) priceLines.push(`판매자: ${String(data.seller)}`);
    if (priceLines.length) sections.push({ type: "text", content: priceLines.join("\n") });

    // 이미지 2
    if (images[1]) sections.push({ type: "image", content: images[1] });

    // 리뷰 요약
    const highlights = Array.isArray(data.reviews?.highlights) ? data.reviews.highlights : [];
    if (highlights.length) {
      const reviewText = [
        `평점: ${data.reviews.rating || "-"}점 (${data.reviews.count || 0}개 리뷰)`,
        "",
        highlights.slice(0, 5).map((h) => `• ${String(h)}`).join("\n"),
      ].join("\n");
      sections.push({ type: "text", content: reviewText });
    }

    // 나머지 이미지 (최대 4장 추가)
    images.slice(2, 6).forEach((img) => sections.push({ type: "image", content: img }));

    // 구매 안내 + 제휴 링크
    if (data.affiliateUrl) {
      sections.push({
        type: "text",
        content: `구매를 원하신다면 아래 링크를 확인해보세요!\n${String(data.affiliateUrl)}`,
      });
    }

    // 태그: 상품명 단어 분리
    const tags = String(data.productName || "")
      .split(/\s+/)
      .filter((t) => t.length > 1)
      .slice(0, 8);

    return { title: String(data.productName || "상품 포스팅"), sections, tags };
  }

  // 플레이스 폴백 (추후 Sprint 7에서 고도화)
  return {
    title: String(data.name || "포스팅"),
    sections: [{ type: "text", content: String(data.description || "") }],
    tags: [],
  };
}

// ---- 유틸 ----
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
