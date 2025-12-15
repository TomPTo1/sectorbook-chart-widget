// Chart 관련 타입 정의

// 17가지 차트 타입
export type ChartType =
  | "line"
  | "area"
  | "area-100"
  | "stacked-area"
  | "synced-area"
  | "column"
  | "mixed"
  | "stacked"
  | "stacked-100"
  | "stacked-grouped"
  | "dual-axis"
  | "pie"
  | "two-level-pie"
  | "treemap"
  | "multi-level-treemap"
  | "ranking-bar"
  | "geo-grid"
  | "regression-scatter";

// 이중축 배치
export type YAxisPlacement = "left" | "right";

// 시간 단위 설정
export interface UnitSettings {
  datetime_type: "minute" | "hour" | "day" | "week" | "month" | "quarter" | "year";
  datetime_unit: number;
  datetime_range: {
    datetime_start?: string;
    datetime_end?: string;
  };
}

// 차트 데이터 타입
export interface ChartDataRow {
  date: string;
  date_display: string;
  [key: string]: string | number | null;
}

// 차트 데이터 아이템 (일반용)
export interface ChartDataItem {
  date?: string;
  date_display: string;
  [key: string]: string | number | null | undefined;
}

// 이상치 정보
export interface OutlierInfo {
  date_display: string;
  dateDisplay?: string; // 호환성용 별칭
  field: string;
  value: number;
  bound: "upper" | "lower";
}

// 결측치 정보
export interface MissingValueInfo {
  date_display: string;
  field: string;
}

// IQR 바운드
export interface IQRBounds {
  lower: number;
  upper: number;
  q1: number;
  q3: number;
}

// 영역 데이터 구조
export interface RegionData {
  data: ChartDataItem[];
  domain: [number, number];
  hasData?: boolean;
}

// 영역별 분류 데이터
export interface RegionClassifiedData {
  upper: RegionData;
  normal: RegionData;
  lower: RegionData;
}

// 레전드 값 상태
export type LegendValueState = 'normal' | 'outlier' | 'missing';

// 확장된 데이터 분석 결과
export interface ExtendedDataAnalysisResult {
  outliers: OutlierInfo[];
  missingValues: MissingValueInfo[];
  iqrBounds: Record<string, IQRBounds>;
  seriesIQR?: Array<{
    field: string;
    q1: number;
    q3: number;
    lower: number;
    upper: number;
  }>;
  classifiedData: RegionClassifiedData | null;
  hasUpperOutliers: boolean;
  hasLowerOutliers: boolean;
  // 이중축용 분리 데이터
  leftClassifiedData?: RegionClassifiedData;
  rightClassifiedData?: RegionClassifiedData;
}

// 테마 색상
export interface ThemeColors {
  gridColor: string;
  textColor: string;
  backgroundColor: string;
  seriesColors: string[];
}

// 한글 차트명 -> ChartType 매핑
export const CHART_NAME_TO_TYPE: Record<string, ChartType> = {
  "막대": "column",
  "라인": "line",
  "영역": "area",
  "100% 영역": "area-100",
  "누적 영역": "stacked-area",
  "동기화 영역": "synced-area",
  "혼합차트": "mixed",
  "누적막대": "stacked",
  "100% 누적막대": "stacked-100",
  "그룹형 누적막대": "stacked-grouped",
  "이중축": "dual-axis",
  "원형": "pie",
  "2단계 원형": "two-level-pie",
  "트리맵": "treemap",
  "멀티레벨 트리맵": "multi-level-treemap",
  "랭킹막대": "ranking-bar",
  "지도그리드": "geo-grid",
  "회귀 산점도": "regression-scatter",
};

// ChartType -> 한글 차트명 매핑
export const CHART_TYPE_TO_NAME: Record<ChartType, string> = {
  "column": "막대",
  "line": "라인",
  "area": "영역",
  "area-100": "100% 영역",
  "stacked-area": "누적 영역",
  "synced-area": "동기화 영역",
  "mixed": "혼합차트",
  "stacked": "누적막대",
  "stacked-100": "100% 누적막대",
  "stacked-grouped": "그룹형 누적막대",
  "dual-axis": "이중축",
  "pie": "원형",
  "two-level-pie": "2단계 원형",
  "treemap": "트리맵",
  "multi-level-treemap": "멀티레벨 트리맵",
  "ranking-bar": "랭킹막대",
  "geo-grid": "지도그리드",
  "regression-scatter": "회귀 산점도",
};
