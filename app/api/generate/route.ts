import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/claude";

export async function POST(req: NextRequest) {
  const { topic, tone, length } = await req.json();

  if (!topic) {
    return NextResponse.json({ error: "Topic is required" }, { status: 400 });
  }

  const prompt = `블로그 포스트를 작성해주세요.

주제: ${topic}
톤: ${tone || "친근하고 전문적인"}
길이: ${length || "중간 (500-800자)"}

마크다운 형식으로 작성하고, 제목(#), 소제목(##), 본문을 포함해주세요.`;

  const message = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    return NextResponse.json({ error: "Unexpected response type" }, { status: 500 });
  }

  return NextResponse.json({ content: content.text });
}
