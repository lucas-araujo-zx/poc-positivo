import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { labApiPlugin } from './server/plugin.js'

const root = path.dirname(fileURLToPath(import.meta.url))

function elevenKey(labEnv) {
  return (
    labEnv.ELEVENLABS_API_KEY?.trim() ||
    process.env.ELEVENLABS_API_KEY?.trim() ||
    ''
  )
}

export default defineConfig(({ mode }) => {
  const labEnv = loadEnv(mode, root, '')
  return {
    plugins: [
      react(),
      labApiPlugin({
        loginToken: labEnv.POSITIVO_LOGIN_TOKEN,
        agentsRaw: labEnv.POSITIVO_AGENTS,
        apiKey: elevenKey(labEnv),
      }),
    ],
    envPrefix: 'PUBLIC_',
    server: {
      port: 5174,
      strictPort: true,
    },
    preview: {
      port: 5174,
      strictPort: true,
    },
  }
})
