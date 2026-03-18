/**
 * /api/images/save 보안 테스트
 * SSRF, URL 검증, MIME 타입 검증
 */

import { POST } from "@/app/api/images/save/route";
import { NextRequest } from "next/server";

// @vercel/blob mock
jest.mock("@vercel/blob", () => ({
  put: jest.fn().mockResolvedValue({ url: "https://blob.vercel.com/saved.jpg" }),
}));

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/images/save", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// fetch mock
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("POST /api/images/save — 보안 검증", () => {
  beforeEach(() => jest.clearAllMocks());

  it("빈 urls → 400", async () => {
    const res = await POST(makeRequest({ urls: [] }));
    expect(res.status).toBe(400);
  });

  it("50개 초과 urls → 400 (DoS 방지)", async () => {
    const urls = Array(51).fill("https://pstatic.net/img.jpg");
    const res = await POST(makeRequest({ urls }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("50개");
  });

  it("SSRF — localhost URL → 빈 문자열로 처리", async () => {
    const res = await POST(makeRequest({ urls: ["https://localhost/secret"] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.savedUrls[0]).toBe(""); // fetch 호출 안 됨
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("SSRF — AWS 메타데이터 서버 → 빈 문자열로 처리", async () => {
    const res = await POST(makeRequest({ urls: ["https://169.254.169.254/latest/meta-data"] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.savedUrls[0]).toBe("");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("SSRF — 내부 IP 대역 → 빈 문자열로 처리", async () => {
    const res = await POST(makeRequest({ urls: ["https://192.168.1.1/image.jpg"] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.savedUrls[0]).toBe("");
  });

  it("허용되지 않은 도메인 → 빈 문자열로 처리", async () => {
    const res = await POST(makeRequest({ urls: ["https://attacker.com/img.jpg"] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.savedUrls[0]).toBe("");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("http:// (비HTTPS) → 빈 문자열로 처리", async () => {
    const res = await POST(makeRequest({ urls: ["http://pstatic.net/img.jpg"] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.savedUrls[0]).toBe("");
  });

  it("유효한 네이버 이미지 → Blob 저장 성공", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      blob: async () => ({ type: "image/jpeg", size: 1024 }),
    });

    const res = await POST(makeRequest({ urls: ["https://pstatic.net/product/img.jpg"] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.savedUrls[0]).toBe("https://blob.vercel.com/saved.jpg");
  });

  it("허용되지 않은 MIME 타입 → 빈 문자열로 처리", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      blob: async () => ({ type: "application/exe", size: 1024 }),
    });

    const res = await POST(makeRequest({ urls: ["https://pstatic.net/file.jpg"] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.savedUrls[0]).toBe("");
  });
});

describe("POST /api/shopping — 보안 검증", () => {
  it("유효하지 않은 affiliateUrl → 400", async () => {
    const { POST: shoppingPost } = await import("@/app/api/shopping/route");

    jest.mock("@/lib/claude", () => ({ anthropic: { messages: { create: jest.fn() } } }));

    const req = new NextRequest("http://localhost/api/shopping", {
      method: "POST",
      body: JSON.stringify({
        data: {
          productName: "테스트",
          price: { original: null, discounted: 1000 },
          description: "",
          images: [],
          reviews: { rating: 0, count: 0, highlights: [] },
          shipping: "",
          seller: "",
          url: "",
          affiliateUrl: "javascript:alert('xss')", // 악성 URL
        },
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await shoppingPost(req);
    expect(res.status).toBe(400);
  });
});
