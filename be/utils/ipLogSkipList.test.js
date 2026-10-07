import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { before, describe, it } from 'node:test';

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'iplog-test-'));
process.env.HOME = tmpHome;

let ipLog;
let hardCopy;
let loginLog;
let backup;

before(async () => {
  ipLog = await import('./ipLogSkipList.js');
  hardCopy = await import('./hardCopyAuthLog.js');
  loginLog = await import('./loginLog.js');
  backup = await import('./tutaMallUserBackup.js');
});

function readLog(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

describe('ipLogSkipList', () => {
  it('skips local and home IPs, including IPv4-mapped and /prefix forms', () => {
    assert.equal(ipLog.shouldSkipIpLog('127.0.0.1'), true);
    assert.equal(ipLog.shouldSkipIpLog('::ffff:72.83.247.73'), true);
    assert.equal(ipLog.shouldSkipIpLog('72.83.247.73/32'), true);
    assert.equal(ipLog.shouldSkipIpLog('203.0.113.45'), false);
    assert.equal(ipLog.shouldSkipIpLog(''), false);
  });
});

describe('hard-copy text logs', () => {
  it('writes the full IP for demo and register lines', () => {
    hardCopy.appendDemoLoginHardCopy({ clientIp: '::ffff:203.0.113.45' });
    hardCopy.appendRegisterHardCopy({ clientIp: '198.51.100.7', email: 'a@b.com', phone: '+15550001111' });
    assert.match(
      readLog(hardCopy.DEMO_HARD_COPY_LOG_PATH),
      /\tlogin=demo\tip=203\.0\.113\.45\tdevice=-\tbrowser=-\tos=-\n$/
    );
    assert.match(
      readLog(hardCopy.REGISTER_HARD_COPY_LOG_PATH),
      /\tip=198\.51\.100\.7\temail=a@b\.com\tphone=\+15550001111\tdevice=-\tbrowser=-\tos=-\n$/
    );
  });

  it('writes device, browser and OS when known', () => {
    hardCopy.appendDemoLoginHardCopy({
      clientIp: '203.0.113.46',
      device: { deviceType: 'Mobile', browser: 'Safari', os: 'iOS' }
    });
    assert.match(
      readLog(hardCopy.DEMO_HARD_COPY_LOG_PATH),
      /\tip=203\.0\.113\.46\tdevice=Mobile\tbrowser=Safari\tos=iOS\n$/
    );
  });

  it('does not write demo / register lines for 127.0.0.1 or 72.83.247.73', () => {
    const demoBefore = readLog(hardCopy.DEMO_HARD_COPY_LOG_PATH);
    const registerBefore = readLog(hardCopy.REGISTER_HARD_COPY_LOG_PATH);
    hardCopy.appendDemoLoginHardCopy({ clientIp: '127.0.0.1' });
    hardCopy.appendDemoLoginHardCopy({ clientIp: '72.83.247.73' });
    hardCopy.appendRegisterHardCopy({ clientIp: '72.83.247.73', email: 'x@y.com', phone: '+15550002222' });
    assert.equal(readLog(hardCopy.DEMO_HARD_COPY_LOG_PATH), demoBefore);
    assert.equal(readLog(hardCopy.REGISTER_HARD_COPY_LOG_PATH), registerBefore);
  });
});

describe('Admin Tools login_log IP display', () => {
  it('shows full IPs and keeps legacy last-digit rows as x.x.x.N', () => {
    assert.equal(loginLog.formatLoginLogIpForDisplay('203.0.113.45/32'), '203.0.113.45');
    assert.equal(loginLog.formatLoginLogIpForDisplay('0.0.0.5'), 'x.x.x.5');
    assert.equal(loginLog.formatLoginLogIpForDisplay(null), '');
  });
});

describe('TutaMall backup / restore log protection', () => {
  it('refuses to wipe ~/.ssh/be, files inside it, or any parent of it', () => {
    const beDir = path.join(tmpHome, '.ssh', 'be');
    assert.throws(() => backup.assertNotProtectedLogPath(beDir), /protected log location/);
    assert.throws(() => backup.assertNotProtectedLogPath(path.join(beDir, 'demolog.log')), /protected log location/);
    assert.throws(() => backup.assertNotProtectedLogPath(tmpHome), /protected log location/);
    assert.throws(() => backup.assertNotProtectedLogPath('/'), /protected log location/);
    assert.doesNotThrow(() => backup.assertNotProtectedLogPath(path.join(tmpHome, 'tutamallBackup', 'a2')));
  });

  it('refuses to delete login_log rows', () => {
    assert.throws(() => backup.assertNotProtectedLogTable('login_log'), /protected log table/);
    assert.doesNotThrow(() => backup.assertNotProtectedLogTable('photos'));
  });
});
