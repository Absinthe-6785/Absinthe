/** Local isolated product validation only. Production builds cannot open this path. */
const ISOLATED_WORKOUT_SAVE_OPT_IN = false;
export const HEALTH_CANONICAL_LOCAL_SAVE_ENABLED = !import.meta.env.PROD && ISOLATED_WORKOUT_SAVE_OPT_IN;
