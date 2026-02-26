import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        career: 'career.html',
        career_entry: 'career_entry.html',
        kickoff: 'kickoff.html',
        customs: 'customs.html',
        players: 'players.html',
        match: 'match.html',
        wiki: 'wiki.html',
        match_simulation: 'match_simulation.html',
        simulation: 'simulation.html',
        standings: 'standings.html',
      }
    }
  },
  server: {
    port: 3000,
    watch: {
      ignored: ['**/server/**'],
    },
  },
  esbuild: {
    include: /\.(jsx)$/,
    loader: 'jsx',
    exclude: /node_modules/,
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'js',
      },
    },
  },
})