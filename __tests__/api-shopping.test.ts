/**
 * /api/shopping 라우트 유닛 테스트
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
  url: "https://smartstore.naver.com/test/products/123",
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

  it("정상 요청 시 posting 반환", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            title: "테스트 상품 솔직 후기",
            sections: [
              { type: "text", content: "오늘 소개할 상품은..." },
              { type: "image", content: "IMAGE_0" },
              { type: "text", content: "사용해보니 정말 좋았습니다." },
              { type: "image", content: "IMAGE_1" },
            ],
            tags: ["테스트", "상품후기", "쇼핑"],
          }),
        },
      ],
    });

    const res = await POST(makeRequest({ data: sampleData }));
    expect(res.status).toBe(200);

    const { posting } = await res.json();
    expect(posting.title).toBe("테스트 상품 솔직 후기");
    expect(posting.sections).toHaveLength(4);
    // IMAGE_0 → 실제 이미지 URL로 교체됐는지 확인
    expect(posting.sections[1].content).toBe("https://example.com/img1.jpg");
    expect(posting.sections[3].content).toBe("https://example.com/img2.jpg");
    expect(posting.tags).toContain("테스트");
  });
});
