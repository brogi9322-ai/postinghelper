// popup.js — 팝업 UI 제어

const pageTypeEl = document.getElementById("page-type");
const statusEl = document.getElementById("status");
const progressWrap = document.getElementById("progress-wrap");
const progressFill = document.getElementById("progress-fill");
const progressText = document.getElementById("progress-text");
const btnGenerate = document.getElementById("btn-generate");
const btnPost = document.getElementById("btn-post");

let currentPageType = null; // "shopping" | "place" | null
let generatedPosting = null;

// ---- 현재 탭 URL로 페이지 종류 감지 ----
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const url = tabs[0]?.url || "";

  if (url.includes("smartstore.naver.com")) {
    currentPageType = "shopping";
    pageTypeEl.textContent = "🛍️ 스마트스토어 감지됨";
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
  setStatus("info", "데이터 수집 중...");
  showProgress(10, "페이지 데이터 수집 중...");
  btnGenerate.disabled = true;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // content script에 데이터 수집 요청
  chrome.tabs.sendMessage(
    tab.id,
    { type: currentPageType === "shopping" ? "COLLECT_SHOPPING" : "COLLECT_PLACE" },
    (response) => {
      if (chrome.runtime.lastError || !response?.success) {
        setStatus("error", "데이터 수집 실패. 페이지를 새로고침 후 다시 시도해주세요.");
        btnGenerate.disabled = false;
        hideProgress();
        return;
      }

      showProgress(40, "Claude AI가 포스팅 생성 중...");

      // background로 포스팅 생성 요청
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
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "POSTING_PROGRESS") {
    showProgress(message.payload.percent, message.payload.text);
  }
  if (message.type === "POSTING_DONE") {
    showProgress(100, "블로그 포스팅 완료!");
    setStatus("success", "블로그에 성공적으로 포스팅되었습니다!");
    btnPost.disabled = false;
  }
  if (message.type === "ERROR") {
    setStatus("error", message.payload.message);
    btnPost.disabled = false;
    hideProgress();
  }
});

// ---- 유틸 ----
function setStatus(type, message) {
  statusEl.className = `status ${type}`;
  statusEl.textContent = message;
  statusEl.classList.remove("hidden");
}

function showProgress(percent, text) {
  progressWrap.classList.remove("hidden");
  progressFill.style.width = `${percent}%`;
  progressText.textContent = text;
}

function hideProgress() {
  progressWrap.classList.add("hidden");
}
