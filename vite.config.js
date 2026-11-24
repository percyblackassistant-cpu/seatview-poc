import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Pages serves the site from https://<owner>.github.io/seatview-poc/, so the
// asset base has to carry the repo name. Override with SITE_BASE for a
// different host or a local build that sits at the root.
export default defineConfig({
  base: process.env.SITE_BASE ?? '/seatview-poc/',
  plugins: [react()],
  build: { target: 'es2020' },
})
