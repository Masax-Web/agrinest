const AuthService = require('../services/AuthService');

function readBearerToken(request) {
  const cookie = String(request.headers.cookie || '').split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith('agrinest_session='));
  if (!cookie) return '';
  try {
    const cookieToken = decodeURIComponent(cookie.slice('agrinest_session='.length));
    if (cookieToken) return cookieToken;
  } catch {
    return '';
  }
  const authorization = String(request.headers.authorization || '');
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match ? match[1].trim() : '';
}

async function authenticate(request, response, next) {
  const token = readBearerToken(request);
  if (!token) return response.status(401).json({ error: 'authentication_required' });

  try {
    const session = await AuthService.getSessionUser(token);
    if (!session) return response.status(401).json({ error: 'session_invalid_or_expired' });
    request.authUser = session.user;
    request.authSessionCreatedAt = session.sessionCreatedAt;
    request.authToken = token;
    return next();
  } catch (error) {
    console.error('Auth middleware failed:', error.message);
    return response.status(503).json({ error: 'authentication_unavailable' });
  }
}

function requirePersona(...allowedPersonas) {
  return (request, response, next) => {
    if (!request.authUser) return response.status(401).json({ error: 'authentication_required' });
    if (!allowedPersonas.includes(request.authUser.role)) return response.status(403).json({ error: 'persona_not_authorized' });
    return next();
  };
}

function requireAdmin(request, response, next) {
  if (!request.authUser) return response.status(401).json({ error: 'authentication_required' });
  if (!request.authUser.is_admin) return response.status(403).json({ error: 'admin_access_required' });
  return next();
}

module.exports = { authenticate, readBearerToken, requireAdmin, requirePersona };