// naverblog.js — 네이버 블로그 스마트에디터 ONE 자동 포스팅 content script

// service worker에서 오는 메시지만 허용 (sender.tab이 없으면 service worker)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.tab) return; // 다른 content script 차단
  if (message.type !== "DO_POSTING") return;
  if (!message.payload?.posting || typeof message.payload.posting !== "object") return;

  // 채널이 닫히기 전에 즉시 응답 — 이후 진행은 runtime.sendMessage로 전달
  sendResponse({ success: true });
  handlePosting(message.payload.posting);
});

// ============================================================
// 메인 포스팅 흐름
// ============================================================
async function handlePosting(posting) {
  try {
    sendProgress(5, "에디터 초기화 중...");

    // 에디터 iframe 안 document 가져오기
    const editorDoc = await waitForEditorDocument();

    sendProgress(10, "제목 입력 중...");
    await setTitle(editorDoc, String(posting.title || "").slice(0, 100));
    await sleep(400);

    // 에디터 contenteditable 영역 찾기
    const editorEl = getContentEditable(editorDoc);
    if (!editorEl) throw new Error("에디터 입력 영역을 찾을 수 없습니다.");

    editorEl.focus();
    await sleep(300);

    const sections = Array.isArray(posting.sections) ? posting.sections : [];
    const total = sections.length;

    for (let i = 0; i < total; i++) {
      const section = sections[i];
      const percent = 15 + Math.round((i / total) * 70);

      if (section.type === "text" && typeof section.content === "string") {
        sendProgress(percent, `텍스트 입력 중... (${i + 1}/${total})`);
        await typeText(editorEl, section.content);
        // 단락 구분
        editorEl.focus();
        document.execCommand("insertParagraph", false);
        await sleep(200);
      } else if (section.type === "image" && typeof section.content === "string") {
        sendProgress(percent, `이미지 삽입 중... (${i + 1}/${total})`);
        const ok = await insertImage(editorEl, section.content);
        if (!ok) {
          // 이미지 실패 시 대체 텍스트 삽입 후 계속 진행
          editorEl.focus();
          document.execCommand("insertText", false, "[이미지 삽입 실패]");
        }
        await sleep(1500); // 이미지 업로드 처리 대기
        editorEl.focus();
        document.execCommand("insertParagraph", false);
        await sleep(300);
      }
    }

    sendProgress(90, "태그 입력 중...");
    await setTags(editorDoc, Array.isArray(posting.tags) ? posting.tags : []);
    await sleep(400);

    sendProgress(100, "포스팅 완료!");
    chrome.runtime.sendMessage({ type: "POSTING_DONE", payload: {} });
  } catch (err) {
    chrome.runtime.sendMessage({
      type: "ERROR",
      payload: { message: String(err.message || "자동 포스팅 중 오류 발생") },
    });
  }
}

// ============================================================
// 에디터 document 가져오기 (mainFrame iframe 대응)
// ============================================================
async function waitForEditorDocument(timeoutMs = 20000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    // 1. mainFrame iframe 시도 (네이버 블로그 글쓰기 구조)
    const iframe = document.querySelector('iframe[name="mainFrame"]');
    if (iframe) {
      const iDoc = iframe.contentDocument;
      if (iDoc && iDoc.readyState === "complete" && getContentEditable(iDoc)) {
        return iDoc;
      }
    }

    // 2. 현재 document에 직접 에디터가 있는 경우 (SPA 구조)
    if (getContentEditable(document)) return document;

    await sleep(500);
  }

  throw new Error("에디터 로딩 타임아웃 (20초 초과)");
}

// ============================================================
// contenteditable 에디터 영역 찾기
// ============================================================
function getContentEditable(doc) {
  // 스마트에디터 ONE 선택자 우선순위 순
  const selectors = [
    ".se-main-container [contenteditable='true']",
    ".se-section [contenteditable='true']",
    ".se-component-content [contenteditable='true']",
    "[contenteditable='true']",
  ];

  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    if (el) return el;
  }
  return null;
}

// ============================================================
// 제목 입력
// ============================================================
async function setTitle(doc, title) {
  const selectors = [
    "input#subject",
    "input[placeholder*='제목']",
    ".se-title-input input",
    "input[name='subject']",
  ];

  let titleInput = null;
  for (const sel of selectors) {
    titleInput = doc.querySelector(sel);
    if (titleInput) break;
  }

  if (!titleInput) {
    // 외부 document(top frame)에서도 시도
    for (const sel of selectors) {
      titleInput = document.querySelector(sel);
      if (titleInput) break;
    }
  }

  if (!titleInput) return; // 제목 입력란 없으면 skip (구조 변경 대비)

  titleInput.focus();
  titleInput.value = "";
  titleInput.dispatchEvent(new Event("input", { bubbles: true }));
  await sleep(100);

  // 한 글자씩 입력 (더 자연스럽게)
  for (const char of title) {
    titleInput.value += char;
    titleInput.dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(30 + Math.random() * 50);
  }

  titleInput.dispatchEvent(new Event("change", { bubbles: true }));
  await sleep(200);
}

// ============================================================
// 텍스트 한 글자씩 타이핑
// ============================================================
async function typeText(editorEl, text) {
  editorEl.focus();
  // 청크 단위로 입력 (너무 느리지 않게, 문자 단위 딜레이)
  for (const char of text) {
    document.execCommand("insertText", false, char);
    await sleep(20 + Math.random() * 40); // 20~60ms 랜덤 딜레이
  }
}

// ============================================================
// 이미지 삽입 (DataTransfer drop 방식)
// ============================================================
async function insertImage(editorEl, imageUrl) {
  try {
    // 이미지 fetch → Blob → File
    const res = await fetch(imageUrl, { credentials: "omit" });
    if (!res.ok) return false;

    const blob = await res.blob();

    // MIME 타입 검증 (허용: jpeg, png, webp, gif)
    const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!ALLOWED_MIME.includes(blob.type)) return false;

    const ext = blob.type.split("/")[1] || "jpg";
    const file = new File([blob], `image.${ext}`, { type: blob.type });

    // DataTransfer 생성 후 drop 이벤트로 에디터에 삽입
    const dt = new DataTransfer();
    dt.items.add(file);

    editorEl.focus();

    const dropEvent = new DragEvent("drop", {
      bubbles: true,
      cancelable: true,
      dataTransfer: dt,
    });
    editorEl.dispatchEvent(dropEvent);

    // paste 방식도 함께 시도 (에디터에 따라 다르게 동작)
    await sleep(300);
    const pasteEvent = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: dt,
    });
    editorEl.dispatchEvent(pasteEvent);

    return true;
  } catch {
    return false;
  }
}

// ============================================================
// 태그 입력
// ============================================================
async function setTags(doc, tags) {
  if (!tags.length) return;

  const selectors = [
    "input.tag_input",
    "input[placeholder*='태그']",
    ".se_tags input",
    "input[data-type='tag']",
  ];

  let tagInput = null;
  for (const sel of selectors) {
    tagInput = doc.querySelector(sel) || document.querySelector(sel);
    if (tagInput) break;
  }

  if (!tagInput) return;

  for (const tag of tags.slice(0, 10)) {
    tagInput.focus();
    const safeTag = String(tag).slice(0, 30).replace(/,/g, "");

    for (const char of safeTag) {
      tagInput.value += char;
      tagInput.dispatchEvent(new Event("input", { bubbles: true }));
      await sleep(30 + Math.random() * 40);
    }

    // 쉼표 또는 Enter로 태그 확정
    tagInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, bubbles: true }));
    tagInput.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", keyCode: 13, bubbles: true }));
    await sleep(200);
    tagInput.value = "";
  }
}

// ============================================================
// 유틸
// ============================================================
function sendProgress(percent, text) {
  chrome.runtime.sendMessage({
    type: "POSTING_PROGRESS",
    payload: {
      percent: Math.min(100, Math.max(0, Number(percent))),
      text: String(text),
    },
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
