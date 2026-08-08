SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'helloworldjunktest'
  AND table_name = 'singles'
  AND column_name LIKE 'record_photoalbums_onedrive%'
ORDER BY column_name;
