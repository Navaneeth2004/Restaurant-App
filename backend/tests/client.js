'use strict';
/** Tiny HTTP client with a cookie jar, for the smoke tests. */
class Client {
  constructor(base) { this.base = base; this.jar = {}; }
  cookieHeader() { return Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join('; '); }
  store(res) {
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const i = pair.indexOf('=');
      const k = pair.slice(0, i), v = pair.slice(i + 1);
      if (/Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(line) || v === '') delete this.jar[k]; else this.jar[k] = v;
    }
  }
  async call(method, path, body, headers = {}) {
    const opts = { method, headers: { cookie: this.cookieHeader(), ...headers } };
    if (body !== undefined && !(body instanceof FormData)) { opts.headers['content-type'] = 'application/json'; opts.body = JSON.stringify(body); }
    else if (body instanceof FormData) opts.body = body;
    const res = await fetch(this.base + path, opts);
    this.store(res);
    const type = res.headers.get('content-type') || '';
    let data;
    if (type.includes('json')) data = await res.json();
    else if (type.includes('zip') || type.includes('octet')) data = Buffer.from(await res.arrayBuffer());
    else data = await res.text();
    return { status: res.status, data, headers: res.headers };
  }
  get(p) { return this.call('GET', p); }
  post(p, b) { return this.call('POST', p, b ?? {}); }
  put(p, b) { return this.call('PUT', p, b ?? {}); }
  patch(p, b) { return this.call('PATCH', p, b ?? {}); }
  del(p, b) { return this.call('DELETE', p, b); }
}

module.exports = { Client };
