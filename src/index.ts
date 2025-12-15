// Components
export { default as ChartWidget } from "./components/ChartWidget";
export type { ChartWidgetProps } from "./components/ChartWidget";

// UI Components
export { Button } from "./components/ui/button";
export {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";

// Hooks
export { useChartState } from "./hooks/useChartState";
export type { ChartState, ChartStateOptions } from "./hooks/useChartState";

// Types
export type {
  ChartType,
  ChartDataRow,
  ChartDataItem,
  YAxisPlacement,
  LegendValueState,
  ExtendedDataAnalysisResult,
  OutlierInfo,
  MissingValueInfo,
} from "./types/chart-config";

export {
  CHART_TYPE_TO_NAME,
  CHART_NAME_TO_TYPE,
} from "./types/chart-config";

// Utilities
export { cn } from "./utils/cn";
export {
  analyzeDataQualityExtended,
  outliersToScatterData,
  calculateSeriesSums,
  formatDateForXAxis,
} from "./components/utils/recharts-adapter";

// Mock Data Generator
export {
  generateMockChartData,
  generateSimpleTimeSeries,
  generateDataWithOutliers,
  generateDataWithMissing,
  generateFinancialData,
  generateCategoryData,
  generateScatterData,
  generateComparisonData,
  mockDataGenerator,
} from "./utils/mock-data-generator";
export type { MockDataOptions, DatetimeType } from "./utils/mock-data-generator";
