import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import type { ImageSaveRequest, ImageSaveResponse } from "@/types";

export async function POST(req: NextRequest) {
  const body: ImageSaveRequest = await req.json();

  if (!body.urls || body.urls.length === 0) {
    return NextResponse.json({ error: "이미지 URL이 없습니다." }, { status: 400 });
  }

  const savedUrls: string[] = [];

  for (const url of body.urls) {
    try {
      // 원본 URL에서 이미지 다운로드
      const res = await fetch(url);
      if (!res.ok) continue;

      const blob = await res.blob();
      const ext = blob.type.split("/")[1] || "jpg";
      const filename = `posting-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      // Vercel Blob에 저장
      const { url: savedUrl } = await put(filename, blob, {
        access: "public",
      });

      savedUrls.push(savedUrl);
    } catch {
      // 실패한 이미지는 원본 URL 유지
      savedUrls.push(url);
    }
  }

  return NextResponse.json({ savedUrls } satisfies ImageSaveResponse);
}
