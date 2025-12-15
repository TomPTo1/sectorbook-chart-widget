import { useState, useMemo, useCallback } from "react";
import type {
  ChartType,
  ChartDataRow,
  YAxisPlacement,
  ExtendedDataAnalysisResult,
} from "../types/chart-config";

export interface ChartStateOptions {
  initialChartType?: ChartType;
  initialEnabledSeries?: Set<string>;
  seriesFields: string[];
}

export interface ChartState {
  chartType: ChartType;
  setChartType: (type: ChartType) => void;
  enabledSeries: Set<string>;
  toggleSeries: (series: string) => void;
  enableAllSeries: () => void;
  disableAllSeries: () => void;
  showOutliers: boolean;
  setShowOutliers: (show: boolean) => void;
  showMissingValues: boolean;
  setShowMissingValues: (show: boolean) => void;
  yFieldTypes: Map<string, "line" | "column">;
  setYFieldType: (field: string, type: "line" | "column") => void;
  yAxisPlacements: Map<string, YAxisPlacement>;
  setYAxisPlacement: (field: string, placement: YAxisPlacement) => void;
  groupCount: number;
  setGroupCount: (count: number) => void;
  seriesGroupAssignments: Map<string, number>;
  setSeriesGroupAssignment: (series: string, group: number) => void;
  tooltipPayload: any[] | null;
  setTooltipPayload: (payload: any[] | null) => void;
  hoveredLabel: string | null;
  setHoveredLabel: (label: string | null) => void;
}

export function useChartState(options: ChartStateOptions): ChartState {
  const { initialChartType = "line", initialEnabledSeries, seriesFields } = options;

  const [chartType, setChartType] = useState<ChartType>(initialChartType);
  const [enabledSeries, setEnabledSeries] = useState<Set<string>>(
    initialEnabledSeries ?? new Set(seriesFields)
  );
  const [showOutliers, setShowOutliers] = useState(false);
  const [showMissingValues, setShowMissingValues] = useState(false);
  const [yFieldTypes, setYFieldTypes] = useState<Map<string, "line" | "column">>(new Map());
  const [yAxisPlacements, setYAxisPlacements] = useState<Map<string, YAxisPlacement>>(new Map());
  const [groupCount, setGroupCount] = useState(2);
  const [seriesGroupAssignments, setSeriesGroupAssignments] = useState<Map<string, number>>(new Map());
  const [tooltipPayload, setTooltipPayload] = useState<any[] | null>(null);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);

  const toggleSeries = useCallback((series: string) => {
    setEnabledSeries((prev) => {
      const next = new Set(prev);
      if (next.has(series)) {
        next.delete(series);
      } else {
        next.add(series);
      }
      return next;
    });
  }, []);

  const enableAllSeries = useCallback(() => {
    setEnabledSeries(new Set(seriesFields));
  }, [seriesFields]);

  const disableAllSeries = useCallback(() => {
    setEnabledSeries(new Set());
  }, []);

  const setYFieldType = useCallback((field: string, type: "line" | "column") => {
    setYFieldTypes((prev) => {
      const next = new Map(prev);
      next.set(field, type);
      return next;
    });
  }, []);

  const setYAxisPlacement = useCallback((field: string, placement: YAxisPlacement) => {
    setYAxisPlacements((prev) => {
      const next = new Map(prev);
      next.set(field, placement);
      return next;
    });
  }, []);

  const setSeriesGroupAssignment = useCallback((series: string, group: number) => {
    setSeriesGroupAssignments((prev) => {
      const next = new Map(prev);
      next.set(series, group);
      return next;
    });
  }, []);

  return {
    chartType,
    setChartType,
    enabledSeries,
    toggleSeries,
    enableAllSeries,
    disableAllSeries,
    showOutliers,
    setShowOutliers,
    showMissingValues,
    setShowMissingValues,
    yFieldTypes,
    setYFieldType,
    yAxisPlacements,
    setYAxisPlacement,
    groupCount,
    setGroupCount,
    seriesGroupAssignments,
    setSeriesGroupAssignment,
    tooltipPayload,
    setTooltipPayload,
    hoveredLabel,
    setHoveredLabel,
  };
}
