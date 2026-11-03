const AuthService = require('../services/AuthService');

function readCookie(request, name) {
  const cookie = String(request.headers.cookie || '').split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`));
  if (!cookie) return '';
  try {
    return decodeURIComponent(cookie.slice(name.length + 1));
  } catch {
    return '';
  }
}

function readBearerToken(request) {
  const cookieToken = readCookie(request, 'agrinest_session');
  if (cookieToken) return cookieToken;
  const authorization = String(request.headers.authorization || '');
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match ? match[1].trim() : '';
}

async function authenticate(request, response, next) {
  const impersonationToken = readCookie(request, 'agrinest_impersonation');
  if (impersonationToken) {
    try {
      const impersonation = await AuthService.getAdminImpersonation(impersonationToken);
      if (impersonation) {
        request.authUser = impersonation.user;
        request.authSessionCreatedAt = null;
        request.authImpersonation = {
          token: impersonationToken,
          sessionId: impersonation.sessionId,
          actor: impersonation.actor,
          expiresAt: impersonation.expiresAt,
        };
        return next();
      }
      response.append('Set-Cookie', 'agrinest_impersonation=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
    } catch (error) {
      console.error('Admin impersonation authentication failed:', error.message);
      return response.status(503).json({ error: 'authentication_unavailable' });
    }
  }

  const token = readBearerToken(request);
  if (!token) return response.status(401).json({ error: 'authentication_required' });

  try {
    const session = await AuthService.getSessionUser(token);
    if (!session) return response.status(401).json({ error: 'session_invalid_or_expired' });
    request.authUser = session.user;
    request.authSessionCreatedAt = session.sessionCreatedAt;
    request.authSessionId = session.sessionId;
    request.authToken = token;
    return next();
  } catch (error) {
    console.error('Auth middleware failed:', error.message);
    return response.status(503).json({ error: 'authentication_unavailable' });
  }
}

async function authenticateAdminSession(request, response, next) {
  const token = readBearerToken(request);
  if (!token) return response.status(401).json({ error: 'authentication_required' });
  try {
    const session = await AuthService.getSessionUser(token);
    if (!session) return response.status(401).json({ error: 'session_invalid_or_expired' });
    if (!session.user.is_admin) return response.status(403).json({ error: 'admin_access_required' });
    request.authUser = session.user;
    request.authSessionCreatedAt = session.sessionCreatedAt;
    request.authSessionId = session.sessionId;
    request.authToken = token;
    return next();
  } catch (error) {
    console.error('Admin session authentication failed:', error.message);
    return response.status(503).json({ error: 'authentication_unavailable' });
  }
}

function requirePersona(...allowedPersonas) {
  return (request, response, next) => {
    if (!request.authUser) return response.status(401).json({ error: 'authentication_required' });
    if (!allowedPersonas.includes(request.authUser.persona_id)
      && !allowedPersonas.includes(request.authUser.role)) {
      return response.status(403).json({ error: 'persona_not_authorized' });
    }
    return next();
  };
}

function requireAdmin(request, response, next) {
  if (!request.authUser) return response.status(401).json({ error: 'authentication_required' });
  if (!request.authUser.is_admin) return response.status(403).json({ error: 'admin_access_required' });
  return next();
}

module.exports = { authenticate, authenticateAdminSession, readBearerToken, readCookie, requireAdmin, requirePersona };