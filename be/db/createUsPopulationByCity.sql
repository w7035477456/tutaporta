-- US incorporated-place populations (Census Vintage 2025) + a representative ZIP.
-- Percentage_of_total = city population / total US population (state SUMLEV 040 sum).
--
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/createUsPopulationByCity.sql
--   node be/scripts/loadUsPopulationByCity.js
--   node be/scripts/scatterRegularMemberAddresses.js

BEGIN;

CREATE TABLE IF NOT EXISTS helloworldjunktest.us_population_by_city (
  us_population_by_city_id serial PRIMARY KEY,
  city_name text NOT NULL,
  population bigint NOT NULL CHECK (population > 0),
  state_name text NOT NULL,
  zipcode varchar(10) NOT NULL,
  percentage_of_total numeric(18, 12) NOT NULL CHECK (percentage_of_total > 0),
  UNIQUE (city_name, state_name)
);

COMMENT ON TABLE helloworldjunktest.us_population_by_city IS
  'Census Vintage 2025 incorporated places (SUMLEV 162). percentage_of_total = population / US total * 100.';

COMMENT ON COLUMN helloworldjunktest.us_population_by_city.city_name IS
  'City / place display name (Census legal suffix stripped).';

COMMENT ON COLUMN helloworldjunktest.us_population_by_city.population IS
  'July 1, 2025 resident population estimate (POPESTIMATE2025).';

COMMENT ON COLUMN helloworldjunktest.us_population_by_city.state_name IS
  'Full US state or District of Columbia name.';

COMMENT ON COLUMN helloworldjunktest.us_population_by_city.zipcode IS
  'Representative 5-digit ZIP (largest overlapping 2020 ZCTA, else GeoNames).';

COMMENT ON COLUMN helloworldjunktest.us_population_by_city.percentage_of_total IS
  'City population divided by total US population, as a percent (e.g. 2.51 = 2.51%).';

CREATE INDEX IF NOT EXISTS us_population_by_city_pct_idx
  ON helloworldjunktest.us_population_by_city (percentage_of_total DESC);

COMMIT;
