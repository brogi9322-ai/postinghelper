/**
 * /api/shopping 라우트 유닛 테스트
 * 에이전트 루프: plan_structure → generate_tags → end_turn
 */

jest.mock("@/lib/claude", () => ({
  anthropic: {
    messages: {
      create: jest.fn(),
    },
  },
}));

import { anthropic } from "@/lib/claude";
import { POST } from "@/app/api/shopping/route";
import { NextRequest } from "next/server";
import type { ShoppingData } from "@/types";

const mockCreate = anthropic.messages.create as jest.Mock;

const sampleData: ShoppingData = {
  productName: "테스트 상품",
  price: { original: 30000, discounted: 24000 },
  description: "좋은 상품입니다",
  images: ["https://example.com/img1.jpg", "https://example.com/img2.jpg"],
  reviews: { rating: 4.8, count: 120, highlights: ["배송 빠름", "품질 좋음"] },
  shipping: "무료배송",
  seller: "테스트스토어",
  url: "https://brand.naver.com/da_room/products/123",
  affiliateUrl: "https://naver.me/FTdSNwF3",
};

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/shopping", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/shopping", () => {
  beforeEach(() => jest.clearAllMocks());

  it("상품 데이터 없으면 400 반환", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("상품 데이터가 없습니다.");
  });

  it("에이전트 루프 (plan_structure → generate_tags → end_turn) 정상 처리", async () => {
    // 1차 응답: plan_structure tool_use
    mockCreate.mockResolvedValueOnce({
      stop_reason: "tool_use",
      content: [
        {
          type: "tool_use",
          id: "tool_1",
          name: "plan_structure",
          input: {
            sections: [
              { type: "text", label: "도입부" },
              { type: "image", label: "대표이미지", imageIndex: 0 },
              { type: "text", label: "상품소개" },
              { type: "image", label: "상세이미지", imageIndex: 1 },
              { type: "text", label: "마무리" },
            ],
          },
        },
      ],
    });

    // 2차 응답: generate_tags tool_use
    mockCreate.mockResolvedValueOnce({
      stop_reason: "tool_use",
      content: [
        {
          type: "tool_use",
          id: "tool_2",
          name: "generate_tags",
          input: { tags: ["테스트상품", "쇼핑", "후기"] },
        },
      ],
    });

    // 3차 응답: end_turn (실제 블로그 텍스트)
    mockCreate.mockResolvedValueOnce({
      stop_reason: "end_turn",
      content: [
        {
          type: "text",
          text: "오늘 소개할 상품은 테스트 상품입니다.\n\n사용해보니 정말 좋았습니다.\n\n구매를 원하신다면 아래 링크를 확인하세요.",
        },
      ],
    });

    const res = await POST(makeRequest({ data: sampleData }));
    expect(res.status).toBe(200);

    const { posting } = await res.json();
    expect(posting.title).toBe("테스트 상품");
    expect(posting.tags).toEqual(["테스트상품", "쇼핑", "후기"]);

    // sections: text/image/text/image/text = 5개
    expect(posting.sections).toHaveLength(5);
    expect(posting.sections[0].type).toBe("text");
    expect(posting.sections[1].type).toBe("image");
    expect(posting.sections[1].content).toBe("https://example.com/img1.jpg");
    expect(posting.sections[2].type).toBe("text");
    expect(posting.sections[3].type).toBe("image");
    expect(posting.sections[3].content).toBe("https://example.com/img2.jpg");
    expect(posting.sections[4].type).toBe("text");

    // Claude API가 3번 호출됐는지 확인
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });
});
