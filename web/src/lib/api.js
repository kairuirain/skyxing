const API_BASE = '/server/api';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('skyxing_token') || null;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('skyxing_token', token);
    } else {
      localStorage.removeItem('skyxing_token');
    }
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }

  // Auth
  async register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async login(credentials) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async getMe() {
    return this.request('/auth/me');
  }

  // Articles
  async getArticles(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/articles?${query}`);
  }

  async getArticle(id) {
    return this.request(`/articles/${id}`);
  }

  async createArticle(data) {
    return this.request('/articles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateArticle(id, data) {
    return this.request(`/articles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteArticle(id) {
    return this.request(`/articles/${id}`, {
      method: 'DELETE',
    });
  }

  async pinArticle(id) {
    return this.request(`/articles/${id}/pin`, {
      method: 'PUT',
    });
  }

  async pinComment(id) {
    return this.request(`/comments/${id}/pin`, {
      method: 'PUT',
    });
  }

  async getUserByUsername(username) {
    return this.request(`/lookup/${username}`);
  }

  async getStateVersion() {
    return this.request('/state/version');
  }

  async getTags() {
    return this.request('/articles/tags');
  }

  // Comments
  async getComments(articleId) {
    return this.request(`/comments?articleId=${articleId}`);
  }

  async createComment(data) {
    return this.request('/comments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateComment(id, data) {
    return this.request(`/comments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteComment(id) {
    return this.request(`/comments/${id}`, {
      method: 'DELETE',
    });
  }

  // Users
  async getUser(id) {
    return this.request(`/users/${id}`);
  }

  async updateUser(id, data) {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Admin
  async getStats() {
    return this.request('/admin/stats');
  }

  // 管理员群发系统通知（支持 Markdown）
  async publishNotification(title, content, link) {
    return this.request('/admin/notify', {
      method: 'POST',
      body: JSON.stringify({ title, content, link }),
    });
  }

  async getAdminUsers() {
    return this.request('/admin/users');
  }

  async updateUserRole(id, role) {
    return this.request(`/admin/users/${id}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  }

  async deleteUser(id) {
    return this.request(`/admin/users/${id}`, {
      method: 'DELETE',
    });
  }

  async getAdminArticles(sortBy = 'createdAt', sortOrder = 'desc') {
    return this.request(`/admin/articles?sortBy=${sortBy}&sortOrder=${sortOrder}`);
  }

  async updateArticleWeight(id, weight) {
    return this.request(`/admin/articles/${id}/weight`, {
      method: 'PUT',
      body: JSON.stringify({ weight }),
    });
  }

  // Messages (private messaging)
  async getConversations() {
    return this.request('/messages/conversations');
  }

  async getUnreadCount() {
    return this.request('/messages/unread-count');
  }

  async createConversation(targetUserId) {
    return this.request('/messages/conversations', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    });
  }

  async startConversation(username) {
    return this.request('/messages/conversations/start', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
  }

  async getConversationMessages(convId) {
    return this.request(`/messages/conversations/${convId}`);
  }

  async sendMessage(convId, content) {
    return this.request(`/messages/conversations/${convId}`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async markRead(convId) {
    return this.request(`/messages/conversations/${convId}/read`, {
      method: 'PUT',
    });
  }

  async deleteConversation(convId) {
    return this.request(`/messages/conversations/${convId}`, {
      method: 'DELETE',
    });
  }

  // OTA updates
  async checkUpdate(platform, current, channel = 'stable') {
    const q = new URLSearchParams({ platform, current, channel }).toString();
    return this.request(`/updates/check?${q}`);
  }

  async getLatest(platform, channel = 'stable') {
    const q = new URLSearchParams({ platform, channel }).toString();
    return this.request(`/updates/latest?${q}`);
  }

  // Notifications (系统通知)
  async getNotifications() {
    return this.request('/notifications');
  }

  async markNotificationRead(id) {
    return this.request(`/notifications/${id}/read`, { method: 'PUT' });
  }

  async markAllNotificationsRead() {
    return this.request('/notifications/read-all', { method: 'PUT' });
  }

  // Account
  async deleteAccount() {
    return this.request('/users/me', { method: 'DELETE' });
  }

  // 2FA
  async setup2FA() {
    return this.request('/auth/2fa/setup', { method: 'POST' });
  }

  async verifySetup2FA(secret, code) {
    return this.request('/auth/2fa/verify-setup', { method: 'POST', body: JSON.stringify({ secret, code }) });
  }

  async disable2FA() {
    return this.request('/auth/2fa/disable', { method: 'POST' });
  }

  async verify2FALogin(tempToken, code) {
    return this.request('/auth/2fa/verify', { method: 'POST', body: JSON.stringify({ tempToken, code }) });
  }
}

export const api = new ApiClient();
export default api;
