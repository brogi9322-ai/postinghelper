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

let generatedPosting = null;

// ============================================================
// 팝업 열릴 때 storage에서 이전 상태 복원
// ============================================================
chrome.storage.local.get(["status", "progress", "posting", "error"], (data) => {
  if (data.status === "generating") {
    btnGenerate.disabled = true;
    if (data.progress) showProgress(data.progress.percent, data.progress.text);
    setStatus("info", "처리 중... 잠시 후 다시 확인해주세요.");
  } else if (data.status === "ready" && data.posting) {
    generatedPosting = data.posting;
    if (data.progress) showProgress(data.progress.percent, data.progress.text);
    setStatus("success", "포스팅이 생성되었습니다. 확인 후 블로그에 올려주세요.");
    showPreview(data.posting);
    btnPost.classList.remove("hidden");
  } else if (data.status === "posting") {
    btnPost.disabled = true;
    if (data.progress) showProgress(data.progress.percent, data.progress.text);
    setStatus("info", "블로그에 포스팅 중...");
  } else if (data.status === "done") {
    setStatus("success", "블로그에 성공적으로 포스팅되었습니다!");
    chrome.storage.local.remove(["status", "progress", "posting", "error"]);
  } else if (data.status === "error") {
    setStatus("error", String(data.error || "오류가 발생했습니다."));
    chrome.storage.local.remove(["status", "error"]);
  }
});

// ============================================================
// storage 변경 감지 — 팝업이 열려 있는 동안 실시간 업데이트
// ============================================================
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;

  if (changes.progress?.newValue) {
    const p = changes.progress.newValue;
    showProgress(p.percent, p.text);
  }

  if (changes.status?.newValue) {
    const status = changes.status.newValue;

    if (status === "ready") {
      chrome.storage.local.get(["posting"], (data) => {
        if (data.posting) {
          generatedPosting = data.posting;
          showPreview(data.posting);
          setStatus("success", "포스팅이 생성되었습니다. 확인 후 블로그에 올려주세요.");
          btnPost.classList.remove("hidden");
          btnGenerate.disabled = false;
        }
      });
    }

    if (status === "posting") {
      btnPost.disabled = true;
    }

    if (status === "done") {
      showProgress(100, "블로그 포스팅 완료!");
      setStatus("success", "블로그에 성공적으로 포스팅되었습니다!");
      btnPost.disabled = false;
      chrome.storage.local.remove(["status", "progress", "posting", "error"]);
    }

    if (status === "error") {
      chrome.storage.local.get(["error"], (data) => {
        setStatus("error", String(data.error || "오류가 발생했습니다."));
        btnGenerate.disabled = false;
        btnPost.disabled = false;
        hideProgress();
        chrome.storage.local.remove(["status", "error"]);
      });
    }
  }
});

// ============================================================
// 포스팅 생성 버튼
// ============================================================
btnGenerate.addEventListener("click", () => {
  const url = affiliateUrlInput.value.trim();

  if (!url) {
    setStatus("error", "링크를 입력해주세요.");
    return;
  }
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") throw new Error();
  } catch {
    setStatus("error", "올바른 HTTPS 링크를 입력해주세요.");
    return;
  }

  btnGenerate.disabled = true;
  btnPost.classList.add("hidden");
  previewWrap.classList.add("hidden");
  generatedPosting = null;

  showProgress(5, "시작 중...");
  setStatus("info", "처리 중...");

  // storage 초기화
  chrome.storage.local.remove(["status", "progress", "posting", "error"]);

  chrome.runtime.sendMessage(
    { type: "GENERATE_FROM_URL", payload: { url } },
    (result) => {
      if (chrome.runtime.lastError || !result?.success) {
        setStatus("error", result?.error || "오류가 발생했습니다.");
        btnGenerate.disabled = false;
        hideProgress();
      }
    }
  );
});

// ============================================================
// 블로그에 올리기 버튼
// ============================================================
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

// ============================================================
// 유틸
// ============================================================
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

// ---- 미리보기 렌더링 (XSS 방지 — textContent/createElement만 사용) ----
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
