// popup.js — 팝업 UI 제어

const pageTypeEl = document.getElementById("page-type");
const statusEl = document.getElementById("status");
const progressWrap = document.getElementById("progress-wrap");
const progressFill = document.getElementById("progress-fill");
const progressText = document.getElementById("progress-text");
const btnGenerate = document.getElementById("btn-generate");
const btnPost = document.getElementById("btn-post");
const affiliateWrap = document.getElementById("affiliate-wrap");
const affiliateUrlInput = document.getElementById("affiliate-url");
const previewWrap = document.getElementById("preview-wrap");
const previewContent = document.getElementById("preview-content");
const previewTitle = document.getElementById("preview-title");
const previewTags = document.getElementById("preview-tags");
const previewSections = document.getElementById("preview-sections");
const btnPreviewToggle = document.getElementById("btn-preview-toggle");

const SHOPPING_DOMAINS = ["smartstore.naver.com", "brand.naver.com", "brandconnect.naver.com"];
const ALLOWED_MESSAGE_TYPES = ["POSTING_PROGRESS", "POSTING_DONE", "ERROR"];

let currentPageType = null;
let generatedPosting = null;

// ---- URL 검증 ----
function isValidHttpsUrl(str) {
  try {
    const url = new URL(str);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

// ---- 현재 탭 URL로 페이지 종류 감지 ----
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const url = tabs[0]?.url || "";

  if (SHOPPING_DOMAINS.some((d) => url.includes(d))) {
    currentPageType = "shopping";
    pageTypeEl.textContent = "🛍️ 스마트스토어 감지됨";
    affiliateWrap.classList.remove("hidden");
    btnGenerate.disabled = false;
  } else if (url.includes("map.naver.com")) {
    currentPageType = "place";
    pageTypeEl.textContent = "📍 네이버 지도 감지됨";
    btnGenerate.disabled = false;
  } else {
    pageTypeEl.textContent = "⚠️ 지원하지 않는 페이지입니다";
    pageTypeEl.style.background = "#fef3c7";
    pageTypeEl.style.color = "#92400e";
  }
});

// ---- 포스팅 생성 버튼 ----
btnGenerate.addEventListener("click", async () => {
  const affiliateUrl = affiliateUrlInput?.value?.trim() || "";

  // 제휴 링크 검증
  if (currentPageType === "shopping") {
    if (!affiliateUrl) {
      setStatus("error", "제휴 링크를 입력해주세요.");
      return;
    }
    if (!isValidHttpsUrl(affiliateUrl)) {
      setStatus("error", "유효한 HTTPS URL을 입력해주세요.");
      return;
    }
    // 네이버 도메인만 허용
    try {
      const parsed = new URL(affiliateUrl);
      if (!parsed.hostname.endsWith("naver.com") && !parsed.hostname.endsWith("naver.me")) {
        setStatus("error", "네이버 제휴 링크만 입력 가능합니다.");
        return;
      }
    } catch {
      setStatus("error", "유효하지 않은 URL입니다.");
      return;
    }
  }

  setStatus("info", "데이터 수집 중...");
  showProgress(10, "페이지 데이터 수집 중...");
  btnGenerate.disabled = true;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(
    tab.id,
    {
      type: currentPageType === "shopping" ? "COLLECT_SHOPPING" : "COLLECT_PLACE",
      affiliateUrl,
    },
    (response) => {
      if (chrome.runtime.lastError || !response?.success) {
        setStatus("error", "데이터 수집 실패. 페이지를 새로고침 후 다시 시도해주세요.");
        btnGenerate.disabled = false;
        hideProgress();
        return;
      }

      showProgress(40, "Claude AI가 포스팅 생성 중...");

      chrome.runtime.sendMessage(
        {
          type: "GENERATE_POSTING",
          payload: { pageType: currentPageType, data: response.data },
        },
        (result) => {
          if (!result?.success) {
            setStatus("error", result?.error || "포스팅 생성 실패");
            btnGenerate.disabled = false;
            hideProgress();
            return;
          }

          generatedPosting = result.posting;
          showProgress(100, "포스팅 생성 완료!");
          setStatus("success", "포스팅이 생성되었습니다.");
          showPreview(result.posting);
          btnPost.classList.remove("hidden");
          btnGenerate.disabled = false;
        }
      );
    }
  );
});

// ---- 블로그에 올리기 버튼 ----
btnPost.addEventListener("click", async () => {
  if (!generatedPosting) return;

  setStatus("info", "네이버 블로그로 이동 중...");
  showProgress(5, "준비 중...");
  btnPost.disabled = true;

  chrome.runtime.sendMessage(
    { type: "START_POSTING", payload: { posting: generatedPosting } },
    (result) => {
      if (!result?.success) {
        setStatus("error", result?.error || "블로그 포스팅 실패");
        btnPost.disabled = false;
        hideProgress();
      }
    }
  );
});

// ---- background에서 오는 진행 상황 수신 ----
chrome.runtime.onMessage.addListener((message, sender) => {
  // 같은 익스텐션에서 온 메시지만 처리
  if (sender.id !== chrome.runtime.id) return;
  // 허용된 타입만 처리
  if (!ALLOWED_MESSAGE_TYPES.includes(message.type)) return;
  if (!message.payload || typeof message.payload !== "object") return;

  if (message.type === "POSTING_PROGRESS") {
    showProgress(Number(message.payload.percent) || 0, String(message.payload.text || ""));
  }
  if (message.type === "POSTING_DONE") {
    showProgress(100, "블로그 포스팅 완료!");
    setStatus("success", "블로그에 성공적으로 포스팅되었습니다!");
    btnPost.disabled = false;
  }
  if (message.type === "ERROR") {
    setStatus("error", String(message.payload.message || "오류가 발생했습니다."));
    btnPost.disabled = false;
    hideProgress();
  }
});

// ---- 유틸 (textContent 사용 — XSS 방지) ----
function setStatus(type, message) {
  statusEl.className = `status ${type}`;
  statusEl.textContent = String(message); // innerHTML 사용 금지
  statusEl.classList.remove("hidden");
}

function showProgress(percent, text) {
  progressWrap.classList.remove("hidden");
  progressFill.style.width = `${Math.min(100, Math.max(0, Number(percent)))}%`;
  progressText.textContent = String(text); // innerHTML 사용 금지
}

function hideProgress() {
  progressWrap.classList.add("hidden");
}

// ---- 미리보기 렌더링 (textContent/createElement 사용 — XSS 방지) ----
function showPreview(posting) {
  if (!posting) return;

  // 제목
  previewTitle.textContent = String(posting.title || "");

  // 태그
  previewTags.textContent = "";
  (posting.tags || []).forEach((tag) => {
    const span = document.createElement("span");
    span.className = "preview-tag";
    span.textContent = "#" + String(tag);
    previewTags.appendChild(span);
  });

  // 섹션
  previewSections.textContent = "";
  (posting.sections || []).forEach((section, i) => {
    const div = document.createElement("div");
    if (section.type === "image") {
      div.className = "preview-section-image";
      div.textContent = `📷 이미지 ${i + 1}`;
    } else {
      div.className = "preview-section-text";
      div.textContent = String(section.content || "").slice(0, 200) + (section.content?.length > 200 ? "…" : "");
    }
    previewSections.appendChild(div);
  });

  previewWrap.classList.remove("hidden");
}

// ---- 미리보기 토글 ----
btnPreviewToggle.addEventListener("click", () => {
  const isHidden = previewContent.classList.contains("hidden");
  previewContent.classList.toggle("hidden");
  btnPreviewToggle.textContent = isHidden ? "접기" : "펼치기";
});
