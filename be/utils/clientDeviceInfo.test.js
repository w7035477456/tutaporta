import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseClientDevice } from './clientDeviceInfo.js';

const CASES = [
  [
    'Mac Chrome',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    { deviceType: 'Desktop', browser: 'Chrome', os: 'Mac' }
  ],
  [
    'Mac Safari',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
    { deviceType: 'Desktop', browser: 'Safari', os: 'Mac' }
  ],
  [
    'Windows Edge',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
    { deviceType: 'Desktop', browser: 'Edge', os: 'Windows' }
  ],
  [
    'Ubuntu Firefox',
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
    { deviceType: 'Desktop', browser: 'Firefox', os: 'Ubuntu' }
  ],
  [
    'Linux Chrome',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    { deviceType: 'Desktop', browser: 'Chrome', os: 'Linux' }
  ],
  [
    'iPhone Safari',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    { deviceType: 'Mobile', browser: 'Safari', os: 'iOS' }
  ],
  [
    'iPhone Chrome',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1',
    { deviceType: 'Mobile', browser: 'Chrome', os: 'iOS' }
  ],
  [
    'Android Samsung',
    'Mozilla/5.0 (Linux; Android 14; SM-S921U) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
    { deviceType: 'Mobile', browser: 'Samsung', os: 'Android' }
  ]
];

describe('parseClientDevice', () => {
  for (const [name, ua, expected] of CASES) {
    it(name, () => {
      assert.deepEqual(parseClientDevice(ua), expected);
    });
  }

  it('returns null without a User-Agent', () => {
    assert.equal(parseClientDevice(''), null);
    assert.equal(parseClientDevice(null), null);
  });
});
