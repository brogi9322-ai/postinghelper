// popup.js — 팝업 UI 제어

const statusEl = document.getElementById("status");
const progressWrap = document.getElementById("progress-wrap");
const progressFill = document.getElementById("progress-fill");
const progressText = document.getElementById("progress-text");
const btnGenerate = document.getElementById("btn-generate");
const btnPost = document.getElementById("btn-post");
const affiliateUrlInput = document.getElementById("affiliate-url");
const previewWrap = document.getElementById("preview-wrap");
const previewContent = document.getElementById("preview-content");
const previewTitle = document.getElementById("preview-title");
const previewTags = document.getElementById("preview-tags");
const previewSections = document.getElementById("preview-sections");
const btnPreviewToggle = document.getElementById("btn-preview-toggle");

const ALLOWED_MESSAGE_TYPES = ["POSTING_PROGRESS", "POSTING_DONE", "GENERATE_DONE", "ERROR"];

let generatedPosting = null;

// ---- URL 검증 ----
function isValidUrl(str) {
  try {
    const url = new URL(str);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

// ---- 포스팅 생성 버튼 ----
btnGenerate.addEventListener("click", () => {
  const url = affiliateUrlInput.value.trim();

  if (!url) {
    setStatus("error", "링크를 입력해주세요.");
    return;
  }
  if (!isValidUrl(url)) {
    setStatus("error", "올바른 HTTPS 링크를 입력해주세요.");
    return;
  }

  btnGenerate.disabled = true;
  btnPost.classList.add("hidden");
  previewWrap.classList.add("hidden");
  generatedPosting = null;

  showProgress(5, "상품 페이지 이동 중...");
  setStatus("info", "처리 중...");

  chrome.runtime.sendMessage(
    { type: "GENERATE_FROM_URL", payload: { url } },
    (result) => {
      if (chrome.runtime.lastError || !result?.success) {
        setStatus("error", result?.error || "오류가 발생했습니다.");
        btnGenerate.disabled = false;
        hideProgress();
      }
      // 이후 진행 상황은 POSTING_PROGRESS / GENERATE_DONE / ERROR 메시지로 수신
    }
  );
});

// ---- 블로그에 올리기 버튼 ----
btnPost.addEventListener("click", () => {
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

// ---- service worker에서 오는 진행 상황 수신 ----
chrome.runtime.onMessage.addListener((message, sender) => {
  if (sender.id !== chrome.runtime.id) return;
  if (!ALLOWED_MESSAGE_TYPES.includes(message.type)) return;
  if (!message.payload || typeof message.payload !== "object") return;

  if (message.type === "POSTING_PROGRESS") {
    showProgress(Number(message.payload.percent) || 0, String(message.payload.text || ""));
  }

  if (message.type === "GENERATE_DONE") {
    generatedPosting = message.payload.posting;
    showProgress(100, "포스팅 생성 완료!");
    setStatus("success", "포스팅이 생성되었습니다. 확인 후 블로그에 올려주세요.");
    showPreview(message.payload.posting);
    btnPost.classList.remove("hidden");
    btnGenerate.disabled = false;
  }

  if (message.type === "POSTING_DONE") {
    showProgress(100, "블로그 포스팅 완료!");
    setStatus("success", "블로그에 성공적으로 포스팅되었습니다!");
    btnPost.disabled = false;
  }

  if (message.type === "ERROR") {
    setStatus("error", String(message.payload.message || "오류가 발생했습니다."));
    btnGenerate.disabled = false;
    btnPost.disabled = false;
    hideProgress();
  }
});

// ---- 유틸 (textContent 사용 — XSS 방지) ----
function setStatus(type, message) {
  statusEl.className = `status ${type}`;
  statusEl.textContent = String(message);
  statusEl.classList.remove("hidden");
}

function showProgress(percent, text) {
  progressWrap.classList.remove("hidden");
  progressFill.style.width = `${Math.min(100, Math.max(0, Number(percent)))}%`;
  progressText.textContent = String(text);
}

function hideProgress() {
  progressWrap.classList.add("hidden");
}

// ---- 미리보기 렌더링 ----
function showPreview(posting) {
  if (!posting) return;

  previewTitle.textContent = String(posting.title || "");

  previewTags.textContent = "";
  (posting.tags || []).forEach((tag) => {
    const span = document.createElement("span");
    span.className = "preview-tag";
    span.textContent = "#" + String(tag);
    previewTags.appendChild(span);
  });

  previewSections.textContent = "";
  (posting.sections || []).forEach((section, i) => {
    const div = document.createElement("div");
    if (section.type === "image") {
      div.className = "preview-section-image";
      div.textContent = `📷 이미지 ${i + 1}`;
    } else {
      div.className = "preview-section-text";
      const content = String(section.content || "");
      div.textContent = content.slice(0, 200) + (content.length > 200 ? "…" : "");
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
