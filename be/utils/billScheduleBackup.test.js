import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  legacyBillScheduleTabsWouldCollapse,
  normalizeBackupTabLabel
} from './billScheduleBackupTabs.js';

describe('billScheduleBackup tabs', () => {
  it('normalizeBackupTabLabel keeps Medford / falls back to home1', () => {
    assert.equal(normalizeBackupTabLabel('Medford'), 'Medford');
    assert.equal(normalizeBackupTabLabel('  Rockfield  '), 'Rockfield');
    assert.equal(normalizeBackupTabLabel(''), 'home1');
    assert.equal(normalizeBackupTabLabel(null), 'home1');
  });

  it('detects legacy multi-tab backups that would collapse to home1', () => {
    const legacyMonthly = [
      { bill_year: 2026, bill_month: 11, row_index: 1, bill_description: 'Medford water' },
      { bill_year: 2026, bill_month: 11, row_index: 1, bill_description: 'Rockfield water' },
      { bill_year: 2026, bill_month: 11, row_index: 2, bill_description: 'Medford electric' }
    ];
    assert.equal(legacyBillScheduleTabsWouldCollapse(legacyMonthly, []), true);
  });

  it('allows current backups that include tab_label', () => {
    const current = [
      { tab_label: 'Medford', bill_year: 2026, bill_month: 11, row_index: 1 },
      { tab_label: 'Rockfield', bill_year: 2026, bill_month: 11, row_index: 1 },
      { tab_label: 'Auto', bill_year: 2026, bill_month: 11, row_index: 1 }
    ];
    assert.equal(legacyBillScheduleTabsWouldCollapse(current, []), false);
  });

  it('allows legacy single-tab backups (no collision)', () => {
    const single = [
      { bill_year: 2026, bill_month: 11, row_index: 1 },
      { bill_year: 2026, bill_month: 11, row_index: 2 }
    ];
    assert.equal(legacyBillScheduleTabsWouldCollapse(single, []), false);
  });
});
