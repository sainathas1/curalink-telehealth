#!/usr/bin/env node
'use strict';

// Every provider, authentication request, environment value, and response is mocked.
// The VM cannot load an unapproved module or contact an external service.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const routePath = path.resolve(__dirname, '../app/api/create-order/route.ts');
const routeSource = ts.transpileModule(fs.readFileSync(routePath, 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
}).outputText;

async function verifyScenario(name, options = {}) {
  const routeExports = {};
  let providerCalls = 0;
  let authenticationCalls = 0;

  class MockRazorpay {
    constructor(credentials) {
      assert.equal(credentials.key_id, 'mock-provider-key');
      assert.equal(credentials.key_secret, 'mock-provider-secret');
      this.orders = {
        create: async (order) => {
          providerCalls++;
          assert.equal(order.amount, 50000);
          assert.equal(order.currency, 'INR');
          if (options.providerError) throw new Error('Mock provider failure');
          return options.order || { id: 'order_verified123', amount: 50000, currency: 'INR' };
        },
      };
    }
  }

  vm.runInNewContext(routeSource, {
    exports: routeExports,
    module: { exports: routeExports },
    require(moduleName) {
      if (moduleName === 'next/server') {
        return {
          NextResponse: {
            json: (body, init) => ({ status: init?.status || 200, body, headers: init?.headers }),
          },
        };
      }
      if (moduleName === 'razorpay') return MockRazorpay;
      if (moduleName.endsWith('firebase-applet-config.json')) return { apiKey: 'mock-public-api-key' };
      throw new Error(`Unmocked module rejected: ${moduleName}`);
    },
    process: {
      env: options.missingCredentials ? {} : {
        NEXT_PUBLIC_RAZORPAY_KEY_ID: 'mock-provider-key',
        RAZORPAY_KEY_SECRET: 'mock-provider-secret',
      },
    },
    fetch: async (url, init) => {
      authenticationCalls++;
      assert.equal(url, 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=mock-public-api-key');
      assert.equal(JSON.parse(init.body).idToken, 'mock-session');
      assert.equal(init.method, 'POST');
      assert.equal(init.cache, 'no-store');
      if (options.authenticationError) throw new Error('Mock authentication failure');
      const status = options.authenticationStatus || 200;
      return {
        status,
        ok: status >= 200 && status < 300,
        json: async () => {
          if (options.malformedAuthenticationResponse) throw new SyntaxError('Mock malformed response');
          return options.authenticationBody || { users: [{ localId: 'mock-patient' }] };
        },
      };
    },
    AbortSignal,
    console: { error() {} },
  });

  const authorization = options.noToken ? undefined : options.authorization || 'Bearer mock-session';
  const request = new Request('http://localhost/api/create-order', {
    method: 'POST',
    headers: authorization ? { Authorization: authorization } : {},
  });
  const response = await routeExports.POST(request);
  assert.equal(response.status, options.expectedStatus || 200, name);
  assert.equal(response.headers['Cache-Control'], 'no-store');

  if (response.status === 200) {
    assert.equal(response.body.orderId, 'order_verified123');
    assert.equal(response.body.amount, 50000);
    assert.equal(response.body.currency, 'INR');
    assert.equal(authenticationCalls, 1);
    assert.equal(providerCalls, 1);
  } else {
    assert.equal(typeof response.body.error, 'string');
    assert.ok(response.body.error.length > 0);
    assert.equal(response.body.orderId, undefined, 'Failure must not return an order');
    assert.equal(response.body.fallback, undefined, 'Failure must not simulate payment success');
  }

  if (options.noToken || options.authorization || options.missingCredentials) {
    assert.equal(authenticationCalls, 0, 'Reject invalid requests before authentication network work');
  }
  if (options.noToken || options.authorization || options.missingCredentials ||
      options.authenticationError || options.authenticationStatus || options.authenticationBody ||
      options.malformedAuthenticationResponse) {
    assert.equal(providerCalls, 0, 'Do not create an order before authentication succeeds');
  }
  console.log(`PASS ${name} (${response.status})`);
}

async function main() {
  const scenarios = [
    ['missing session', { noToken: true, expectedStatus: 401 }],
    ['invalid authorization scheme', { authorization: 'Basic mock-session', expectedStatus: 401 }],
    ['missing credentials', { missingCredentials: true, expectedStatus: 503 }],
    ['expired session', { authenticationStatus: 400, expectedStatus: 401 }],
    ['authentication service unavailable', { authenticationStatus: 503, expectedStatus: 503 }],
    ['authentication rate limited', { authenticationStatus: 429, expectedStatus: 503 }],
    ['authentication connection failed', { authenticationError: true, expectedStatus: 503 }],
    ['malformed authentication response', { malformedAuthenticationResponse: true, expectedStatus: 503 }],
    ['disabled account', { authenticationBody: { users: [{ localId: 'mock-patient', disabled: true }] }, expectedStatus: 401 }],
    ['missing account', { authenticationBody: { users: [] }, expectedStatus: 401 }],
    ['provider failed', { providerError: true, expectedStatus: 502 }],
    ['provider order missing', { order: { amount: 50000, currency: 'INR' }, expectedStatus: 502 }],
    ['provider order malformed', { order: { id: 'invalid', amount: 50000, currency: 'INR' }, expectedStatus: 502 }],
    ['provider amount mismatched', { order: { id: 'order_mock123', amount: 1, currency: 'INR' }, expectedStatus: 502 }],
    ['provider currency mismatched', { order: { id: 'order_mock123', amount: 50000, currency: 'USD' }, expectedStatus: 502 }],
    ['authenticated provider order', {}],
  ];
  for (const [name, options] of scenarios) await verifyScenario(name, options);
  console.log(`PASS ${scenarios.length} payment scenarios; no network calls or real credentials used.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
