-- outdateddbsnapshotoct2024.requests paid columns (run on Primary only)
BEGIN;

ALTER TABLE outdateddbsnapshotoct2024.requests RENAME COLUMN basic_paid  TO brief_paid;
ALTER TABLE outdateddbsnapshotoct2024.requests RENAME COLUMN paid_date    TO brief_paid_date;
ALTER TABLE outdateddbsnapshotoct2024.requests RENAME COLUMN paid_entry   TO brief_paid_entry;

ALTER TABLE outdateddbsnapshotoct2024.requests RENAME COLUMN detail_paid  TO full_paid;
ALTER TABLE outdateddbsnapshotoct2024.requests RENAME COLUMN detail_date    TO full_paid_date;
ALTER TABLE outdateddbsnapshotoct2024.requests RENAME COLUMN detail_entry   TO full_paid_entry;

COMMIT;
