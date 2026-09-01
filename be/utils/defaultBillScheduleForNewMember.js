/** Default Bill Schedule rows preloaded once when a new member account is created. */

export const DEFAULT_MONTHLY_BILL_ROWS = [
  {
    row_index: 1,
    bill_description: 'SAMPLE Mortgage Bill/Pay',
    due_day: 15,
    amount: '$2,542.00',
    bill_type: 'Auto',
    action: null
  },
  {
    row_index: 2,
    bill_description: 'SAMPLE Utility Bill',
    due_day: 25,
    amount: '',
    bill_type: 'Manual',
    action: 'Not Paid'
  },
  {
    row_index: 3,
    bill_description: 'SAMPLE Internet Bill',
    due_day: 5,
    amount: '$99.00',
    bill_type: 'Manual',
    action: 'Not Paid'
  },
  {
    row_index: 4,
    bill_description: 'SAMPLE Auto Insurance Bill',
    due_day: 10,
    amount: '',
    bill_type: 'Manual',
    action: null
  }
];

export const DEFAULT_YEARLY_BILL_ROWS = [
  {
    row_index: 1,
    bill_description: 'SAMPLE Real Estate Tax, 1st of two',
    bill_month: 5,
    due_month_day: 1,
    amount: '$3,583.00',
    bill_type: 'Manual',
    action: null
  },
  {
    row_index: 2,
    bill_description: 'SAMPLE Real Estate Tax, 2nd of two',
    bill_month: 11,
    due_month_day: 1,
    amount: '$3,583.00',
    bill_type: 'Manual',
    action: null
  },
  {
    row_index: 3,
    bill_description: 'SAMPLE Auto registration',
    bill_month: 10,
    due_month_day: 15,
    amount: '',
    bill_type: 'Manual',
    action: null
  },
  {
    row_index: 4,
    bill_description: 'SAMPLE Auto Safety Inspection',
    bill_month: 10,
    due_month_day: 1,
    amount: '',
    bill_type: 'Manual',
    action: null
  },
  {
    row_index: 5,
    bill_description: 'SAMPLE Anniversary',
    bill_month: 5,
    due_month_day: 1,
    amount: '',
    bill_type: 'Manual',
    action: null
  },
  {
    row_index: 6,
    bill_description: 'SAMPLE Birthday of xyz',
    bill_month: 6,
    due_month_day: 15,
    amount: '',
    bill_type: 'Manual',
    action: null
  }
];

const BILL_STORAGE_BACKENDS = ['onedrive', 'usb'];

function toSinglesId(raw) {
  const id = Math.trunc(Number(raw));
  if (!Number.isFinite(id) || id < 1) {
    throw new Error('singles_id required for default bill schedule');
  }
  return id;
}

async function countMonthlyRows(client, singlesId) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS c
       FROM helloworldjunktest.monthly_bill
      WHERE singles_id = $1`,
    [singlesId]
  );
  return Number(rows[0]?.c) || 0;
}

async function countYearlyRows(client, singlesId) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS c
       FROM helloworldjunktest.yearly_bill
      WHERE singles_id = $1`,
    [singlesId]
  );
  return Number(rows[0]?.c) || 0;
}

async function insertDefaultMonthlyRows(client, singlesId, year, month) {
  for (const storageBackend of BILL_STORAGE_BACKENDS) {
    for (const row of DEFAULT_MONTHLY_BILL_ROWS) {
      await client.query(
        `INSERT INTO helloworldjunktest.monthly_bill (
           singles_id, storage_backend, bill_year, bill_month, row_index,
           bill_description, due_day, amount, bill_type, action, paid_record_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL)`,
        [
          singlesId,
          storageBackend,
          year,
          month,
          row.row_index,
          row.bill_description,
          row.due_day,
          row.amount,
          row.bill_type,
          row.action
        ]
      );
    }
  }
}

async function insertDefaultYearlyRows(client, singlesId, year) {
  for (const storageBackend of BILL_STORAGE_BACKENDS) {
    for (const row of DEFAULT_YEARLY_BILL_ROWS) {
      await client.query(
        `INSERT INTO helloworldjunktest.yearly_bill (
           singles_id, storage_backend, bill_year, bill_month, row_index,
           bill_description, due_month_day, amount, bill_type, action, paid_record_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL)`,
        [
          singlesId,
          storageBackend,
          year,
          row.bill_month,
          row.row_index,
          row.bill_description,
          row.due_month_day,
          row.amount,
          row.bill_type,
          row.action
        ]
      );
    }
  }
}

/**
 * Preload sample Monthly + Yearly Bill Schedule rows for a brand-new member.
 * Runs once per account (skips when any bill rows already exist).
 * Intended to run inside the signup Primary transaction.
 */
export async function seedDefaultBillScheduleForNewMember(client, singlesId, now = new Date()) {
  const id = toSinglesId(singlesId);
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const existingMonthly = await countMonthlyRows(client, id);
  const existingYearly = await countYearlyRows(client, id);
  if (existingMonthly > 0 || existingYearly > 0) {
    return {
      billYear: year,
      billMonth: month,
      monthlyRowsInserted: 0,
      yearlyRowsInserted: 0,
      alreadySeeded: true
    };
  }

  await insertDefaultMonthlyRows(client, id, year, month);
  await insertDefaultYearlyRows(client, id, year);

  const monthlyCount = DEFAULT_MONTHLY_BILL_ROWS.length * BILL_STORAGE_BACKENDS.length;
  const yearlyCount = DEFAULT_YEARLY_BILL_ROWS.length * BILL_STORAGE_BACKENDS.length;

  return {
    billYear: year,
    billMonth: month,
    monthlyRowsInserted: monthlyCount,
    yearlyRowsInserted: yearlyCount,
    alreadySeeded: false
  };
}
