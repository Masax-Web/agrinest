# Authentication setup

## Google OAuth

1. In Google Cloud Console, configure the OAuth consent screen and create an OAuth client ID for a **Web application**.
2. Add the exact backend callback URL to the OAuth client's authorized redirect URIs:
   - Local: `http://localhost:3000/auth/google/callback`
   - Railway: `https://<your-api-domain>/auth/google/callback`
3. Configure these variables on the backend service:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI`
   - `APP_BASE_URL` (the frontend origin users should return to)
   - `ADMIN_BOOTSTRAP_EMAIL`
4. Enter OAuth secrets directly in Railway's variable manager. Do not send them in chat, commit them, or place them in frontend `VITE_*` variables.

The first verified Google sign-in whose email matches `ADMIN_BOOTSTRAP_EMAIL` becomes the initial super administrator only when no super administrator exists. After that administrator is established, this setting cannot promote another account.

Google sign-in creates a smallholder-farmer account when no account matches the verified email. From the registration screen, Google sign-up uses the selected persona and phone number; personas that require review remain pending until approved, and invitation-only personas require a valid invitation token. If the Google email already belongs to an AGRI-NEST account, Google is linked to that account and its existing role is preserved. If a Google sign-in fails, the app returns a specific error message; state-verification errors can occur when browser cookies are blocked.

## Session and account behavior

- Sessions use an HttpOnly, SameSite=Lax cookie; production cookies also require HTTPS.
- Normal sessions expire after 12 hours. Selecting “Remember me” extends the session to 30 days, including when a PIN challenge is required.
- Local passwords must be 12–128 characters. An optional sign-in PIN must be 6–12 digits.
- Existing password hashes and user records are retained. The one-time auth schema migration revokes all pre-migration sessions.
- Password-enabled accounts must confirm their current password to change a PIN. Google-only accounts may enroll or remove a PIN within five minutes of a successful sign-in; otherwise, sign in again first.

## Administrator account preview

- Active super administrators can switch into active, non-admin accounts from the administrator user list. Each switch requires confirmation and lasts at most 15 minutes.
- This is real account access, not a read-only UI preview: changes made while acting as the selected user affect that account. Administrator-only APIs remain unavailable during the preview.
- The administrator session is preserved separately so the administrator can return immediately. Starting and ending a preview are recorded in the authentication audit log; expiration is enforced on the next authenticated request and recorded then.

## Rollout

Configure and test these settings in a separate staging environment and database first. Validate existing-account sign-in, Google sign-in, PIN challenges, administrator permissions, suspension, moderation, and integration toggles before considering production. Do not deploy to production until staging passes and the deployment is explicitly approved.
