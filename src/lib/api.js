const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL)
  ? import.meta.env.VITE_API_BASE_URL
  : (typeof window !== 'undefined'
    ? ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:3000'
      : window.location.origin)
    : 'http://localhost:3000');

async function apiRequest(path, options = {}) {
  const { headers, ...requestOptions } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {}),
    },
    credentials: 'include',
    ...requestOptions,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof payload === 'object' && payload ? payload.error || payload.message : payload;
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  if (!contentType.includes('application/json')) {
    throw new Error('The API returned a non-JSON response. Check the local backend connection.');
  }

  return payload;
}

export const api = {
  async registerUser(data) {
    return apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(data) });
  },

  async loginUser(data) {
    return apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(data) });
  },

  async getAuthUser() {
    return apiRequest('/auth/me');
  },

  async startAdminImpersonation(userId) {
    return apiRequest('/auth/admin/impersonate', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  },

  async endAdminImpersonation() {
    return apiRequest('/auth/admin/impersonate/end', { method: 'POST' });
  },

  async logoutUser() {
    return apiRequest('/auth/logout', { method: 'POST' });
  },

  async exchangeGoogleCode(code) {
    return apiRequest('/auth/google/exchange', { method: 'POST', body: JSON.stringify({ code }) });
  },

  async startGoogleAuth(registration) {
    return apiRequest('/auth/google/start', {
      method: 'POST',
      body: JSON.stringify(registration ? { registration } : {}),
    });
  },

  async verifyPin(challengeToken, pin) {
    return apiRequest('/auth/pin/verify', {
      method: 'POST',
      body: JSON.stringify({ challenge_token: challengeToken, pin }),
    });
  },

  async setPin(currentPassword, pin) {
    const body = { pin };
    if (currentPassword) body.current_password = currentPassword;
    return apiRequest('/auth/pin', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  async removePin(currentPassword) {
    const body = {};
    if (currentPassword) body.current_password = currentPassword;
    return apiRequest('/auth/pin', {
      method: 'DELETE',
      body: JSON.stringify(body),
    });
  },

  async changePassword(currentPassword, newPassword) {
    return apiRequest('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
  },

  async getAdminUsers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/auth/admin/users${query ? `?${query}` : ''}`);
  },

  async setAdminUserStatus(userId, status) {
    return apiRequest(`/auth/admin/users/${encodeURIComponent(userId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  async setAdminUserPersona(userId, personaId) {
    return apiRequest(`/auth/admin/users/${encodeURIComponent(userId)}/persona`, {
      method: 'PATCH',
      body: JSON.stringify({ persona_id: personaId }),
    });
  },

  async approveAdminUser(userId) {
    return apiRequest(`/auth/admin/approvals/${encodeURIComponent(userId)}`, { method: 'POST' });
  },

  async getAdminAudit(limit = 100) {
    return apiRequest(`/auth/admin/audit?limit=${encodeURIComponent(limit)}`);
  },

  async getAdminIntegrations() {
    return apiRequest('/auth/admin/integrations');
  },

  async setAdminIntegration(id, enabled) {
    return apiRequest(`/auth/admin/integrations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    });
  },

  async createAdminInvitation(personaId, expiresInDays = 7) {
    return apiRequest('/auth/admin/invitations', {
      method: 'POST',
      body: JSON.stringify({ persona_id: personaId, expires_in_days: expiresInDays }),
    });
  },

  async getAdminMessages() {
    return apiRequest('/community/admin/messages');
  },

  async deleteAdminMessage(messageId) {
    return apiRequest(`/community/admin/messages/${encodeURIComponent(messageId)}`, { method: 'DELETE' });
  },

  async createUser(data) {
    return apiRequest('/users', { method: 'POST', body: JSON.stringify(data) });
  },

  async getUsers() {
    return apiRequest('/users');
  },

  async createFarm(data) {
    return apiRequest('/farms', { method: 'POST', body: JSON.stringify(data) });
  },

  async getFarm(farmId) {
    return apiRequest(`/farms/${farmId}`);
  },

  async listFarms() {
    return apiRequest('/farms');
  },

  async createField(data) {
    return apiRequest('/fields', { method: 'POST', body: JSON.stringify(data) });
  },

  async diagnoseCrop(data) {
    return apiRequest('/jicho/scan', { method: 'POST', body: JSON.stringify(data) });
  },

  async getJichoScans(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/jicho/scans${query ? `?${query}` : ''}`);
  },

  async createListing(data) {
    return apiRequest('/soko/listings', { method: 'POST', body: JSON.stringify(data) });
  },

  async getListings() {
    return apiRequest('/soko/listings');
  },

  async createMarketplaceActivity(data) {
    return apiRequest('/soko/activity', { method: 'POST', body: JSON.stringify(data) });
  },

  async getMarketplaceActivity(limit = 12) {
    return apiRequest(`/soko/activity?limit=${encodeURIComponent(limit)}`);
  },

  async createMarketplaceOrder(data) {
    return apiRequest('/soko/orders', { method: 'POST', body: JSON.stringify(data) });
  },

  subscribeMarketplaceActivity(onActivity, onConnectionChange, afterActivityId = 0) {
    const eventUrl = new URL('/soko/events', API_BASE_URL);
    eventUrl.searchParams.set('after', String(afterActivityId));
    const source = new EventSource(eventUrl, { withCredentials: true });
    source.addEventListener('market', (event) => {
      try {
        onActivity(JSON.parse(event.data));
      } catch (error) {
        console.error('Invalid marketplace activity event:', error);
      }
    });
    source.onopen = () => onConnectionChange?.(true);
    source.onerror = () => onConnectionChange?.(false);
    return () => source.close();
  },

  async sendSms(data) {
    return apiRequest('/communications/sms/send', { method: 'POST', body: JSON.stringify(data) });
  },

  async makeVoiceCall(data) {
    return apiRequest('/communications/voice/call', { method: 'POST', body: JSON.stringify(data) });
  },

  async topupAirtime(data) {
    return apiRequest('/communications/airtime/topup', { method: 'POST', body: JSON.stringify(data) });
  },

  async scanThreat(data) {
    return apiRequest('/security/scan', { method: 'POST', body: JSON.stringify(data) });
  },

  async configureThreatDetection(data) {
    return apiRequest('/security/configure', { method: 'POST', body: JSON.stringify(data) });
  },

  async getThreatStatus(data) {
    return apiRequest('/security/status', { method: 'POST', body: JSON.stringify(data) });
  },

  async getCommunityConversations() {
    return apiRequest('/community/conversations');
  },

  async sendCommunityMessage(conversationId, data) {
    return apiRequest(`/community/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getStudentDashboard(studentId = 'demo-student') {
    return apiRequest(`/students/dashboard?student_id=${encodeURIComponent(studentId)}`);
  },

  async updateStudentProgress(data) {
    return apiRequest('/students/progress', { method: 'POST', body: JSON.stringify(data) });
  },

  async submitStudentAssignment(data) {
    return apiRequest('/students/assignments', { method: 'POST', body: JSON.stringify(data) });
  },

  async applyStudentOpportunity(data) {
    return apiRequest('/students/applications', { method: 'POST', body: JSON.stringify(data) });
  },
};

export default api;
