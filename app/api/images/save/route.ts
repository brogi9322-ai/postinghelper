import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { withCors, handleOptions } from "@/lib/cors";
import type { ImageSaveRequest, ImageSaveResponse } from "@/types";

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}

// 허용된 이미지 도메인 (네이버 공식 도메인만 허용 — SSRF 방지)
const ALLOWED_DOMAINS = [
  "pstatic.net",
  "naver.net",
  "naver.com",
  "smartstore.naver.com",
  "brand.naver.com",
];

// 허용된 MIME 타입
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function validateImageUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`유효하지 않은 URL: ${url}`);
  }

  // https만 허용 (http, javascript, data 등 차단)
  if (parsed.protocol !== "https:") {
    throw new Error(`HTTPS URL만 허용됩니다: ${url}`);
  }

  // 내부 네트워크 및 메타데이터 서버 차단 (SSRF 방지)
  const blockedHosts = [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "169.254.169.254", // AWS 메타데이터
    "metadata.google.internal", // GCP 메타데이터
  ];
  if (blockedHosts.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`))) {
    throw new Error(`차단된 호스트: ${parsed.hostname}`);
  }

  // 내부 IP 대역 차단
  const privateIpPattern = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/;
  if (privateIpPattern.test(parsed.hostname)) {
    throw new Error(`내부 IP 접근 차단: ${parsed.hostname}`);
  }

  // 허용된 도메인만 통과
  const isAllowed = ALLOWED_DOMAINS.some((d) => parsed.hostname.endsWith(d));
  if (!isAllowed) {
    throw new Error(`허용되지 않은 도메인: ${parsed.hostname}`);
  }
}

export async function POST(req: NextRequest) {
  const body: ImageSaveRequest = await req.json();

  if (!body.urls || !Array.isArray(body.urls) || body.urls.length === 0) {
    return NextResponse.json({ error: "이미지 URL이 없습니다." }, { status: 400 });
  }

  // 최대 이미지 수 제한 (DoS 방지)
  if (body.urls.length > 50) {
    return NextResponse.json({ error: "이미지는 최대 50개까지 처리 가능합니다." }, { status: 400 });
  }

  const savedUrls: string[] = [];

  for (const url of body.urls) {
    // 타입 검증
    if (typeof url !== "string") {
      savedUrls.push("");
      continue;
    }

    // URL 보안 검증 (SSRF 방지)
    try {
      validateImageUrl(url);
    } catch (err) {
      console.warn("URL 검증 실패:", err);
      savedUrls.push("");
      continue;
    }

    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "PostingHelper/1.0" },
        signal: AbortSignal.timeout(10000), // 10초 타임아웃
      });

      if (!res.ok) {
        savedUrls.push("");
        continue;
      }

      const blob = await res.blob();

      // MIME 타입 검증 (Content-Type 스푸핑 대비)
      if (!ALLOWED_MIME_TYPES.includes(blob.type)) {
        console.warn("허용되지 않은 MIME 타입:", blob.type);
        savedUrls.push("");
        continue;
      }

      // 파일 크기 제한 (10MB)
      if (blob.size > 10 * 1024 * 1024) {
        console.warn("이미지 크기 초과:", blob.size);
        savedUrls.push("");
        continue;
      }

      const ext = blob.type.split("/")[1].replace("jpeg", "jpg");
      const filename = `posting-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { url: savedUrl } = await put(filename, blob, { access: "public" });
      savedUrls.push(savedUrl);
    } catch (err) {
      console.warn("이미지 저장 실패:", err);
      savedUrls.push("");
    }
  }

  return withCors(NextResponse.json({ savedUrls } satisfies ImageSaveResponse));
}
