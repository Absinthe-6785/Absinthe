/**
 * 앱 전역 설정 상수.
 *
 * 개선 전: API_URL이 useDaily / useStatic / useApiMutation /
 *          AnalyticsView / HealthView 등 5곳에 동일하게 선언됨.
 *          fallback URL 변경 시 모든 파일을 수동으로 수정해야 하는 유지보수 부채.
 * 개선 후: 단일 파일로 추출 → 변경 시 한 곳만 수정하면 됨.
 */
export const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
