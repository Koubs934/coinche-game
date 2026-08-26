// Map supabase-js v2 AuthApiError codes to i18n keys so the common auth
// failures render in the UI language instead of GoTrue's raw English.
// Callers fall back to error.message for unmapped codes.
const CODE_TO_KEY = {
  invalid_credentials: 'authInvalidCredentials',
  email_not_confirmed: 'authEmailNotConfirmed',
  weak_password: 'authWeakPassword',
  same_password: 'authSamePassword',
  user_already_exists: 'authEmailTaken',
  email_exists: 'authEmailTaken',
};

export function authErrorKey(error) {
  return CODE_TO_KEY[error?.code];
}
