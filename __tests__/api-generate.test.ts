/**
 * /api/generate 라우트 유닛 테스트
 * Claude API는 mock 처리
 */

jest.mock("@/lib/claude", () => ({
  anthropic: {
    messages: {
      create: jest.fn(),
    },
  },
}));

import { anthropic } from "@/lib/claude";
import { POST } from "@/app/api/generate/route";
import { NextRequest } from "next/server";

const mockCreate = anthropic.messages.create as jest.Mock;

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/generate", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/generate", () => {
  beforeEach(() => jest.clearAllMocks());

  it("topic 없으면 400 반환", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Topic is required");
  });

  it("정상 요청 시 content와 tags 반환", async () => {
    // 1회차: generate_outline tool_use
    mockCreate.mockResolvedValueOnce({
      stop_reason: "tool_use",
      content: [
        {
          type: "tool_use",
          id: "tool_1",
          name: "generate_outline",
          input: { title: "테스트 제목", sections: ["서론", "본론", "결론"] },
        },
      ],
    });
    // 2회차: generate_tags tool_use
    mockCreate.mockResolvedValueOnce({
      stop_reason: "tool_use",
      content: [
        {
          type: "tool_use",
          id: "tool_2",
          name: "generate_tags",
          input: { tags: ["Next.js", "React", "블로그"] },
        },
      ],
    });
    // 3회차: end_turn
    mockCreate.mockResolvedValueOnce({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "# 테스트 블로그 글\n본문 내용입니다." }],
    });

    const res = await POST(makeRequest({ topic: "Next.js 소개" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.content).toContain("테스트 블로그 글");
    expect(data.tags).toEqual(["Next.js", "React", "블로그"]);
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });
});
