const { Buffer } = require('buffer');

const getFetch = () => {
  if (typeof fetch === 'function') {
    return fetch;
  }
  return (...args) =>
    import('node-fetch').then(({ default: fetchFn }) => fetchFn(...args));
};

const fetchFn = getFetch();

class ThingsBoardApi {
  constructor({ baseUrl, username, password, logger = console }) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.username = username;
    this.password = password;
    this.logger = logger;
    this.token = null;
    this.refreshToken = null;
    this.tokenExp = null;
  }

  async login() {
    const response = await fetchFn(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: this.username,
        password: this.password,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Login failed: ${response.status} ${text}`);
    }

    const data = await response.json();
    this.token = data.token;
    this.refreshToken = data.refreshToken;
    this.tokenExp = decodeJwtExp(this.token);
    this.logger.log('Logged in to ThingsBoard');
  }

  async refresh() {
    if (!this.refreshToken) {
      await this.login();
      return;
    }

    const response = await fetchFn(`${this.baseUrl}/api/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: this.refreshToken }),
    });

    if (!response.ok) {
      this.logger.warn('Token refresh failed, re-authenticating');
      await this.login();
      return;
    }

    const data = await response.json();
    this.token = data.token;
    this.refreshToken = data.refreshToken || this.refreshToken;
    this.tokenExp = decodeJwtExp(this.token);
    this.logger.log('Token refreshed');
  }

  async ensureToken() {
    if (!this.token || isTokenExpired(this.tokenExp)) {
      await this.refresh();
    }
  }

  async request(method, path, body) {
    await this.ensureToken();

    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-Authorization': `Bearer ${this.token}`,
    };

    let response = await fetchFn(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (response.status === 401) {
      await this.refresh();
      headers['X-Authorization'] = `Bearer ${this.token}`;
      response = await fetchFn(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Request failed: ${method} ${path} ${response.status} ${text}`
      );
    }

    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return response.json();
    }
    return response.text();
  }

  // ==================== Widget Bundles ====================

  async getWidgetsBundles() {
    const response = await this.request('GET', '/api/widgetsBundles?pageSize=1000&page=0');
    return response.data || response || [];
  }

  async getWidgetsBundleById(bundleId) {
    return this.request('GET', `/api/widgetsBundle/${bundleId}`);
  }

  async getWidgetsBundleByAlias(alias) {
    // Search through all bundles to find by alias
    const bundles = await this.getWidgetsBundles();
    return bundles.find(b => b.alias === alias) || null;
  }

  async saveWidgetsBundle(bundle) {
    return this.request('POST', '/api/widgetsBundle', bundle);
  }

  async deleteWidgetsBundle(bundleId) {
    return this.request('DELETE', `/api/widgetsBundle/${bundleId}`);
  }

  // ==================== Widget Types ====================

  async getBundleWidgetTypes(bundleAlias) {
    // Get all widget types for a bundle by its alias
    const response = await this.request('GET', `/api/widgetTypes?bundleAlias=${bundleAlias}&pageSize=1000&page=0`);
    return response.data || response || [];
  }

  async getBundleWidgetTypesDetails(bundleAlias) {
    // Get detailed widget types including full descriptor
    const response = await this.request('GET', `/api/widgetTypes?bundleAlias=${bundleAlias}&pageSize=1000&page=0`);
    const types = response.data || response || [];

    // Fetch full details for each widget type
    const detailed = [];
    for (const wt of types) {
      try {
        const full = await this.getWidgetTypeById(wt.id.id);
        detailed.push(full);
      } catch (err) {
        this.logger.warn(`Failed to fetch widget type ${wt.fqn}: ${err.message}`);
        detailed.push(wt);
      }
    }
    return detailed;
  }

  async getWidgetTypeById(widgetTypeId) {
    return this.request('GET', `/api/widgetType/${widgetTypeId}`);
  }

  async getWidgetTypeByFqn(fqn) {
    // Get widget type by fully qualified name
    return this.request('GET', `/api/widgetType?fqn=${encodeURIComponent(fqn)}`);
  }

  async saveWidgetType(widgetType) {
    return this.request('POST', '/api/widgetType', widgetType);
  }

  async deleteWidgetType(widgetTypeId) {
    return this.request('DELETE', `/api/widgetType/${widgetTypeId}`);
  }

  // ==================== All Widget Types (across all bundles) ====================

  async getAllWidgetTypes() {
    const response = await this.request('GET', '/api/widgetTypes?pageSize=1000&page=0');
    return response.data || response || [];
  }
}

function decodeJwtExp(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64').toString('utf8')
    );
    return payload.exp ? payload.exp * 1000 : null;
  } catch (err) {
    return null;
  }
}

function isTokenExpired(exp) {
  if (!exp) return true;
  const now = Date.now();
  return now >= exp - 60 * 1000;
}

module.exports = { ThingsBoardApi };
