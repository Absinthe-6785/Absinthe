import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const recipeQaPort = 5177
const recipeQaRoutes = '^/api/recipes(?:[/?]|$)'

export default defineConfig(({ mode, command, isPreview }) => {
  const recipeWorkerQa = mode === 'recipe-worker-qa'
  const healthWorkerQa = mode === 'health-worker-qa'
  if (healthWorkerQa && (command !== 'serve' || isPreview)) {
    throw new Error('Health Worker QA is test only')
  }
  if (recipeWorkerQa && (command !== 'serve' || isPreview)) {
    throw new Error('Recipe Worker QA is local dev only')
  }
  return {
    plugins: [
      react(),
      ...(recipeWorkerQa ? [{
        name: 'absinthe-recipe-worker-qa-loopback',
        configureServer(server: import('vite').ViteDevServer) {
          const { host, port, strictPort } = server.config.server
          if (host !== '127.0.0.1' || port !== recipeQaPort || !strictPort || server.config.server.https) {
            throw new Error(`Recipe Worker QA requires http://127.0.0.1:${recipeQaPort}`)
          }
          const recipeRoute = new RegExp(recipeQaRoutes)
          server.middlewares.use((req, res, next) => {
            const path = req.url ?? ''
            if (/^\/api(?:[/?]|$)/.test(path) && !recipeRoute.test(path)) {
              res.statusCode = 404
              res.end()
              return
            }
            next()
          })
        },
      }] : []),
    ],
    // Do not load or expose a developer's normal API/Auth configuration in QA.
    ...(recipeWorkerQa && {
      envDir: false as const,
      envPrefix: [],
      define: {
        'import.meta.env.VITE_API_URL': JSON.stringify(`http://127.0.0.1:${recipeQaPort}`),
        'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:54321'),
        'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('synthetic-local-qa-only'),
      },
      server: {
        host: '127.0.0.1',
        port: recipeQaPort,
        strictPort: true,
        cors: false,
        proxy: {
          [recipeQaRoutes]: { target: 'http://127.0.0.1:8787', changeOrigin: true },
        },
      },
    }),
    ...(healthWorkerQa && { envDir: false as const, envPrefix: [] }),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      environment: 'node',
      include: healthWorkerQa ? ['qa/healthWorker.integration.test.ts']
        : recipeWorkerQa ? ['qa/recipeWorker.integration.test.ts'] : ['src/**/*.test.ts'],
      setupFiles: recipeWorkerQa || healthWorkerQa ? [] : ['./src/test/setup.ts'],
    },
  }
})
