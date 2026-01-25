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

  async getBundleWidgetTypeFqns(bundleId) {
    // Get list of widget type FQNs currently in the bundle
    return this.request('GET', `/api/widgetsBundle/${bundleId}/widgetTypeFqns`);
  }

  async updateBundleWidgetTypeFqns(bundleId, fqnList) {
    // Update widget types in bundle by FQN list
    // POST /api/widgetsBundle/{widgetsBundleId}/widgetTypeFqns
    return this.request('POST', `/api/widgetsBundle/${bundleId}/widgetTypeFqns`, fqnList);
  }

  async addWidgetTypesToBundle(bundleId, fqnList) {
    // Get current FQNs and merge with new ones
    let currentFqns = [];
    try {
      currentFqns = await this.getBundleWidgetTypeFqns(bundleId);
    } catch (err) {
      // Bundle might be empty
    }

    // Merge and deduplicate
    const allFqns = [...new Set([...currentFqns, ...fqnList])];
    return this.updateBundleWidgetTypeFqns(bundleId, allFqns);
  }

  // ==================== Widget Types ====================

  async getBundleWidgetTypes(bundleAlias) {
    // Get widget types for a bundle - first get bundle, then get FQNs, then get types
    const bundle = await this.getWidgetsBundleByAlias(bundleAlias);
    if (!bundle) {
      return [];
    }

    try {
      const fqns = await this.getBundleWidgetTypeFqns(bundle.id.id);
      if (!fqns || fqns.length === 0) {
        return [];
      }

      // Get widget type info for each FQN
      const types = [];
      for (const fqn of fqns) {
        try {
          const wt = await this.getWidgetTypeByFqn(fqn);
          if (wt) {
            types.push(wt);
          }
        } catch (err) {
          this.logger.warn(`Failed to fetch widget type ${fqn}: ${err.message}`);
        }
      }
      return types;
    } catch (err) {
      // Bundle might not have any widget types yet
      return [];
    }
  }

  async getBundleWidgetTypesDetails(bundleAlias) {
    // Same as getBundleWidgetTypes - returns full details
    return this.getBundleWidgetTypes(bundleAlias);
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

  // ==================== Resources (JS Libraries) ====================

  async getResources() {
    const response = await this.request('GET', '/api/resource?pageSize=1000&page=0');
    return response.data || response || [];
  }

  async getResourceByKey(resourceKey) {
    const resources = await this.getResources();
    return resources.find(r => r.resourceKey === resourceKey) || null;
  }

  async uploadResource(resourceKey, title, content, resourceType = 'JS_MODULE') {
    await this.ensureToken();

    // Use native https to avoid charset issues with fetch
    const https = require('https');
    const http = require('http');
    const { URL } = require('url');

    const boundary = '----ECOWidgetUpload' + Date.now();

    // Build multipart body
    const parts = [
      `--${boundary}\r\n`,
      `Content-Disposition: form-data; name="file"; filename="${resourceKey}"\r\n`,
      'Content-Type: application/javascript\r\n',
      '\r\n',
      content,
      `\r\n--${boundary}--\r\n`
    ];
    const body = Buffer.from(parts.join(''), 'utf8');

    const urlObj = new URL(`${this.baseUrl}/api/resource?resourceType=${resourceType}&title=${encodeURIComponent(title)}`);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;

    return new Promise((resolve, reject) => {
      const req = lib.request({
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'X-Authorization': `Bearer ${this.token}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              resolve(data);
            }
          } else {
            reject(new Error(`Resource upload failed: ${res.statusCode} ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  async deleteResource(resourceId) {
    return this.request('DELETE', `/api/resource/${resourceId}`);
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
