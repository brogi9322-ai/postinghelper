import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/claude";
import type { PlaceRequest, PostingResponse, PostingSection } from "@/types";

// Sprint 7에서 system prompt와 tools 완성 예정
const SYSTEM_PROMPT = `당신은 플레이스(맛집/카페/장소) 블로그 포스팅 전문 작가입니다.
네이버 지도 장소 데이터를 바탕으로 방문기 형식의 자연스러운 블로그 포스팅을 작성합니다.

글 구조: 방문 도입부 → 장소 소개 → 메뉴/서비스 → 분위기/후기 → 정보 정리 → 마무리
이미지 삽입 위치를 sections 배열에 명확히 지정해야 합니다.`;

export async function POST(req: NextRequest) {
  const body: PlaceRequest = await req.json();

  if (!body.data?.name) {
    return NextResponse.json({ error: "장소 데이터가 없습니다." }, { status: 400 });
  }

  const { data } = body;

  const userPrompt = `다음 장소 데이터로 블로그 포스팅을 작성해주세요.

장소명: ${data.name}
카테고리: ${data.category}
주소: ${data.address}
영업시간: ${data.hours}
메뉴: ${data.menu.map((m) => `${m.name} ${m.price}`).join(", ")}
리뷰: 평점 ${data.reviews.rating}점 / ${data.reviews.count}개 리뷰
주요 리뷰: ${data.reviews.highlights.join(", ")}
이미지 수: ${data.images.length}개

반드시 JSON 형식으로 응답하세요:
{
  "title": "포스팅 제목",
  "sections": [
    { "type": "text", "content": "글 내용" },
    { "type": "image", "content": "IMAGE_0" },
    ...
  ],
  "tags": ["태그1", "태그2"]
}`;

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

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json({ error: "응답 파싱 실패" }, { status: 500 });
  }

  const parsed = JSON.parse(jsonMatch[0]);

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
