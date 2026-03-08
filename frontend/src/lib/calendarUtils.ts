/**
 * 달력 유틸리티.
 *
 * 개선 전: (new Date(y, m, 1).getDay() + 6) % 7 패턴이
 *          PlannerView / HealthView 양쪽에 완전히 동일하게 복붙되어 있음.
 *          첫날 요일 오프셋 계산은 버그가 숨기 쉬운 로직이라
 *          수정 시 두 곳을 동시에 맞춰야 하는 유지보수 부채.
 * 개선 후: 단일 파일로 추출 → 변경 시 한 곳만 수정하면 됨.
 */

/**
 * 주어진 연/월에 대한 달력 셀 배열을 반환합니다.
 *
 * - 월요일 시작(ISO 주) 기준으로 앞쪽 빈 셀은 null, 날짜 셀은 1-based 숫자.
 * - 예: 2024-03의 경우 → [null, null, null, null, null, 1, 2, 3, ...]
 *
 * @param year  4자리 연도
 * @param month 0-based 월 (0 = 1월)
 * @returns (number | null)[]
 */
export const buildCalendarDays = (year: number, month: number): (number | null)[] => {
  // (getDay() + 6) % 7: 일요일(0)→6, 월요일(1)→0, ... 토요일(6)→5
  const leadingNulls = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth  = new Date(year, month + 1, 0).getDate();

  return [
    ...Array<null>(leadingNulls).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
};
