-- Separate MyNote remembered icons for OneDrive vs USB (replaces shared singles.cache_icon).
-- Run on Primary, then replica will catch up.

ALTER TABLE helloworldjunktest.singles
  ADD COLUMN IF NOT EXISTS cache_onedrive_icon text;

ALTER TABLE helloworldjunktest.singles
  ADD COLUMN IF NOT EXISTS cache_usb_icon text;

COMMENT ON COLUMN helloworldjunktest.singles.cache_onedrive_icon IS
  'Last successful MyNote OneDrive security icon name (convenience auto-retry only; not authoritative).';

COMMENT ON COLUMN helloworldjunktest.singles.cache_usb_icon IS
  'Last successful MyNote USB security icon name (convenience auto-retry only; not authoritative).';

-- Preserve any prior shared cache into both columns before drop.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'helloworldjunktest'
       AND table_name = 'singles'
       AND column_name = 'cache_icon'
  ) THEN
    UPDATE helloworldjunktest.singles
       SET cache_onedrive_icon = COALESCE(NULLIF(trim(cache_onedrive_icon), ''), NULLIF(trim(cache_icon), '')),
           cache_usb_icon = COALESCE(NULLIF(trim(cache_usb_icon), ''), NULLIF(trim(cache_icon), ''))
     WHERE cache_icon IS NOT NULL
       AND trim(cache_icon) <> '';

    ALTER TABLE helloworldjunktest.singles
      DROP COLUMN cache_icon;
  END IF;
END $$;
