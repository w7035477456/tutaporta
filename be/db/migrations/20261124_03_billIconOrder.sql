-- Bill Icon popup: per-user icon order after drag-to-rearrange (NULL = default order).
ALTER TABLE outdateddbsnapshotoct2024.mynote_ui_pref
  ADD COLUMN IF NOT EXISTS bill_icon_order text[] NULL;

COMMENT ON COLUMN outdateddbsnapshotoct2024.mynote_ui_pref.bill_icon_order IS
  'Bill Icon popup order (icon names) saved after the user drags icons around; NULL = default order.';
