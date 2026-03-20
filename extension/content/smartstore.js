// smartstore.js — 스마트스토어 데이터 수집 content script

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "COLLECT_SHOPPING") return;

  // affiliateUrl 타입 및 형식 검증
  const affiliateUrl = typeof message.affiliateUrl === "string" ? message.affiliateUrl.trim() : "";
  if (affiliateUrl) {
    try {
      const u = new URL(affiliateUrl);
      if (u.protocol !== "https:") {
        sendResponse({ success: false, error: "제휴 링크는 HTTPS만 허용됩니다." });
        return;
      }
      if (!u.hostname.endsWith("naver.com") && !u.hostname.endsWith("naver.me")) {
        sendResponse({ success: false, error: "네이버 제휴 링크만 허용됩니다." });
        return;
      }
    } catch {
      sendResponse({ success: false, error: "유효하지 않은 제휴 링크입니다." });
      return;
    }
  }

  collectShoppingData(affiliateUrl)
    .then((data) => sendResponse({ success: true, data }))
    .catch((err) => sendResponse({ success: false, error: String(err.message) }));

  return true;
});

// ============================================================
// 메인 수집 함수
// ============================================================
function sendProgress(percent, text) {
  chrome.runtime.sendMessage({
    type: "POSTING_PROGRESS",
    payload: { percent, text },
  }).catch(() => {});
}

async function collectShoppingData(affiliateUrl) {
  // 페이지가 완전히 로드될 때까지 대기
  sendProgress(32, "상품 정보 로딩 대기 중...");
  await waitForElement('[class*="productTitle"], h3[class*="title"], ._2-I30XS1lA', 10000);

  sendProgress(36, "상품 정보 추출 중...");
  const productName = getProductName();
  const price = getPrice();
  const seller = getSeller();
  const mainImages = getMainImages();
  const shipping = getShipping();

  // 리뷰 탭 클릭 후 수집
  sendProgress(42, "리뷰 수집 중...");
  await clickReviewTab();
  // 리뷰 탭 콘텐츠 로드 대기 (최대 5초)
  await waitForElement(
    "[class*='reviewContent'], [class*='review_list'], [class*='reviewList'], [class*='ReviewList'], ul[class*='review']",
    5000
  );
  await sleep(500);
  const reviews = await collectReviews();

  // 상세 페이지 이미지 수집 (스크롤 후 iframe 포함)
  sendProgress(50, "이미지 수집 중...");
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
    affiliateUrl, // 팝업에서 사용자가 입력한 제휴 링크
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
  // <a> 태그 제외 — 클릭 시 페이지 이동 가능성 있음, button만 허용
  const candidates = document.querySelectorAll(
    "[class*='reviewTab'] button, [class*='tab'] button, li[class*='tab'] button, button[class*='tab'], button"
  );
  for (const el of candidates) {
    const text = el.textContent?.trim() || "";
    if (text === "리뷰" || text.startsWith("리뷰")) {
      el.click();
      return;
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
  const ratingSelectors = [
    "[class*='reviewScore'] strong",
    "[class*='ratingScore']",
    "[class*='averageScore']",
    "[class*='starScore']",
    "[class*='totalScore']",
    "[class*='review'][class*='score']",
    "[class*='rating'][class*='average']",
  ];
  for (const sel of ratingSelectors) {
    const el = document.querySelector(sel);
    if (el?.textContent) {
      const match = el.textContent.match(/[\d.]+/);
      if (match && parseFloat(match[0]) > 0) {
        reviewData.rating = parseFloat(match[0]);
        break;
      }
    }
  }

  // 리뷰 수
  const countSelectors = [
    "[class*='reviewCount']",
    "[class*='totalCount']",
    "[class*='review'][class*='count']",
    "[class*='total'][class*='review']",
    "[class*='_1fsC93FWsJ']",
  ];
  for (const sel of countSelectors) {
    const el = document.querySelector(sel);
    if (el?.textContent) {
      const match = el.textContent.replace(/,/g, "").match(/\d+/);
      if (match) {
        reviewData.count = parseInt(match[0]);
        break;
      }
    }
  }

  // 리뷰 영역 탐색
  const reviewAreaSelectors = [
    "[class*='reviewContent']",
    "[class*='review_list']",
    "[class*='reviewList']",
    "[class*='ReviewList']",
    "[class*='review-list']",
    "ul[class*='review']",
    "[class*='review'][class*='wrap']",
    "[class*='review'][class*='area']",
    "[class*='review'][class*='container']",
  ];

  let reviewArea = null;
  for (const sel of reviewAreaSelectors) {
    reviewArea = document.querySelector(sel);
    if (reviewArea) break;
  }

  const highlights = [];
  if (reviewArea) {
    for (let page = 0; page < 3; page++) {
      const reviewTexts = collectReviewTextsOnPage(reviewArea);
      highlights.push(...reviewTexts);

      const nextBtn = reviewArea.querySelector(
        "button[class*='next']:not(:disabled), button[class*='Next']:not(:disabled)"
      ) || document.querySelector(
        "[class*='reviewPagination'] button[class*='next']:not(:disabled), " +
        "[class*='pagination'] button[class*='next']:not(:disabled)"
      );
      if (!nextBtn) break;
      nextBtn.click();
      await sleep(1000);
    }
  }

  reviewData.highlights = [...new Set(highlights)].slice(0, 10);
  return reviewData;
}

function collectReviewTextsOnPage(reviewArea) {
  const root = reviewArea || document;

  const selectors = [
    "[class*='review_content'] p",
    "[class*='reviewContent'] p",
    "[class*='review'] [class*='text'] p",
    "[class*='review'] [class*='content'] p",
    "[class*='reviewText']",
    "[class*='review_text']",
    "li[class*='review'] p",
    "[class*='reviewItem'] p",
    "[class*='review'] p",
  ];

  const texts = [];
  for (const sel of selectors) {
    root.querySelectorAll(sel).forEach((el) => {
      const text = el.textContent?.trim();
      if (text && text.length > 10 && text.length < 1000) texts.push(text);
    });
    if (texts.length > 0) break;
  }

  // 최후 수단: li 내부에서 충분히 긴 텍스트
  if (texts.length === 0) {
    root.querySelectorAll("li").forEach((li) => {
      const el = li.querySelector("p, span");
      const text = el?.textContent?.trim();
      if (text && text.length > 10 && text.length < 1000) texts.push(text);
    });
  }

  return texts;
}

// ============================================================
// 유틸
// ============================================================
const TRUSTED_IMAGE_DOMAINS = ["pstatic.net", "naver.net", "naver.com"];
const VALID_IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp"];
const BLOCKED_KEYWORDS = ["icon", "logo", "banner_", "btn_", "sprite"];

function isValidImage(url) {
  if (!url || typeof url !== "string" || url.startsWith("data:")) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const isTrusted = TRUSTED_IMAGE_DOMAINS.some((d) => u.hostname.endsWith(d));
    if (!isTrusted) return false;
    const lower = u.pathname.toLowerCase();
    const hasValidExt = VALID_IMAGE_EXTS.some((ext) => lower.includes(ext));
    const isBlocked = BLOCKED_KEYWORDS.some((kw) => lower.includes(kw));
    return hasValidExt && !isBlocked;
  } catch {
    return false;
  }
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
  return new Promise((resolve) => {
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
