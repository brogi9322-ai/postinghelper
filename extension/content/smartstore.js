// smartstore.js — 스마트스토어 데이터 수집 content script
// Sprint 3에서 실제 DOM 선택자 채워넣을 것

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "COLLECT_SHOPPING") return;

  try {
    const data = collectShoppingData();
    sendResponse({ success: true, data });
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }

  return true;
});

function collectShoppingData() {
  // TODO Sprint 3: 실제 스마트스토어 DOM 선택자로 교체
  return {
    productName: "",
    price: { original: null, discounted: 0 },
    description: "",
    images: [],
    reviews: { rating: 0, count: 0, highlights: [] },
    shipping: "",
    seller: "",
    url: window.location.href,
  };
}
