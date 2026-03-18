import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/claude";

const SYSTEM_PROMPT = `당신은 전문 블로그 작가입니다. 사용자가 원하는 주제로 읽기 좋고 SEO에 최적화된 블로그 글을 작성합니다.

작성 원칙:
- 독자가 끝까지 읽고 싶어지는 흥미로운 도입부
- 핵심 내용을 명확하게 전달하는 구조화된 본문
- 실용적인 정보와 인사이트 포함
- 마크다운 형식 사용 (제목 #, 소제목 ##, 목록, 강조 등)
- 자연스러운 한국어 문체

도구(스킬) 사용 방법:
- generate_outline: 글의 목차/구조를 먼저 잡을 때 사용
- generate_tags: 글에 어울리는 SEO 태그를 생성할 때 사용`;

const tools: Parameters<typeof anthropic.messages.create>[0]["tools"] = [
  {
    name: "generate_outline",
    description: "블로그 글의 목차와 구조를 생성합니다. 본문 작성 전에 먼저 호출하세요.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "블로그 제목" },
        sections: {
          type: "array",
          items: { type: "string" },
          description: "소제목 목록",
        },
      },
      required: ["title", "sections"],
    },
  },
  {
    name: "generate_tags",
    description: "블로그 글에 어울리는 SEO 태그를 생성합니다.",
    input_schema: {
      type: "object" as const,
      properties: {
        tags: {
          type: "array",
          items: { type: "string" },
          description: "태그 목록 (5~10개)",
        },
      },
      required: ["tags"],
    },
  },
];

export async function POST(req: NextRequest) {
  const { topic, tone, length } = await req.json();

  if (!topic) {
    return NextResponse.json({ error: "Topic is required" }, { status: 400 });
  }

  const userPrompt = `다음 조건으로 블로그 포스트를 작성해주세요.

주제: ${topic}
톤: ${tone || "친근하고 전문적인"}
길이: ${length || "중간 (500-800자)"}

먼저 generate_outline으로 목차를 잡고, 본문을 작성한 뒤, generate_tags로 태그를 추가해주세요.`;

  // 에이전트 루프: tool_use가 끝날 때까지 반복
  const messages: Parameters<typeof anthropic.messages.create>[0]["messages"] = [
    { role: "user", content: userPrompt },
  ];

  let outline: { title: string; sections: string[] } | null = null;
  let tags: string[] = [];
  let blogContent = "";

  while (true) {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    // assistant 응답을 대화 히스토리에 추가
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn") {
      // 최종 텍스트 추출
      const textBlock = response.content.find((b) => b.type === "text");
      if (textBlock && textBlock.type === "text") {
        blogContent = textBlock.text;
      }
      break;
    }

    if (response.stop_reason === "tool_use") {
      const toolResults: Parameters<typeof anthropic.messages.create>[0]["messages"][0] = {
        role: "user",
        content: response.content
          .filter((b) => b.type === "tool_use")
          .map((block) => {
            if (block.type !== "tool_use") return null;

            if (block.name === "generate_outline") {
              const input = block.input as { title: string; sections: string[] };
              outline = input;
              return {
                type: "tool_result" as const,
                tool_use_id: block.id,
                content: `목차 생성 완료: ${input.title} / 섹션: ${input.sections.join(", ")}`,
              };
            }

            if (block.name === "generate_tags") {
              const input = block.input as { tags: string[] };
              tags = input.tags;
              return {
                type: "tool_result" as const,
                tool_use_id: block.id,
                content: `태그 생성 완료: ${input.tags.join(", ")}`,
              };
            }

            return {
              type: "tool_result" as const,
              tool_use_id: block.id,
              content: "완료",
            };
          })
          .filter(Boolean) as { type: "tool_result"; tool_use_id: string; content: string }[],
      };

      messages.push(toolResults);
    }
  }

  return NextResponse.json({ content: blogContent, outline, tags });
}
