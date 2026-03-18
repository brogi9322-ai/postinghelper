// smartstore.js — 스마트스토어 데이터 수집 content script

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "COLLECT_SHOPPING") return;

  collectShoppingData()
    .then((data) => sendResponse({ success: true, data }))
    .catch((err) => sendResponse({ success: false, error: err.message }));

  return true; // 비동기 응답 유지
});

// ============================================================
// 메인 수집 함수
// ============================================================
async function collectShoppingData() {
  // 페이지가 완전히 로드될 때까지 대기
  await waitForElement('[class*="productTitle"], h3[class*="title"], ._2-I30XS1lA', 10000);

  const productName = getProductName();
  const price = getPrice();
  const seller = getSeller();
  const mainImages = getMainImages();
  const shipping = getShipping();

  // 리뷰 탭 클릭 후 수집
  await clickReviewTab();
  await sleep(1500);
  const reviews = await collectReviews();

  // 상세 페이지 이미지 수집 (스크롤 후 iframe 포함)
  const detailImages = await collectDetailImages();

  const allImages = [...new Set([...mainImages, ...detailImages])];

  return {
    productName,
    price,
    description: getDescription(),
    images: allImages,
    reviews,
    shipping,
    seller,
    url: window.location.href,
  };
}

// ============================================================
// 상품명
// ============================================================
function getProductName() {
  const selectors = [
    "._2-I30XS1lA",           // 구버전
    "[class*='productTitle']", // 신버전
    "h3[class*='_']",
    ".product_title",
    "h2.product-name",
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el?.textContent?.trim()) return el.textContent.trim();
  }
  return document.title.split(" : ")[0] || "";
}

// ============================================================
// 가격 (정가 / 할인가)
// ============================================================
function getPrice() {
  // 할인가
  const discountedSelectors = [
    "[class*='price'] [class*='sale']",
    "[class*='salePrice']",
    "[class*='finalPrice']",
    "strong[class*='price']",
    "[class*='_1LY7DqCnwR']", // 알려진 클래스
  ];
  // 정가
  const originalSelectors = [
    "[class*='price'] [class*='origin']",
    "[class*='originPrice']",
    "del[class*='price']",
    "s[class*='price']",
  ];

  const discounted = extractPrice(discountedSelectors);
  const original = extractPrice(originalSelectors);

  return { original: original || null, discounted: discounted || 0 };
}

function extractPrice(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el?.textContent) {
      const match = el.textContent.replace(/,/g, "").match(/\d+/);
      if (match) return parseInt(match[0]);
    }
  }
  return null;
}

// ============================================================
// 판매자 (스토어명)
// ============================================================
function getSeller() {
  const selectors = [
    "[class*='storeName']",
    "[class*='sellerName']",
    "a[href*='smartstore.naver.com'][class*='name']",
    "[class*='_3TzPt_fMpz']",
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el?.textContent?.trim()) return el.textContent.trim();
  }
  return "";
}

// ============================================================
// 배송 정보
// ============================================================
function getShipping() {
  const selectors = [
    "[class*='deliveryFee']",
    "[class*='shipping']",
    "[class*='delivery'] strong",
    "dt:has(+ dd[class*='ship'])",
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el?.textContent?.trim()) return el.textContent.trim();
  }
  return "";
}

// ============================================================
// 간단한 상품 설명 (상단 요약 텍스트)
// ============================================================
function getDescription() {
  const selectors = [
    "[class*='productSummary']",
    "[class*='product_summary']",
    "[class*='summary']",
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el?.textContent?.trim()) return el.textContent.trim();
  }
  return "";
}

// ============================================================
// 대표 이미지 (슬라이더)
// ============================================================
function getMainImages() {
  const selectors = [
    "[class*='thumbnail'] img",
    "[class*='mainImage'] img",
    "[class*='productImage'] img",
    "[class*='_1bhKm-iHqv'] img",
    ".product-images img",
  ];

  const urls = new Set();

  for (const sel of selectors) {
    document.querySelectorAll(sel).forEach((img) => {
      const src = img.src || img.dataset.src || img.getAttribute("data-lazy-src");
      if (src && isValidImage(src)) urls.add(normalizeImageUrl(src));
    });
  }

  return [...urls].slice(0, 10); // 최대 10개
}

// ============================================================
// 상세 페이지 이미지 (스크롤 후 iframe 포함)
// ============================================================
async function collectDetailImages() {
  const urls = new Set();

  // 상세 탭으로 이동 (이미 있는 경우)
  const detailTab = document.querySelector(
    "[class*='tabItem']:nth-child(1), [data-tab='detail'], button[class*='_2pgHN-ntx6']:first-child"
  );
  if (detailTab) {
    detailTab.click();
    await sleep(1000);
  }

  // 상세 컨테이너 스크롤하여 이미지 로드
  const detailContainer = document.querySelector(
    "[class*='productDetail'], [class*='detail_content'], #productDetail, [class*='_3T6hUBnzAB']"
  );

  if (detailContainer) {
    // 스크롤하여 lazy load 이미지 트리거
    await scrollToLoad(detailContainer);

    detailContainer.querySelectorAll("img").forEach((img) => {
      const src = img.src || img.dataset.src || img.getAttribute("data-lazy-src") || img.getAttribute("data-original");
      if (src && isValidImage(src)) urls.add(normalizeImageUrl(src));
    });
  }

  // iframe 내부 이미지 수집
  const iframes = document.querySelectorAll("iframe[src*='detail'], iframe[id*='detail'], iframe[class*='detail']");
  for (const iframe of iframes) {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) continue;

      iframeDoc.querySelectorAll("img").forEach((img) => {
        const src = img.src || img.dataset.src || img.getAttribute("data-lazy-src");
        if (src && isValidImage(src)) urls.add(normalizeImageUrl(src));
      });
    } catch {
      // cross-origin iframe은 접근 불가 — 스킵
    }
  }

  return [...urls].slice(0, 30); // 최대 30개
}

// ============================================================
// 리뷰 수집
// ============================================================
async function clickReviewTab() {
  const reviewTabSelectors = [
    "[class*='reviewTab']",
    "button[class*='tab']:has(span:contains('리뷰'))",
    "a[class*='tab'][href*='review']",
    "[class*='_2pgHN-ntx6']:nth-child(3)",
    "li[class*='tab'] button",
  ];

  for (const sel of reviewTabSelectors) {
    const tabs = document.querySelectorAll(sel);
    for (const tab of tabs) {
      if (tab.textContent?.includes("리뷰")) {
        tab.click();
        return;
      }
    }
  }

  // 텍스트로 찾기 (fallback)
  const allButtons = document.querySelectorAll("button, a, li");
  for (const el of allButtons) {
    if (el.textContent?.trim() === "리뷰" || el.textContent?.includes("리뷰")) {
      el.click();
      break;
    }
  }
}

async function collectReviews() {
  const reviewData = {
    rating: 0,
    count: 0,
    highlights: [],
  };

  // 평점
  const ratingEl = document.querySelector(
    "[class*='reviewScore'] strong, [class*='ratingScore'], [class*='averageScore']"
  );
  if (ratingEl) {
    reviewData.rating = parseFloat(ratingEl.textContent) || 0;
  }

  // 리뷰 수
  const countEl = document.querySelector(
    "[class*='reviewCount'], [class*='totalCount'], [class*='_1fsC93FWsJ']"
  );
  if (countEl) {
    const match = countEl.textContent.replace(/,/g, "").match(/\d+/);
    if (match) reviewData.count = parseInt(match[0]);
  }

  // 최신 리뷰 텍스트 수집 (최대 3페이지)
  const highlights = [];
  for (let page = 0; page < 3; page++) {
    const reviewTexts = collectReviewTextsOnPage();
    highlights.push(...reviewTexts);

    // 다음 페이지
    const nextBtn = document.querySelector(
      "[class*='pagination'] button[class*='next']:not(:disabled), [class*='next_btn']:not([disabled])"
    );
    if (!nextBtn) break;
    nextBtn.click();
    await sleep(1000);
  }

  reviewData.highlights = [...new Set(highlights)].slice(0, 10);
  return reviewData;
}

function collectReviewTextsOnPage() {
  const selectors = [
    "[class*='reviewContent'] p",
    "[class*='review_text']",
    "[class*='_3z4jfB0L_J']",
    "[class*='review_content']",
  ];

  const texts = [];
  for (const sel of selectors) {
    document.querySelectorAll(sel).forEach((el) => {
      const text = el.textContent?.trim();
      if (text && text.length > 10) texts.push(text);
    });
    if (texts.length > 0) break;
  }

  return texts;
}

// ============================================================
// 유틸
// ============================================================
function isValidImage(url) {
  if (!url || url.startsWith("data:")) return false;
  const lower = url.toLowerCase();
  return (
    (lower.includes(".jpg") || lower.includes(".jpeg") ||
     lower.includes(".png") || lower.includes(".webp") ||
     lower.includes("pstatic.net") || lower.includes("naver.net")) &&
    !lower.includes("icon") && !lower.includes("logo") &&
    !lower.includes("banner_") && !lower.includes("btn_")
  );
}

function normalizeImageUrl(url) {
  // 네이버 이미지 고화질 파라미터 제거하여 원본 URL 확보
  try {
    const u = new URL(url, window.location.href);
    return u.origin + u.pathname;
  } catch {
    return url;
  }
}

function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);

    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (found) {
        observer.disconnect();
        resolve(found);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve(null); // timeout 시 null 반환 (실패 아님)
    }, timeout);
  });
}

async function scrollToLoad(container) {
  const scrollHeight = container.scrollHeight || document.body.scrollHeight;
  const step = window.innerHeight;
  for (let y = 0; y < scrollHeight; y += step) {
    window.scrollTo(0, y);
    await sleep(300);
  }
  window.scrollTo(0, 0);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
