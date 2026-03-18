// navermap.js — 네이버 지도 데이터 수집 content script
// Sprint 6에서 실제 DOM 선택자 채워넣을 것

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "COLLECT_PLACE") return;

  try {
    const data = collectPlaceData();
    sendResponse({ success: true, data });
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }

  return true;
});

function collectPlaceData() {
  // TODO Sprint 6: 실제 네이버 지도 DOM 선택자로 교체
  return {
    name: "",
    category: "",
    address: "",
    hours: "",
    menu: [],
    reviews: { rating: 0, count: 0, highlights: [] },
    images: [],
    url: window.location.href,
  };
}
