// service-worker.js — 백엔드 API 호출 및 탭 제어

const API_BASE = "https://postinghelper.vercel.app";
// 로컬 개발 시: const API_BASE = "http://localhost:3000";

const SHOPPING_DOMAINS = ["smartstore.naver.com", "brand.naver.com", "brandconnect.naver.com"];
let isGenerating = false;
let isPosting = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;

  const ALLOWED_TYPES = ["GENERATE_FROM_URL", "START_POSTING", "POSTING_PROGRESS", "POSTING_DONE", "ERROR"];
  if (!ALLOWED_TYPES.includes(message.type)) return;

  // naverblog.js → 팝업 포워딩 + storage 업데이트
  if (message.type === "POSTING_PROGRESS") {
    const p = message.payload || {};
    saveState({ status: "posting", progress: { percent: Number(p.percent) || 0, text: String(p.text || "") } });
    return;
  }
  if (message.type === "POSTING_DONE") {
    isPosting = false;
    saveState({ status: "done", progress: { percent: 100, text: "블로그 포스팅 완료!" } });
    return;
  }
  if (message.type === "ERROR") {
    isPosting = false;
    isGenerating = false;
    saveState({ status: "error", error: String(message.payload?.message || "오류 발생") });
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

// ============================================================
// URL → 수집 → 생성 → storage에 저장
// ============================================================
async function handleGenerateFromUrl(url, sendResponse) {
  if (isGenerating) {
    sendResponse({ success: false, error: "이미 처리 중입니다." });
    return;
  }
  isGenerating = true;
  sendResponse({ success: true });

  await saveState({ status: "generating", progress: { percent: 5, text: "상품 페이지 이동 중..." } });

  let productTab = null;

  try {
    // 1. 상품 페이지 열기
    productTab = await chrome.tabs.create({ url, active: true });
    await waitForTabLoad(productTab.id);
    await sleep(1500);

    // 로그인 여부 확인 (수집 전)
    const afterLoadTab = await chrome.tabs.get(productTab.id);
    if (afterLoadTab.url?.includes("nid.naver.com")) {
      await saveState({ status: "generating", progress: { percent: 8, text: "네이버 로그인이 필요합니다. 로그인 완료 후 자동으로 진행됩니다." } });
      await waitForTabUrl(productTab.id, (u) => !u.includes("nid.naver.com"), 180000);
      await sleep(1000);
      // 로그인 완료 → 상품 페이지로 재이동
      await chrome.tabs.update(productTab.id, { url });
      await waitForTabLoad(productTab.id);
      await sleep(2000);
    }

    await saveProgress(20, "페이지 로딩 완료. 데이터 수집 준비 중...");

    // 2. 페이지 타입 결정
    const updatedTab = await chrome.tabs.get(productTab.id);
    const finalUrl = updatedTab.url || "";
    const pageType = SHOPPING_DOMAINS.some((d) => finalUrl.includes(d)) ? "shopping" : "place";

    // 3. 데이터 수집
    await saveProgress(30, "데이터 수집 중...");
    const collectRes = await sendMessageToTab(productTab.id, {
      type: pageType === "shopping" ? "COLLECT_SHOPPING" : "COLLECT_PLACE",
      affiliateUrl: url,
    });

    if (!collectRes?.success) throw new Error(collectRes?.error || "데이터 수집 실패");

    chrome.tabs.remove(productTab.id).catch(() => {});
    productTab = null;

    const data = collectRes.data;

    // 4. 포스팅 생성 (Claude API → 실패 시 raw 포맷)
    await saveProgress(60, "포스팅 생성 중...");
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
    } catch { /* 서버 없음 → 폴백 */ }

    if (!posting) posting = formatRawPosting(data, pageType);

    // 5. 이미지 저장
    await saveProgress(80, "이미지 저장 중...");
    try {
      const imageUrls = posting.sections.filter((s) => s.type === "image" && s.content).map((s) => s.content);
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
          posting.sections = posting.sections.map((s) =>
            s.type === "image" ? { ...s, content: savedUrls[idx++] || s.content } : s
          );
        }
      }
    } catch { /* 이미지 저장 실패 → 원본 URL 유지 */ }

    // 6. storage에 완성된 포스팅 저장 → 팝업이 열리면 이걸 읽음
    await saveState({ status: "ready", progress: { percent: 100, text: "포스팅 생성 완료!" }, posting });
    showNotification("포스팅 생성 완료 ✅", "익스텐션 아이콘을 클릭해서 미리보기를 확인하세요.");

  } catch (err) {
    if (productTab) chrome.tabs.remove(productTab.id).catch(() => {});
    await saveState({ status: "error", error: String(err.message || "오류 발생") });
    showNotification("포스팅 생성 실패 ❌", String(err.message || "오류가 발생했습니다. 익스텐션을 다시 열어 확인하세요."));
  } finally {
    isGenerating = false;
  }
}

// ============================================================
// 블로그 자동 포스팅
// ============================================================
async function handleStartPosting({ posting }, sendResponse) {
  if (isPosting) {
    sendResponse({ success: false, error: "이미 포스팅이 진행 중입니다." });
    return;
  }

  isPosting = true;
  try {
    // 1. blog.naver.com 홈에서 blogId 추출 (PostWriteForm은 blogId 필수)
    await saveState({ status: "posting", progress: { percent: 3, text: "블로그 정보 확인 중..." } });
    const homeTab = await chrome.tabs.create({ url: "https://blog.naver.com", active: true });
    await waitForTabLoad(homeTab.id);

    // 로그인 확인
    const homeTabInfo = await chrome.tabs.get(homeTab.id);
    if (homeTabInfo.url?.includes("nid.naver.com")) {
      await saveState({ status: "posting", progress: { percent: 5, text: "네이버 로그인이 필요합니다. 로그인 완료 후 자동으로 진행됩니다." } });
      await waitForTabUrl(homeTab.id, (url) => url.includes("blog.naver.com"), 180000);
      await sleep(1000);
      await chrome.tabs.update(homeTab.id, { url: "https://blog.naver.com" });
      await waitForTabLoad(homeTab.id);
    }

    await sleep(1500);

    // 페이지 내 링크에서 blogId 추출
    const scriptResult = await chrome.scripting.executeScript({
      target: { tabId: homeTab.id },
      func: () => {
        for (const link of document.querySelectorAll("a[href]")) {
          const m = link.href.match(/[?&]blogId=([^&]+)/);
          if (m) return decodeURIComponent(m[1]);
        }
        return null;
      },
    });
    const blogId = scriptResult?.[0]?.result || null;
    chrome.tabs.remove(homeTab.id).catch(() => {});

    // 2. 글쓰기 페이지로 이동 (blogId 있으면 파라미터 포함)
    const writeUrl = blogId
      ? `https://blog.naver.com/PostWriteForm.naver?blogId=${encodeURIComponent(blogId)}`
      : "https://blog.naver.com/PostWriteForm.naver";

    await saveProgress(10, "블로그 에디터 로딩 중...");
    const tab = await chrome.tabs.create({ url: writeUrl });
    await waitForTabLoad(tab.id);
    await sleep(2500);

    await chrome.tabs.sendMessage(tab.id, { type: "DO_POSTING", payload: { posting } });
    sendResponse({ success: true });
  } catch (err) {
    isPosting = false;
    await saveState({ status: "error", error: String(err.message || "블로그 이동 실패") });
    sendResponse({ success: false, error: String(err.message) });
  }
}

// ============================================================
// API 없을 때 raw 데이터 포맷
// ============================================================
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
        content: [`평점: ${data.reviews.rating || "-"}점 (${data.reviews.count || 0}개 리뷰)`, "", highlights.slice(0, 5).map((h) => `• ${String(h)}`).join("\n")].join("\n"),
      });
    }
    images.slice(2, 6).forEach((img) => sections.push({ type: "image", content: img }));
    if (data.affiliateUrl) {
      sections.push({ type: "text", content: `구매를 원하신다면 아래 링크를 확인해보세요!\n${String(data.affiliateUrl)}` });
    }

    const tags = String(data.productName || "").split(/\s+/).filter((t) => t.length > 1).slice(0, 8);
    return { title: String(data.productName || "상품 포스팅"), sections, tags };
  }
  return { title: String(data.name || "포스팅"), sections: [{ type: "text", content: String(data.description || "") }], tags: [] };
}

// ============================================================
// storage 헬퍼
// ============================================================
function saveState(state) {
  return chrome.storage.local.set(state);
}

function saveProgress(percent, text) {
  return saveState({ status: "generating", progress: { percent, text } });
}

// ============================================================
// 유틸
// ============================================================
function showNotification(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon48.png",
    title: String(title),
    message: String(message),
  });
}

function validateStartPayload(payload) {
  if (!payload || typeof payload !== "object") return false;
  if (!payload.posting || typeof payload.posting !== "object") return false;
  if (typeof payload.posting.title !== "string") return false;
  if (!Array.isArray(payload.posting.sections)) return false;
  return true;
}

async function sendMessageToTab(tabId, message, retries = 5, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, message, (res) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve(res);
        });
      });
    } catch (err) {
      if (i < retries - 1) await sleep(delayMs);
      else throw err;
    }
  }
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

function waitForTabUrl(tabId, urlCheck, timeoutMs = 180000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("로그인 대기 타임아웃 (3분)"));
    }, timeoutMs);
    function listener(id, info, tab) {
      if (id === tabId && info.status === "complete" && urlCheck(tab.url || "")) {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}
