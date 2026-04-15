import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * Vitest configuration for the Zwift Tool frontend.
 *
 * Uses the jsdom environment to simulate a browser DOM for component tests.
 * Coverage thresholds are enforced at 70% across all metrics, with a target
 * of >90% statement coverage as the suite matures.
 */
export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/**'],
            exclude: [
                'src/main.tsx',
                'src/sentry.ts',
                'src/test/**',
                'src/**/__tests__/**',
                'src/App.tsx',
                'src/App.css',
                'src/index.css',
            ],
            thresholds: {
                statements: 70,
                branches: 70,
                functions: 70,
                lines: 70,
            },
        },
    },
})
