import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './': relative asset paths work on GitHub Pages project pages
// (https://<user>.github.io/<repo>/) and locally, with HashRouter (D4).
export default defineConfig({
  plugins: [react()],
  base: './',
})
