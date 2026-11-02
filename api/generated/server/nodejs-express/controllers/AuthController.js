const express = require('express');
const router = express.Router();
const AuthService = require('../../../../services/AuthService');
const GoogleOAuthService = require('../../../../services/GoogleOAuthService');
const PlatformSettingsService = require('../../../../services/PlatformSettingsService');
const { authenticate, readBearerToken, requireAdmin } = require('../../../../middleware/auth');

function sendAuthError(response, error, operation) {
  const status = Number(error.status) || 500;
  if (status >= 500) console.error(`AuthController.${operation}`, error.message);
  return response.status(status).json({ error: error.code || 'auth_error' });
}

function cookieOptions(maxAgeSeconds, secure = process.env.NODE_ENV === 'production') {
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure ? '; Secure' : ''}`;
}

function readCookie(request, name) {
  const cookies = String(request.headers.cookie || '').split(';');
  const entry = cookies.map((cookie) => cookie.trim()).find((cookie) => cookie.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : '';
}

function setSessionCookie(response, result, request) {
  if (!result.token) return response.status(200).json(result);
  const maxAge = Math.max(0, Math.ceil((new Date(result.expires_at).getTime() - Date.now()) / 1000));
  const secure = process.env.NODE_ENV === 'production' || request.secure;
  response.setHeader('Set-Cookie', `agrinest_session=${encodeURIComponent(result.token)}; ${cookieOptions(maxAge, secure)}`);
  return response.status(response.statusCode || 200).json({ user: result.user, expires_at: result.expires_at });
}

function clearSessionCookie(response, request) {
  const secure = process.env.NODE_ENV === 'production' || request.secure;
  response.setHeader('Set-Cookie', `agrinest_session=; ${cookieOptions(0, secure)}`);
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
    sendAuthError(res, err, 'googleStart');
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
    if (!state || !cookieState || state !== cookieState
      || !await GoogleOAuthService.consumeState(GoogleOAuthService.hashState(state))) {
      return res.redirect(`${appUrl}/?auth_error=google_state_invalid`);
    }
    if (req.query.error || !req.query.code) {
      return res.redirect(`${appUrl}/?auth_error=google_signin_cancelled`);
    }
    const exchangeCode = await GoogleOAuthService.consumeAuthorizationCode(String(req.query.code));
    return res.redirect(`${appUrl}/?google_code=${encodeURIComponent(exchangeCode)}`);
  } catch (err) {
    if (!Number(err.status) || Number(err.status) >= 500) console.error('AuthController.googleCallback', err.message);
    return res.redirect(`${appUrl}/?auth_error=google_signin_failed`);
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
  res.json({ user: req.authUser });
});

router.post('/logout', async (req, res) => {
  try {
    await AuthService.revokeSession(readBearerToken(req));
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
