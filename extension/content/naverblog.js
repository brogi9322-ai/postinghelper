// naverblog.js — 네이버 블로그 스마트에디터 ONE 자동 포스팅 content script
// 입력 방식: chrome.debugger의 Input.insertText (신뢰된 이벤트) + 이미지는 클립보드 Ctrl+V

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.tab) return;
  if (message.type !== "DO_POSTING") return;
  if (!message.payload?.posting || typeof message.payload.posting !== "object") return;

  sendResponse({ success: true });
  handlePosting(message.payload.posting);
});

// ============================================================
// 메인 포스팅 흐름
// ============================================================
async function handlePosting(posting) {
  try {
    sendProgress(5, "에디터 초기화 중...");
    const { doc: editorDoc, win: editorWin } = await waitForEditorDocument();

    // 제목 입력
    sendProgress(10, "제목 입력 중...");
    await setTitle(editorDoc, editorWin, String(posting.title || "").slice(0, 100));
    await sleep(500);

    // 본문 첫 단락으로 커서 이동
    const bodyNode = getBodyNode(editorDoc);
    if (!bodyNode) throw new Error("본문 영역을 찾을 수 없습니다.");
    focusWithSelection(bodyNode, editorDoc, editorWin);
    await sleep(400);

    const sections = Array.isArray(posting.sections) ? posting.sections : [];
    const total = sections.length;

    for (let i = 0; i < total; i++) {
      const section = sections[i];
      const percent = 15 + Math.round((i / total) * 70);

      if (section.type === "text" && typeof section.content === "string") {
        sendProgress(percent, `텍스트 입력 중... (${i + 1}/${total})`);
        await typeCharByChar(section.content);
        await sleep(100);
        await cdpPressEnter();
        await sleep(200);

      } else if (section.type === "image" && typeof section.content === "string") {
        sendProgress(percent, `이미지 삽입 중... (${i + 1}/${total})`);
        const ok = await insertImageViaClipboard(editorDoc, editorWin, section.content);
        if (!ok) {
          await cdpInsertText("[이미지]");
        }
        await sleep(1500);
        await cdpPressEnter();
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
// 에디터 document + window 가져오기
// ============================================================
async function waitForEditorDocument(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const iframes = document.querySelectorAll("iframe");
    for (const iframe of iframes) {
      try {
        const iDoc = iframe.contentDocument;
        if (iDoc && iDoc.readyState === "complete" && getBodyNode(iDoc)) {
          return { doc: iDoc, win: iframe.contentWindow };
        }
      } catch { /* cross-origin 무시 */ }
    }
    if (getBodyNode(document)) {
      return { doc: document, win: window };
    }
    await sleep(500);
  }
  throw new Error("에디터 로딩 타임아웃 (20초 초과)");
}

// ============================================================
// 본문 __se-node 찾기 (제목 섹션 제외)
// ============================================================
function getBodyNode(doc) {
  const nodes = doc.querySelectorAll(".__se-node");
  for (const node of nodes) {
    if (!node.closest(".se-section-documentTitle")) return node;
  }
  return null;
}

// ============================================================
// 포커스 + selection 끝으로 이동
// ============================================================
function focusWithSelection(el, doc, win) {
  el.focus();
  try {
    const sel = win.getSelection();
    const range = doc.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  } catch { /* ignore */ }
}

// ============================================================
// 제목 입력
// ============================================================
async function setTitle(editorDoc, editorWin, title) {
  // contenteditable 전체 div를 포커스하고 커서를 제목 __se-node 첫 위치로 이동
  const titleNode = editorDoc.querySelector(".se-section-documentTitle .__se-node");
  const ce = editorDoc.querySelector("[contenteditable='true']");
  const focusTarget = ce || titleNode;
  if (!focusTarget) return;

  focusTarget.focus();
  try {
    const sel = editorWin.getSelection();
    const range = editorDoc.createRange();
    const anchor = titleNode || focusTarget;
    range.setStart(anchor, 0);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  } catch { /* ignore */ }

  await sleep(150);
  await typeCharByChar(title);
  await sleep(200);
}

// ============================================================
// 이미지 삽입 — 클립보드 + Ctrl+V (Smart Editor ONE이 자체 처리)
// ============================================================
async function insertImageViaClipboard(editorDoc, editorWin, imageUrl) {
  try {
    const res = await fetch(imageUrl, { credentials: "omit" });
    if (!res.ok) return false;

    const blob = await res.blob();
    const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!ALLOWED_MIME.includes(blob.type)) return false;

    // 클립보드는 image/png만 안정적으로 지원
    const pngBlob = await convertToPng(blob);
    await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
    await sleep(100);

    // 본문에 포커스 후 Ctrl+V
    const bodyNode = getBodyNode(editorDoc);
    if (bodyNode) focusWithSelection(bodyNode, editorDoc, editorWin);
    await sleep(100);

    await cdpPressCtrlV();
    return true;
  } catch {
    return false;
  }
}

async function convertToPng(blob) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d").drawImage(img, 0, 0);
      canvas.toBlob((pngBlob) => {
        URL.revokeObjectURL(url);
        resolve(pngBlob || blob);
      }, "image/png");
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(blob); };
    img.src = url;
  });
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
// CDP 헬퍼 — 서비스 워커에 요청해서 신뢰된 이벤트 발생
// ============================================================

// 한 글자씩 100ms 간격으로 타이핑 (약 10글자/초)
// \n은 Enter 키로 처리하여 실제 단락 나눔
async function typeCharByChar(text) {
  for (const char of text) {
    if (char === "\n") {
      await cdpPressEnter();
    } else {
      await cdpInsertText(char);
    }
    await sleep(100);
  }
}

function cdpInsertText(text) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "CDP_INSERT_TEXT", payload: { text } }, resolve);
  });
}

function cdpPressKey(key, code, keyCode, modifiers = 0) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "CDP_PRESS_KEY", payload: { key, code, keyCode, modifiers } }, resolve);
  });
}

function cdpPressEnter() {
  return cdpPressKey("Enter", "Enter", 13, 0);
}

function cdpPressCtrlV() {
  return cdpPressKey("v", "KeyV", 86, 2); // modifiers: 2 = Ctrl
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
