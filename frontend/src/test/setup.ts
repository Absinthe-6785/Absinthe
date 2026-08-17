import { loadEnv } from 'vite';

const testEnv = loadEnv('test', process.cwd(), 'VITE_');
const env = import.meta.env as Record<string, unknown>;
env.VITE_ABSINTHE_RETURN_TO_USE_ATTACHMENT_ISOLATION =
  testEnv.VITE_ABSINTHE_RETURN_TO_USE_ATTACHMENT_ISOLATION ?? 'false';
