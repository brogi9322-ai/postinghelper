// ============================================================
// 공통 타입 정의
// ============================================================

// ---- 쇼핑 ----

export interface ShoppingData {
  productName: string;
  price: {
    original: number | null;
    discounted: number;
  };
  description: string;
  images: string[]; // 이미지 URL 목록 (대표 + 상세)
  reviews: {
    rating: number;
    count: number;
    highlights: string[]; // 주요 리뷰 텍스트
  };
  shipping: string;
  seller: string;
  url: string;
}

// ---- 플레이스 ----

export interface PlaceData {
  name: string;
  category: string;
  address: string;
  hours: string; // 영업시간
  menu: { name: string; price: string }[];
  reviews: {
    rating: number;
    count: number;
    highlights: string[];
  };
  images: string[];
  url: string;
}

// ---- 포스팅 결과 ----

export interface PostingSection {
  type: "text" | "image";
  content: string; // text면 글 내용, image면 저장된 이미지 URL
}

export interface GeneratedPosting {
  title: string;
  sections: PostingSection[]; // 글과 이미지가 교차된 순서
  tags: string[];
}

// ---- API 요청/응답 ----

export interface ShoppingRequest {
  data: ShoppingData;
}

export interface PlaceRequest {
  data: PlaceData;
}

export interface PostingResponse {
  posting: GeneratedPosting;
}

export interface ImageSaveRequest {
  urls: string[]; // 저장할 이미지 URL 목록
}

export interface ImageSaveResponse {
  savedUrls: string[]; // Vercel Blob에 저장된 URL 목록
}

// ---- 익스텐션 메시지 ----

export type ExtensionMessageType =
  | "COLLECT_SHOPPING"
  | "COLLECT_PLACE"
  | "START_POSTING"
  | "POSTING_PROGRESS"
  | "POSTING_DONE"
  | "ERROR";

export interface ExtensionMessage {
  type: ExtensionMessageType;
  payload?: unknown;
}
