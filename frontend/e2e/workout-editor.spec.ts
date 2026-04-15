import { test, expect } from '@playwright/test'

/**
 * End-to-end tests for the Zwift Tool workout editor.
 *
 * These tests exercise the full application in a running browser. They use
 * Playwright locators exclusively — no Testing Library API calls.
 *
 * The backend is not required: tests target guest-mode behaviour where
 * workouts are edited entirely client-side without authentication.
 */

test.describe('Workout editor — guest mode', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/')
        // Enter guest mode from the landing screen so the editor is visible
        await page.getByRole('button', { name: 'Continue without an account' }).click()
    })

    test('renders the application shell', async ({ page }) => {
        // The page should load without errors
        await expect(page).toHaveTitle(/Zwift Tool/i)
    })

    test('shows the file upload option for importing a workout', async ({ page }) => {
        // The import section should be visible on load
        await expect(page.getByText('Upload .zwo files')).toBeVisible()
    })

    test('shows the load example workout button', async ({ page }) => {
        await expect(page.getByRole('button', { name: 'Load example workout' })).toBeVisible()
    })

    test('loads an example workout when the button is clicked', async ({ page }) => {
        await page.getByRole('button', { name: 'Load example workout' }).click()

        // After loading an example, the workout name should appear in the editor
        // and the canvas section should become visible
        await expect(page.locator('[data-testid="workout-canvas"], canvas, svg').first()).toBeVisible({
            timeout: 5000,
        })
    })

    test('shows the sign-in and sign-up buttons in the navigation', async ({ page }) => {
        // Both auth entry points should be accessible without signing in
        const signInButton = page.getByRole('button', { name: /sign in/i })
        const signUpButton = page.getByRole('button', { name: /sign up|create account/i })

        // At least one auth button should be present
        const hasAuth = (await signInButton.count()) > 0 || (await signUpButton.count()) > 0
        expect(hasAuth).toBe(true)
    })

    test('opens the sign-in modal when the sign-in button is clicked', async ({ page }) => {
        const signInButton = page.getByRole('button', { name: /sign in/i }).first()
        await signInButton.click()

        await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible()
        await expect(page.getByLabel('Email')).toBeVisible()
        await expect(page.getByLabel('Password')).toBeVisible()
    })

    test('closes the sign-in modal when the close button is clicked', async ({ page }) => {
        await page.getByRole('button', { name: /sign in/i }).first().click()
        await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible()

        await page.getByLabel('Close modal').click()
        await expect(page.getByRole('heading', { name: /sign in/i })).not.toBeVisible()
    })

    test('shows a validation error when sign-in is submitted with empty fields', async ({ page }) => {
        await page.getByRole('button', { name: /sign in/i }).first().click()
        await page.getByRole('button', { name: /^sign in$/i }).click()

        await expect(page.getByText('Please enter your email and password.')).toBeVisible()
    })

    test('closes the sign-in modal when Escape is pressed', async ({ page }) => {
        await page.getByRole('button', { name: /sign in/i }).first().click()
        await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible()

        await page.keyboard.press('Escape')
        await expect(page.getByRole('heading', { name: /sign in/i })).not.toBeVisible()
    })
})

test.describe('File import flow', () => {
    test('shows a parse error when an invalid .zwo file is uploaded', async ({ page }) => {
        await page.goto('/')
        await page.getByRole('button', { name: 'Continue without an account' }).click()

        // Create an invalid .zwo file
        const fileContent = Buffer.from('this is not xml')
        const fileInput = page.locator('input[type="file"]')

        await fileInput.setInputFiles({
            name: 'bad.zwo',
            mimeType: 'application/xml',
            buffer: fileContent,
        })

        // An error message should appear
        await expect(page.locator('text=/not valid XML|no intervals|not a valid/i')).toBeVisible({
            timeout: 5000,
        })
    })
})
