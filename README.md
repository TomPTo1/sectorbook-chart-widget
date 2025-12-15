# @tompto1/chart-widget

Recharts 기반의 고급 차트 위젯 라이브러리입니다. 18가지 차트 타입, 이상치 감지, 레전드 패널, 독립 실행 가능한 mock 데이터 생성기를 지원합니다.

## Features

- **18가지 차트 타입**: line, area, column, stacked, pie, treemap, regression-scatter 등
- **레전드 패널**: 3가지 레이아웃 (bottom, vertical, sidePanel)
- **이상치 감지**: IQR 기반 자동 이상치 탐지 및 시각화
- **결측치 시각화**: 누락된 데이터 포인트 표시
- **듀얼 축**: 좌/우 Y축 지원
- **테마 지원**: CSS 변수 기반 커스터마이징
- **Mock 데이터 생성기**: 독립 테스트용 랜덤 데이터 생성

## Installation

```bash
npm install @tompto1/chart-widget
# or
pnpm add @tompto1/chart-widget
# or
yarn add @tompto1/chart-widget
```

## Quick Start

```tsx
import { ChartWidget, useChartState, generateFinancialData } from '@tompto1/chart-widget';

function MyChart() {
  // Mock 데이터 생성 (독립 테스트용)
  const data = generateFinancialData(24);
  const seriesFields = ['revenue', 'cost', 'profit'];

  // 차트 상태 관리
  const chartState = useChartState({
    seriesFields,
    initialChartType: 'line',
  });

  return (
    <div style={{ height: 400 }}>
      <ChartWidget
        data={data}
        seriesFields={seriesFields}
        chartType={chartState.chartType}
        enabledSeries={chartState.enabledSeries}
        showOutliers={chartState.showOutliers}
        height="100%"
      />
    </div>
  );
}
```

## Mock Data Generator

독립 실행 및 테스트를 위한 다양한 데이터 생성기를 제공합니다:

```tsx
import {
  generateMockChartData,    // 커스텀 옵션으로 생성
  generateFinancialData,    // 재무 데이터 (revenue, cost, profit)
  generateDataWithOutliers, // 이상치 포함 데이터
  generateDataWithMissing,  // 결측치 포함 데이터
  generateSimpleTimeSeries, // 단순 시계열
  generateCategoryData,     // 카테고리 데이터 (파이/트리맵용)
  generateScatterData,      // 산점도 데이터
  mockDataGenerator,        // 모든 생성기 통합 객체
} from '@tompto1/chart-widget';

// 커스텀 옵션 사용
const customData = generateMockChartData({
  count: 30,                        // 데이터 포인트 수
  seriesFields: ['A', 'B', 'C'],    // 시리즈 필드명
  datetimeType: 'month',            // day | week | month | quarter | year
  minValue: 100,                    // 최소값
  maxValue: 1000,                   // 최대값
  nullProbability: 0.1,             // 결측치 확률 (0-1)
  includeOutliers: true,            // 이상치 포함
  outlierProbability: 0.05,         // 이상치 확률
  trend: 'up',                      // up | down | flat | wave
  seasonality: true,                // 계절성 패턴
  seed: 42,                         // 재현 가능한 랜덤 시드
});
```

## Supported Chart Types

| Type | Description | Outliers | Missing |
|------|-------------|----------|---------|
| `line` | 라인 차트 | ✅ | ✅ |
| `area` | 영역 차트 | ❌ | ✅ |
| `area-100` | 100% 영역 차트 | ❌ | ✅ |
| `stacked-area` | 스택 영역 차트 | ❌ | ❌ |
| `synced-area` | 동기화된 듀얼 영역 차트 | ❌ | ❌ |
| `column` | 막대 차트 | ✅ | ✅ |
| `mixed` | 라인 + 막대 혼합 | ✅ | ✅ |
| `stacked` | 스택 막대 차트 | ❌ | ✅ |
| `stacked-100` | 100% 스택 막대 차트 | ❌ | ✅ |
| `stacked-grouped` | 그룹 스택 차트 | ❌ | ✅ |
| `dual-axis` | 듀얼 Y축 차트 | ✅ | ✅ |
| `pie` | 파이 차트 | ❌ | ❌ |
| `two-level-pie` | 2단계 파이 차트 | ❌ | ❌ |
| `treemap` | 트리맵 | ❌ | ❌ |
| `multi-level-treemap` | 드릴다운 트리맵 | ❌ | ❌ |
| `ranking-bar` | 랭킹 막대 차트 | ❌ | ❌ |
| `geo-grid` | 지리 그리드 차트 | ❌ | ❌ |
| `regression-scatter` | 회귀 분석 산점도 | ✅ | ❌ |

## ChartWidget Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `data` | `ChartDataRow[]` | ✅ | 차트 데이터 |
| `seriesFields` | `string[]` | ✅ | Y축에 표시할 필드명 |
| `chartType` | `ChartType` | ✅ | 차트 타입 |
| `enabledSeries` | `Set<string>` | ✅ | 활성화된 시리즈 |
| `showOutliers` | `boolean` | ❌ | 이상치 표시 여부 |
| `showMissingValues` | `boolean` | ❌ | 결측치 표시 여부 |
| `yFieldTypes` | `Map<string, "line" \| "column">` | ❌ | 시리즈별 차트 타입 (mixed용) |
| `yAxisPlacements` | `Map<string, YAxisPlacement>` | ❌ | 시리즈별 Y축 위치 |
| `height` | `number \| string` | ❌ | 차트 높이 |
| `className` | `string` | ❌ | 추가 CSS 클래스 |
| `onTooltipChange` | `(payload) => void` | ❌ | 툴팁 변경 콜백 |
| `onHoveredLabelChange` | `(label) => void` | ❌ | 호버 라벨 변경 콜백 |

## useChartState Hook

차트 상태 관리를 위한 훅입니다:

```tsx
const chartState = useChartState({
  seriesFields: ['field1', 'field2'],
  initialChartType: 'line',
  initialEnabledSeries: new Set(['field1']),
});

// Returns:
// - chartType, setChartType
// - enabledSeries, toggleSeries, enableAllSeries, disableAllSeries
// - showOutliers, setShowOutliers
// - showMissingValues, setShowMissingValues
// - yFieldTypes, setYFieldType
// - yAxisPlacements, setYAxisPlacement
// - groupCount, setGroupCount
// - seriesGroupAssignments, setSeriesGroupAssignment
// - tooltipPayload, setTooltipPayload
// - hoveredLabel, setHoveredLabel
```

## Theming

CSS 변수를 통해 테마를 커스터마이징할 수 있습니다:

```css
:root {
  --chart-1: 220 70% 50%;
  --chart-2: 160 60% 45%;
  --chart-3: 30 80% 55%;
  --chart-4: 280 65% 60%;
  --chart-5: 340 75% 55%;

  /* Background and text colors */
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --muted-foreground: 215.4 16.3% 46.9%;
}
```

## Development

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build
npm run build

# Type check
npm run typecheck
```

## File Structure

```
@tompto1/chart-widget/
├── src/
│   ├── components/
│   │   ├── ChartWidget.tsx          # Main widget (props-based)
│   │   ├── ui/
│   │   │   ├── button.tsx           # Button component
│   │   │   └── select.tsx           # Select component
│   │   └── components/
│   │       ├── chart-legend-panel.tsx
│   │       ├── recharts-wrapper.tsx
│   │       └── [14 more wrappers]
│   ├── hooks/
│   │   └── useChartState.ts         # State management hook
│   ├── types/
│   │   └── chart-config.ts          # All TypeScript types
│   ├── utils/
│   │   ├── cn.ts                    # Class name utility
│   │   └── mock-data-generator.ts   # Test data generator
│   └── index.ts                     # Main exports
├── examples/
│   └── Demo.tsx                     # Standalone demo
├── package.json
├── tsconfig.json
└── README.md
```

## License

MIT
