import { format, addDays, addMonths, addYears } from "date-fns";
import type { ChartDataRow } from "../types/chart-config";

// ============================================================
// Mock Data Generator Types
// ============================================================

export type DatetimeType = "day" | "week" | "month" | "quarter" | "year";

export interface MockDataOptions {
  /** Number of data points to generate */
  count?: number;

  /** Series field names */
  seriesFields?: string[];

  /** Date/time type for x-axis */
  datetimeType?: DatetimeType;

  /** Start date (default: 2020-01-01) */
  startDate?: Date;

  /** Value range minimum */
  minValue?: number;

  /** Value range maximum */
  maxValue?: number;

  /** Probability of null values (0-1) */
  nullProbability?: number;

  /** Include outliers */
  includeOutliers?: boolean;

  /** Outlier probability (0-1) */
  outlierProbability?: number;

  /** Outlier multiplier (how much outliers deviate) */
  outlierMultiplier?: number;

  /** Add trend (positive, negative, or none) */
  trend?: "up" | "down" | "flat" | "wave";

  /** Seasonality pattern */
  seasonality?: boolean;

  /** Random seed for reproducibility */
  seed?: number;
}

// ============================================================
// Seeded Random Generator
// ============================================================

function createSeededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

// ============================================================
// Date Formatters
// ============================================================

function formatDateDisplay(date: Date, type: DatetimeType): string {
  switch (type) {
    case "day":
      return format(date, "yyyy-MM-dd");
    case "week":
      return format(date, "yyyy-'W'ww");
    case "month":
      return format(date, "yyyy-MM");
    case "quarter":
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      return `${date.getFullYear()}-Q${quarter}`;
    case "year":
      return format(date, "yyyy");
    default:
      return format(date, "yyyy-MM-dd");
  }
}

function getNextDate(date: Date, type: DatetimeType): Date {
  switch (type) {
    case "day":
      return addDays(date, 1);
    case "week":
      return addDays(date, 7);
    case "month":
      return addMonths(date, 1);
    case "quarter":
      return addMonths(date, 3);
    case "year":
      return addYears(date, 1);
    default:
      return addDays(date, 1);
  }
}

// ============================================================
// Main Generator Function
// ============================================================

export function generateMockChartData(options: MockDataOptions = {}): ChartDataRow[] {
  const {
    count = 30,
    seriesFields = ["revenue", "cost", "profit"],
    datetimeType = "month",
    startDate = new Date(2020, 0, 1),
    minValue = 100,
    maxValue = 1000,
    nullProbability = 0,
    includeOutliers = false,
    outlierProbability = 0.05,
    outlierMultiplier = 3,
    trend = "flat",
    seasonality = false,
    seed = Date.now(),
  } = options;

  const random = createSeededRandom(seed);
  const data: ChartDataRow[] = [];
  let currentDate = new Date(startDate);

  // Base values for each series
  const baseValues: Record<string, number> = {};
  seriesFields.forEach((field) => {
    baseValues[field] = minValue + random() * (maxValue - minValue);
  });

  for (let i = 0; i < count; i++) {
    const row: ChartDataRow = {
      date: currentDate.toISOString(),
      date_display: formatDateDisplay(currentDate, datetimeType),
    };

    seriesFields.forEach((field) => {
      // Check for null value
      if (nullProbability > 0 && random() < nullProbability) {
        row[field] = null;
        return;
      }

      let value = baseValues[field];

      // Apply trend
      switch (trend) {
        case "up":
          value += (i / count) * (maxValue - minValue) * 0.5;
          break;
        case "down":
          value -= (i / count) * (maxValue - minValue) * 0.5;
          break;
        case "wave":
          value += Math.sin((i / count) * Math.PI * 4) * (maxValue - minValue) * 0.3;
          break;
      }

      // Apply seasonality
      if (seasonality) {
        const seasonalFactor = Math.sin((i / 12) * Math.PI * 2) * 0.2 + 1;
        value *= seasonalFactor;
      }

      // Add random noise
      value += (random() - 0.5) * (maxValue - minValue) * 0.2;

      // Apply outliers
      if (includeOutliers && random() < outlierProbability) {
        const outlierDirection = random() > 0.5 ? 1 : -1;
        value += outlierDirection * (maxValue - minValue) * outlierMultiplier * random();
      }

      // Ensure positive values
      value = Math.max(0, value);

      // Round to 2 decimal places
      row[field] = Math.round(value * 100) / 100;
    });

    data.push(row);
    currentDate = getNextDate(currentDate, datetimeType);
  }

  return data;
}

// ============================================================
// Preset Generators
// ============================================================

/**
 * Generate simple time series data
 */
export function generateSimpleTimeSeries(seriesCount = 3, points = 24): ChartDataRow[] {
  const fields = Array.from({ length: seriesCount }, (_, i) => `series_${i + 1}`);
  return generateMockChartData({
    count: points,
    seriesFields: fields,
    datetimeType: "month",
    trend: "up",
    seasonality: true,
  });
}

/**
 * Generate data with outliers for testing outlier detection
 */
export function generateDataWithOutliers(points = 30): ChartDataRow[] {
  return generateMockChartData({
    count: points,
    seriesFields: ["value", "baseline"],
    includeOutliers: true,
    outlierProbability: 0.1,
    outlierMultiplier: 2.5,
  });
}

/**
 * Generate data with missing values
 */
export function generateDataWithMissing(points = 30): ChartDataRow[] {
  return generateMockChartData({
    count: points,
    seriesFields: ["actual", "forecast"],
    nullProbability: 0.15,
  });
}

/**
 * Generate financial-style data (revenue, cost, profit)
 */
export function generateFinancialData(points = 12): ChartDataRow[] {
  const data = generateMockChartData({
    count: points,
    seriesFields: ["revenue", "cost"],
    datetimeType: "month",
    minValue: 50000,
    maxValue: 100000,
    trend: "up",
    seasonality: true,
  });

  // Calculate profit from revenue and cost
  return data.map((row) => ({
    ...row,
    profit: typeof row.revenue === "number" && typeof row.cost === "number"
      ? Math.round((row.revenue - row.cost) * 100) / 100
      : null,
  }));
}

/**
 * Generate category-based data for pie/treemap charts
 */
export function generateCategoryData(): ChartDataRow[] {
  const categories = ["제품A", "제품B", "제품C", "제품D", "제품E"];
  return categories.map((category, i) => ({
    date: "",
    date_display: category,
    value: Math.round(Math.random() * 1000 + 100),
    share: Math.round(Math.random() * 30 + 5),
  }));
}

/**
 * Generate scatter plot data with correlation
 */
export function generateScatterData(points = 50): ChartDataRow[] {
  const random = createSeededRandom(42);
  return Array.from({ length: points }, (_, i) => {
    const x = random() * 100;
    const y = x * 0.8 + (random() - 0.5) * 30; // Correlated with noise
    return {
      date: "",
      date_display: `Point ${i + 1}`,
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
    };
  });
}

/**
 * Generate multi-series comparison data
 */
export function generateComparisonData(): ChartDataRow[] {
  return generateMockChartData({
    count: 12,
    seriesFields: ["2023년", "2024년", "목표"],
    datetimeType: "month",
    minValue: 1000,
    maxValue: 5000,
    trend: "wave",
  });
}

// ============================================================
// Export Default Generator
// ============================================================

export const mockDataGenerator = {
  generate: generateMockChartData,
  simple: generateSimpleTimeSeries,
  withOutliers: generateDataWithOutliers,
  withMissing: generateDataWithMissing,
  financial: generateFinancialData,
  category: generateCategoryData,
  scatter: generateScatterData,
  comparison: generateComparisonData,
};

export default mockDataGenerator;
