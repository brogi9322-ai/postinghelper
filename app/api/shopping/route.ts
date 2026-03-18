import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/claude";
import type { ShoppingRequest, PostingResponse, PostingSection } from "@/types";

// Sprint 4에서 system prompt와 tools 완성 예정
const SYSTEM_PROMPT = `당신은 쇼핑 블로그 포스팅 전문 작가입니다.
네이버 스마트스토어 상품 데이터를 바탕으로 자연스럽고 매력적인 블로그 포스팅을 작성합니다.

글 구조: 도입부 → 상품 소개 → 상세 정보 → 리뷰 요약 → 마무리
이미지 삽입 위치를 sections 배열에 명확히 지정해야 합니다.`;

export async function POST(req: NextRequest) {
  const body: ShoppingRequest = await req.json();

  if (!body.data?.productName) {
    return NextResponse.json({ error: "상품 데이터가 없습니다." }, { status: 400 });
  }

  const { data } = body;

  const userPrompt = `다음 상품 데이터로 블로그 포스팅을 작성해주세요.

상품명: ${data.productName}
가격: ${data.price.discounted.toLocaleString()}원${data.price.original ? ` (정가: ${data.price.original.toLocaleString()}원)` : ""}
상세 설명: ${data.description}
리뷰: 평점 ${data.reviews.rating}점 / ${data.reviews.count}개 리뷰
주요 리뷰: ${data.reviews.highlights.join(", ")}
배송: ${data.shipping}
판매자: ${data.seller}
이미지 수: ${data.images.length}개

제휴 링크: ${data.affiliateUrl}
(마무리 섹션에 "아래 링크에서 구매할 수 있어요" 형태로 제휴 링크를 자연스럽게 삽입해주세요.)

반드시 JSON 형식으로 응답하세요:
{
  "title": "포스팅 제목",
  "sections": [
    { "type": "text", "content": "글 내용" },
    { "type": "image", "content": "IMAGE_0" },
    ...
  ],
  "tags": ["태그1", "태그2"]
}
IMAGE_0, IMAGE_1 등은 images 배열의 인덱스를 의미합니다.
마무리 text 섹션에는 반드시 제휴 링크를 포함해주세요.`;

  const message = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return NextResponse.json({ error: "포스팅 생성 실패" }, { status: 500 });
  }

  // JSON 파싱
  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json({ error: "응답 파싱 실패" }, { status: 500 });
  }

  const parsed = JSON.parse(jsonMatch[0]);

  // IMAGE_N → 실제 이미지 URL로 교체
  const sections: PostingSection[] = parsed.sections.map(
    (s: { type: string; content: string }) => {
      if (s.type === "image") {
        const idx = parseInt(s.content.replace("IMAGE_", ""));
        return { type: "image", content: data.images[idx] || "" };
      }
      return s as PostingSection;
    }
  );

  const posting = { title: parsed.title, sections, tags: parsed.tags };

  return NextResponse.json({ posting } satisfies PostingResponse);
}
