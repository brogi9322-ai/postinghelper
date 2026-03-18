"use client";

import { useState } from "react";

export default function Home() {
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("친근하고 전문적인");
  const [length, setLength] = useState("중간 (500-800자)");
  const [result, setResult] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError("주제를 입력해주세요.");
      return;
    }

    setLoading(true);
    setError("");
    setResult("");
    setTags([]);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, tone, length }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "생성 중 오류가 발생했습니다.");
      }

      setResult(data.content);
      setTags(data.tags ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
  };

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            블로그 포스팅 도우미
          </h1>
          <p className="text-gray-500 text-lg">
            Claude AI가 블로그 글을 대신 써드립니다
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              블로그 주제 *
            </label>
            <textarea
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
              placeholder="예: Next.js로 풀스택 앱 만들기, 효과적인 독서 습관 만들기..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                톤
              </label>
              <select
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
              >
                <option>친근하고 전문적인</option>
                <option>격식체</option>
                <option>캐주얼</option>
                <option>유머러스</option>
                <option>교육적인</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                길이
              </label>
              <select
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                value={length}
                onChange={(e) => setLength(e.target.value)}
              >
                <option>짧게 (300자 이하)</option>
                <option>중간 (500-800자)</option>
                <option>길게 (1000자 이상)</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-6 rounded-xl transition-colors duration-200"
          >
            {loading ? "생성 중..." : "블로그 글 생성하기"}
          </button>
        </div>

        {result && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">생성된 글</h2>
              <button
                onClick={handleCopy}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                복사하기
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            <pre className="whitespace-pre-wrap text-gray-700 text-sm leading-relaxed font-sans">
              {result}
            </pre>
          </div>
        )}
      </div>
    </main>
  );
}
