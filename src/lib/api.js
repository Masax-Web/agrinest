const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL)
  ? import.meta.env.VITE_API_BASE_URL
  : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof payload === 'object' && payload ? payload.error || payload.message : payload;
    throw new Error(message || `Request failed with status ${response.status}`);
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

  async sendSms(data) {
    return apiRequest('/communications/sms/send', { method: 'POST', body: JSON.stringify(data) });
  },

  async makeVoiceCall(data) {
    return apiRequest('/communications/voice/call', { method: 'POST', body: JSON.stringify(data) });
  },

  async topupAirtime(data) {
    return apiRequest('/communications/airtime/topup', { method: 'POST', body: JSON.stringify(data) });
  },

  async loginWithGoogle(data) {
    return apiRequest('/communications/google/login', { method: 'POST', body: JSON.stringify(data) });
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
