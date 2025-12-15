/**
 * y=0 기준선의 스타일을 결정
 *
 * @param data - 차트 데이터
 * @param fields - Y축 필드명 배열
 * @returns 실선 여부 및 축선 스타일 사용 여부
 */
export function getZeroLineStyle(
  data: any[],
  fields: string[]
): { useSolid: boolean; useAxisStyle: boolean } {
  // 실제 데이터에서 0이 아닌 값 수집
  const allValues: number[] = [];
  data.forEach(row => {
    fields.forEach(field => {
      const value = row[field];
      if (typeof value === 'number' && !isNaN(value) && value !== 0) {
        allValues.push(value);
      }
    });
  });

  // 값이 없으면 점선 유지
  if (allValues.length === 0) {
    return { useSolid: false, useAxisStyle: false };
  }

  // 양수/음수 혼재 여부 확인
  const hasPositive = allValues.some(v => v > 0);
  const hasNegative = allValues.some(v => v < 0);

  // 양수/음수 혼재: 실선 (현재 스타일)
  if (hasPositive && hasNegative) {
    return { useSolid: true, useAxisStyle: false };
  }

  // 한쪽만: 실선 (축선 스타일)
  return { useSolid: true, useAxisStyle: true };
}
