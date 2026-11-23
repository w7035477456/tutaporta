import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  popBillRowDeleteUndo,
  pushBillRowDeleteUndo,
  restoreBillRowFromDeleteUndo
} from './billScheduleConstants.js';

describe('bill schedule row delete undo (LIFO)', () => {
  it('undoes last delete first', () => {
    let stack = [];
    stack = pushBillRowDeleteUndo(stack, { bill_description: 'first' }, 0);
    stack = pushBillRowDeleteUndo(stack, { bill_description: 'second' }, 1);
    stack = pushBillRowDeleteUndo(stack, { bill_description: 'third' }, 0);

    let popped = popBillRowDeleteUndo(stack);
    assert.equal(popped.entry.row.bill_description, 'third');
    stack = popped.stack;

    popped = popBillRowDeleteUndo(stack);
    assert.equal(popped.entry.row.bill_description, 'second');
    stack = popped.stack;

    popped = popBillRowDeleteUndo(stack);
    assert.equal(popped.entry.row.bill_description, 'first');
    assert.equal(popped.stack.length, 0);
  });

  it('restores row at original index and renumbers', () => {
    const rows = [
      { bill_description: 'A', row_index: 1 },
      { bill_description: 'C', row_index: 2 }
    ];
    const next = restoreBillRowFromDeleteUndo(rows, {
      row: { bill_description: 'B', row_index: 2 },
      insertIndex: 1
    });
    assert.deepEqual(
      next.map((r) => r.bill_description),
      ['A', 'B', 'C']
    );
    assert.deepEqual(
      next.map((r) => r.row_index),
      [1, 2, 3]
    );
  });
});
