/** Test-runner injection only. Neither the app shell nor production can supply this writer. */
export const ISOLATED_WORKOUT_WORKER_QA = !import.meta.env.PROD && import.meta.env.MODE === 'health-worker-qa';
export const HEALTH_WORKER_PRODUCT_PROJECT = 'absinthe-health-worker-product-qa';
