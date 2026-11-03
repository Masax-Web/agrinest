const express = require('express');
const router = express.Router();
const AuthService = require('../../../../services/AuthService');
const GoogleOAuthService = require('../../../../services/GoogleOAuthService');
const PlatformSettingsService = require('../../../../services/PlatformSettingsService');
const { authenticate, authenticateAdminSession, readBearerToken, readCookie, requireAdmin } = require('../../../../middleware/auth');

const publicGoogleErrorCodes = new Set([
  'account_already_exists',
  'account_pending_approval',
  'invalid_or_expired_invitation',
  'invitation_required_for_persona',
  'google_authorization_failed',
  'google_email_not_verified',
  'google_identity_already_linked',
  'google_identity_invalid',
  'google_identity_mismatch',
  'google_oauth_not_configured',
  'google_oauth_unavailable',
  'persona_core_role_mismatch',
  'unknown_persona',
  'valid_phone_required',
]);

function publicGoogleErrorCode(error, fallback = 'google_signin_failed') {
  return publicGoogleErrorCodes.has(error.code) ? error.code : fallback;
}

function sendAuthError(response, error, operation) {
  const status = Number(error.status) || 500;
  if (status >= 500) console.error(`AuthController.${operation}`, error.message);
  return response.status(status).json({ error: error.code || 'auth_error' });
}

function cookieOptions(maxAgeSeconds, secure = process.env.NODE_ENV === 'production') {
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure ? '; Secure' : ''}`;
}

function setSessionCookie(response, result, request) {
  if (!result.token) return response.status(200).json(result);
  const maxAge = Math.max(0, Math.ceil((new Date(result.expires_at).getTime() - Date.now()) / 1000));
  const secure = process.env.NODE_ENV === 'production' || request.secure;
  response.setHeader('Set-Cookie', [
    `agrinest_session=${encodeURIComponent(result.token)}; ${cookieOptions(maxAge, secure)}`,
    `agrinest_impersonation=; ${cookieOptions(0, secure)}`,
  ]);
  return response.status(response.statusCode || 200).json({ user: result.user, expires_at: result.expires_at });
}

function clearSessionCookie(response, request) {
  const secure = process.env.NODE_ENV === 'production' || request.secure;
  response.setHeader('Set-Cookie', [
    `agrinest_session=; ${cookieOptions(0, secure)}`,
    `agrinest_impersonation=; ${cookieOptions(0, secure)}`,
  ]);
}

function applicationUrl() {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/+$/, '');
  return process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001';
}

router.post('/register', async (req, res) => {
  try {
    const result = await AuthService.registerUser(req.body);
    if (result.token) {
      res.status(201);
      setSessionCookie(res, result, req);
    } else {
      res.status(201).json(result);
    }
  } catch (err) {
    sendAuthError(res, err, 'register');
  }
});

router.post('/login', async (req, res) => {
  try {
    const result = await AuthService.loginUser(req.body, { ip: req.ip });
    setSessionCookie(res, result, req);
  } catch (err) {
    sendAuthError(res, err, 'login');
  }
});

router.post('/pin/verify', async (req, res) => {
  try {
    const result = await AuthService.completePinChallenge(req.body, { ip: req.ip });
    setSessionCookie(res, result, req);
  } catch (err) {
    sendAuthError(res, err, 'verifyPin');
  }
});

router.get('/google', async (req, res) => {
  try {
    const { state, stateHash, authorizationUrl } = GoogleOAuthService.createAuthorizationRequest();
    await GoogleOAuthService.saveState(stateHash);
    const secure = process.env.NODE_ENV === 'production' || req.secure;
    res.setHeader('Set-Cookie', `agrinest_oauth_state=${state}; ${cookieOptions(600, secure).replace('Path=/', 'Path=/auth/google')}`);
    res.redirect(302, authorizationUrl);
  } catch (err) {
    const appUrl = applicationUrl();
    const errorCode = publicGoogleErrorCode(err);
    if (appUrl) return res.redirect(`${appUrl}/?auth_error=${encodeURIComponent(errorCode)}`);
    return sendAuthError(res, err, 'googleStart');
  }
});

router.post('/google/start', async (req, res) => {
  try {
    const registration = GoogleOAuthService.normalizeRegistrationIntent(req.body.registration);
    const { state, stateHash, authorizationUrl } = GoogleOAuthService.createAuthorizationRequest();
    await GoogleOAuthService.saveState(stateHash, registration);
    const secure = process.env.NODE_ENV === 'production' || req.secure;
    res.setHeader('Set-Cookie', `agrinest_oauth_state=${state}; ${cookieOptions(600, secure).replace('Path=/', 'Path=/auth/google')}`);
    return res.status(200).json({ authorization_url: authorizationUrl });
  } catch (err) {
    return sendAuthError(res, err, 'googleStart');
  }
});

router.get('/google/callback', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  const appUrl = applicationUrl();
  if (!appUrl) return res.status(503).json({ error: 'app_base_url_not_configured' });
  const secure = process.env.NODE_ENV === 'production' || req.secure;
  res.setHeader('Set-Cookie', `agrinest_oauth_state=; ${cookieOptions(0, secure).replace('Path=/', 'Path=/auth/google')}`);
  try {
    const state = String(req.query.state || '');
    const cookieState = readCookie(req, 'agrinest_oauth_state');
    const registrationIntent = state && cookieState && state === cookieState
      ? await GoogleOAuthService.consumeState(GoogleOAuthService.hashState(state))
      : null;
    if (!registrationIntent) {
      return res.redirect(`${appUrl}/?auth_error=google_state_invalid`);
    }
    if (req.query.error || !req.query.code) {
      return res.redirect(`${appUrl}/?auth_error=google_signin_cancelled`);
    }
    const registration = Object.keys(registrationIntent).length ? registrationIntent : null;
    const exchangeCode = await GoogleOAuthService.consumeAuthorizationCode(String(req.query.code), registration);
    return res.redirect(`${appUrl}/?google_code=${encodeURIComponent(exchangeCode)}`);
  } catch (err) {
    if (!Number(err.status) || Number(err.status) >= 500) console.error('AuthController.googleCallback', err.message);
    return res.redirect(`${appUrl}/?auth_error=${encodeURIComponent(publicGoogleErrorCode(err))}`);
  }
});

router.post('/google/exchange', async (req, res) => {
  try {
    const result = await AuthService.exchangeGoogleCode(req.body.code);
    setSessionCookie(res, result, req);
  } catch (err) {
    sendAuthError(res, err, 'googleExchange');
  }
});

router.get('/me', authenticate, (req, res) => {
  res.json({
    user: req.authUser,
    impersonation: req.authImpersonation
      ? { admin: req.authImpersonation.actor, expires_at: req.authImpersonation.expiresAt }
      : null,
  });
});

router.get('/profile', authenticate, async (req, res) => {
  try {
    return res.json(await AuthService.getFarmerProfile(req.authUser.user_id));
  } catch (err) {
    return sendAuthError(res, err, 'getFarmerProfile');
  }
});

router.put('/profile', authenticate, async (req, res) => {
  try {
    return res.json(await AuthService.saveFarmerProfile(req.authUser.user_id, req.body.profile));
  } catch (err) {
    return sendAuthError(res, err, 'saveFarmerProfile');
  }
});

router.put('/persona', authenticate, async (req, res) => {
  if (req.authImpersonation) return res.status(403).json({ error: 'persona_change_unavailable_during_impersonation' });
  try {
    const user = await AuthService.setFarmerPersona({
      userId: req.authUser.user_id,
      personaId: req.body.persona_id,
    });
    return res.json({ user });
  } catch (err) {
    return sendAuthError(res, err, 'setFarmerPersona');
  }
});

router.post('/admin/impersonate', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await AuthService.startAdminImpersonation({
      actorId: req.authUser.user_id,
      actorSessionId: req.authSessionId,
      targetId: req.body.user_id,
    });
    const secure = process.env.NODE_ENV === 'production' || req.secure;
    const maxAge = Math.max(0, Math.ceil((new Date(result.expiresAt).getTime() - Date.now()) / 1000));
    res.setHeader('Set-Cookie', `agrinest_impersonation=${encodeURIComponent(result.token)}; ${cookieOptions(maxAge, secure)}`);
    return res.status(200).json({
      user: result.user,
      impersonation: { admin: result.admin, expires_at: result.expiresAt },
    });
  } catch (err) {
    return sendAuthError(res, err, 'startAdminImpersonation');
  }
});

router.post('/admin/impersonate/end', authenticateAdminSession, async (req, res) => {
  try {
    const token = readCookie(req, 'agrinest_impersonation');
    await AuthService.endAdminImpersonation({ token, actorId: req.authUser.user_id });
    const secure = process.env.NODE_ENV === 'production' || req.secure;
    res.setHeader('Set-Cookie', `agrinest_impersonation=; ${cookieOptions(0, secure)}`);
    return res.json({ user: req.authUser });
  } catch (err) {
    return sendAuthError(res, err, 'endAdminImpersonation');
  }
});

router.post('/logout', async (req, res) => {
  try {
    const sessionToken = readBearerToken(req);
    const session = await AuthService.getSessionUser(sessionToken);
    if (session?.user.is_admin) {
      await AuthService.endAdminImpersonation({
        token: readCookie(req, 'agrinest_impersonation'),
        actorId: session.user.user_id,
        reason: 'administrator_signed_out',
      });
    }
    await AuthService.revokeSession(sessionToken);
    clearSessionCookie(res, req);
    res.status(200).json({ success: true });
  } catch (err) {
    clearSessionCookie(res, req);
    sendAuthError(res, err, 'logout');
  }
});

router.put('/pin', authenticate, async (req, res) => {
  try {
    res.json(await AuthService.setPin({
      userId: req.authUser.user_id,
      currentPassword: req.body.current_password,
      authenticatedAt: req.authSessionCreatedAt,
      pin: req.body.pin,
    }));
  } catch (err) {
    sendAuthError(res, err, 'setPin');
  }
});

router.delete('/pin', authenticate, async (req, res) => {
  try {
    res.json(await AuthService.removePin({
      userId: req.authUser.user_id,
      currentPassword: req.body.current_password,
      authenticatedAt: req.authSessionCreatedAt,
    }));
  } catch (err) {
    sendAuthError(res, err, 'removePin');
  }
});

router.put('/password', authenticate, async (req, res) => {
  try {
    await AuthService.changePassword({
      userId: req.authUser.user_id,
      currentPassword: req.body.current_password,
      newPassword: req.body.new_password,
    });
    clearSessionCookie(res, req);
    res.json({ success: true, reauthentication_required: true });
  } catch (err) {
    sendAuthError(res, err, 'changePassword');
  }
});

router.get('/admin/integrations', authenticate, requireAdmin, async (req, res) => {
  try {
    res.json({ integrations: await PlatformSettingsService.getIntegrations() });
  } catch (err) {
    sendAuthError(res, err, 'listIntegrations');
  }
});

router.patch('/admin/integrations/:integrationId', authenticate, requireAdmin, async (req, res) => {
  try {
    const integration = await PlatformSettingsService.setIntegrationEnabled({
      id: req.params.integrationId,
      enabled: req.body.enabled,
      actorId: req.authUser.user_id,
    });
    await AuthService.recordAdminAction({
      actorId: req.authUser.user_id,
      action: 'integration.updated',
      details: { integration_id: integration.id, enabled: integration.enabled },
    });
    res.json({ integration });
  } catch (err) {
    sendAuthError(res, err, 'updateIntegration');
  }
});

router.get('/admin/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const users = await AuthService.listAdminUsers({ query: req.query.q || '', status: req.query.status || '' });
    res.json({ users });
  } catch (err) {
    sendAuthError(res, err, 'listAdminUsers');
  }
});

router.get('/admin/audit', authenticate, requireAdmin, async (req, res) => {
  try {
    res.json({ entries: await AuthService.listAdminAuditLog(req.query.limit) });
  } catch (err) {
    sendAuthError(res, err, 'listAdminAuditLog');
  }
});

router.post('/admin/invitations', authenticate, requireAdmin, async (req, res) => {
  try {
    const invitation = await AuthService.createInvitation({
      personaId: req.body.persona_id,
      createdBy: req.authUser.user_id,
      expiresInDays: req.body.expires_in_days,
    });
    await AuthService.recordAdminAction({
      actorId: req.authUser.user_id,
      action: 'invitation.created',
      details: { persona_id: invitation.persona_id },
    });
    res.status(201).json(invitation);
  } catch (err) {
    sendAuthError(res, err, 'createInvitation');
  }
});

router.post('/admin/approvals/:userId', authenticate, requireAdmin, async (req, res) => {
  try {
    const user = await AuthService.approvePersona(req.params.userId);
    await AuthService.recordAdminAction({
      actorId: req.authUser.user_id,
      targetId: req.params.userId,
      action: 'user.approved',
    });
    res.status(200).json({ user });
  } catch (err) {
    sendAuthError(res, err, 'approvePersona');
  }
});

router.patch('/admin/users/:userId/status', authenticate, requireAdmin, async (req, res) => {
  try {
    res.json(await AuthService.setUserStatus({
      actorId: req.authUser.user_id,
      userId: req.params.userId,
      status: req.body.status,
    }));
  } catch (err) {
    sendAuthError(res, err, 'setUserStatus');
  }
});

router.patch('/admin/users/:userId/persona', authenticate, requireAdmin, async (req, res) => {
  try {
    res.json(await AuthService.setUserPersona({
      actorId: req.authUser.user_id,
      userId: req.params.userId,
      personaId: req.body.persona_id,
    }));
  } catch (err) {
    sendAuthError(res, err, 'setUserPersona');
  }
});

module.exports = router;
