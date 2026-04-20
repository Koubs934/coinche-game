// Reusable Playwright helper. Sign in with the project's test user credentials
// (read from process.env, typically sourced from backend/.env.test.local via
// `node --env-file=...`). Every Playwright run that needs the authenticated
// app should call this once right after page.goto(<starting URL>).
//
// The auth form is the existing Auth.jsx component — a standard email +
// password + submit. After successful sign-in, App.jsx unmounts Auth and
// renders the normal routes, so we detect completion by waiting for the
// email input to detach.

export async function authenticate(page, { timeoutMs = 12000 } = {}) {
  const email    = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  if (!email || !password) {
    throw new Error(
      '[authenticate] TEST_USER_EMAIL and TEST_USER_PASSWORD must be set. ' +
      'Run with:  node --env-file=../backend/.env.test.local <script>.js'
    );
  }

  // If we're already past auth (e.g., helper called twice), the email field
  // won't exist — bail out cleanly rather than timing out.
  const emailField = await page.$('input[type="email"]');
  if (!emailField) return { alreadyAuthenticated: true };

  await page.fill('input[type="email"]',    email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  // Auth unmount = sign-in accepted. If it stays visible the password was
  // rejected; surface that clearly instead of a generic timeout.
  try {
    await page.waitForSelector('input[type="email"]', { state: 'detached', timeout: timeoutMs });
  } catch (err) {
    const errMsg = await page.textContent('.error-msg').catch(() => null);
    throw new Error(`[authenticate] sign-in did not complete within ${timeoutMs}ms` +
                    (errMsg ? ` — form error: "${errMsg.trim()}"` : ''));
  }

  return { alreadyAuthenticated: false };
}
