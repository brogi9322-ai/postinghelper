import { NextRequest, NextResponse } from "next/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/** POST 응답에 CORS 헤더 추가 */
export function withCors(response: NextResponse): NextResponse {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

/** OPTIONS preflight 요청 처리 */
export function handleOptions(_req: NextRequest): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
