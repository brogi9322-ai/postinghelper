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

    // 에디터 document + window 가져오기 (iframe 대응)
    const { doc: editorDoc, win: editorWin } = await waitForEditorDocument();

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
        await typeText(editorEl, editorDoc, section.content);
        editorEl.focus();
        editorDoc.execCommand("insertParagraph", false);
        await sleep(200);
      } else if (section.type === "image" && typeof section.content === "string") {
        sendProgress(percent, `이미지 삽입 중... (${i + 1}/${total})`);
        const ok = await insertImage(editorEl, editorDoc, editorWin, section.content);
        if (!ok) {
          editorEl.focus();
          editorDoc.execCommand("insertText", false, "[이미지 삽입 실패]");
        }
        await sleep(1500);
        editorEl.focus();
        editorDoc.execCommand("insertParagraph", false);
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
// 에디터 document + window 가져오기 (iframe 대응)
// ============================================================
async function waitForEditorDocument(timeoutMs = 20000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    // 1. iframe 탐색 (name="mainFrame" 또는 기타 iframe)
    const iframes = document.querySelectorAll("iframe");
    for (const iframe of iframes) {
      try {
        const iDoc = iframe.contentDocument;
        if (iDoc && iDoc.readyState === "complete" && getContentEditable(iDoc)) {
          return { doc: iDoc, win: iframe.contentWindow };
        }
      } catch { /* cross-origin iframe 무시 */ }
    }

    // 2. 현재 document에 직접 에디터가 있는 경우
    if (getContentEditable(document)) {
      return { doc: document, win: window };
    }

    await sleep(500);
  }

  throw new Error("에디터 로딩 타임아웃 (20초 초과)");
}

// ============================================================
// contenteditable 에디터 영역 찾기
// ============================================================
function getContentEditable(doc) {
  const selectors = [
    ".se-main-container [contenteditable='true']",
    ".se-section [contenteditable='true']",
    ".se-component-content [contenteditable='true']",
    ".se-content[contenteditable='true']",
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
async function setTitle(editorDoc, title) {
  const selectors = [
    "input#subject",
    "input[placeholder*='제목']",
    ".se-title-input input",
    "input[name='subject']",
  ];

  let titleInput = null;
  // iframe 안에서 먼저 시도
  for (const sel of selectors) {
    titleInput = editorDoc.querySelector(sel);
    if (titleInput) break;
  }
  // 외부 document(top frame)에서도 시도
  if (!titleInput) {
    for (const sel of selectors) {
      titleInput = document.querySelector(sel);
      if (titleInput) break;
    }
  }

  if (!titleInput) return;

  titleInput.focus();
  titleInput.value = "";
  titleInput.dispatchEvent(new Event("input", { bubbles: true }));
  await sleep(100);

  for (const char of title) {
    titleInput.value += char;
    titleInput.dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(30 + Math.random() * 50);
  }

  titleInput.dispatchEvent(new Event("change", { bubbles: true }));
  await sleep(200);
}

// ============================================================
// 텍스트 한 글자씩 타이핑 — editorDoc.execCommand 사용
// ============================================================
async function typeText(editorEl, editorDoc, text) {
  editorEl.focus();
  for (const char of text) {
    editorDoc.execCommand("insertText", false, char);
    await sleep(20 + Math.random() * 40);
  }
}

// ============================================================
// 이미지 삽입 — iframe의 window/DragEvent 사용
// ============================================================
async function insertImage(editorEl, editorDoc, editorWin, imageUrl) {
  try {
    const res = await fetch(imageUrl, { credentials: "omit" });
    if (!res.ok) return false;

    const blob = await res.blob();

    const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!ALLOWED_MIME.includes(blob.type)) return false;

    const ext = blob.type.split("/")[1] || "jpg";
    const file = new File([blob], `image.${ext}`, { type: blob.type });

    const dt = new DataTransfer();
    dt.items.add(file);

    editorEl.focus();

    // iframe의 window로 이벤트 생성 (외부 window면 에디터가 인식 못함)
    const DragEventCtor = editorWin.DragEvent || DragEvent;
    const ClipboardEventCtor = editorWin.ClipboardEvent || ClipboardEvent;

    const dropEvent = new DragEventCtor("drop", {
      bubbles: true,
      cancelable: true,
      dataTransfer: dt,
    });
    editorEl.dispatchEvent(dropEvent);

    await sleep(300);

    const pasteEvent = new ClipboardEventCtor("paste", {
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
async function setTags(editorDoc, tags) {
  if (!tags.length) return;

  const selectors = [
    "input.tag_input",
    "input[placeholder*='태그']",
    ".se_tags input",
    "input[data-type='tag']",
  ];

  let tagInput = null;
  for (const sel of selectors) {
    tagInput = editorDoc.querySelector(sel) || document.querySelector(sel);
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
