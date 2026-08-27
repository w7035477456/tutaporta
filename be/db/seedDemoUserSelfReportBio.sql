-- Seed Self-Report Bio fake data for DemoUser accounts (dm1–dm10@gmail.com).
-- Target: /SelfReportBiography fields (Brief Bio, Full Bio, Misc Optional Bio).
-- Matching Status columns → info_matches (UI “Data Matched”; drives % completed).
-- Verification Services Status → completed.
--
-- Mac:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/seedDemoUserSelfReportBio.sql
--
-- Idempotent: upserts vet_bio / misc_bio and overwrites the listed singles columns.

BEGIN;

CREATE TEMP TABLE demo_self_report_targets ON COMMIT DROP AS
SELECT
  s.singles_id,
  NULLIF(BTRIM(s.mailing_firstname), '') AS firstname,
  NULLIF(BTRIM(s.mailing_middlename), '') AS middlename,
  NULLIF(BTRIM(s.mailing_lastname), '') AS lastname,
  lower(s.email::text) AS email,
  ROW_NUMBER() OVER (ORDER BY s.singles_id)::int AS rn
FROM helloworldjunktest.singles s
WHERE s.member_category = 'DEMOUSER'
   OR lower(s.email::text) ~ '^dm([1-9]|10)@gmail\.com$'
   OR lower(s.email::text) ~ '^dem([1-9]|10)@gmail\.com$';

-- ---------------------------------------------------------------------------
-- singles: height / gender / citizenship / place of birth / gov id
-- ---------------------------------------------------------------------------
UPDATE helloworldjunktest.singles s
SET
  dl_height = CASE (t.rn % 5)
    WHEN 1 THEN '5''02"'
    WHEN 2 THEN '5''05"'
    WHEN 3 THEN '5''08"'
    WHEN 4 THEN '5''10"'
    ELSE '6''00"'
  END,
  dl_sex = CASE
    WHEN lower(COALESCE(t.firstname, '')) IN (
      'michelle', 'donna', 'marie', 'deborah', 'ming', 'kiran'
    ) THEN 'F'
    WHEN lower(COALESCE(t.firstname, '')) IN (
      'steven', 'andrew', 'gary', 'kevin'
    ) THEN 'M'
    WHEN (t.rn % 2) = 0 THEN 'F'
    ELSE 'M'
  END,
  pp_nationality = 'United States of America',
  pp_place_of_birth = CASE (t.rn % 5)
    WHEN 1 THEN 'United States of America'
    WHEN 2 THEN 'Canada'
    WHEN 3 THEN 'United States'
    WHEN 4 THEN 'India'
    ELSE 'China'
  END,
  gov_id_array = ARRAY['Driver License', 'Driver License']::text[],
  updated_at = CURRENT_TIMESTAMP
FROM demo_self_report_targets t
WHERE s.singles_id = t.singles_id;

-- ---------------------------------------------------------------------------
-- vet_bio: Brief + Full self-report values + Matching Status = info_matches
-- ---------------------------------------------------------------------------
INSERT INTO helloworldjunktest.vet_bio AS vb (
  singles_id,
  fullname,
  firstname,
  middlename,
  lastname,
  age,
  height,
  official_gender,
  current_city,
  countryofcitizenship,
  countryofbirth,
  company_domain_name,
  current_company,
  job_title,
  linkedin_url,
  college_name,
  highest_degree_completed,
  professional_license,
  degree_graduation_date,
  profilephoto_vetted,
  profilephoto_vetted_date,
  profilephoto_vetted_note,
  firstname_vetted,
  firstname_vetted_date,
  firstname_vetted_note,
  middlename_vetted,
  middlename_vetted_date,
  middlename_vetted_note,
  lastname_vetted,
  lastname_vetted_date,
  lastname_vetted_note,
  age_vetted,
  age_vetted_date,
  age_vetted_note,
  height_vetted,
  height_vetted_date,
  height_vetted_note,
  official_gender_vetted,
  official_gender_vetted_date,
  official_gender_vetted_note,
  current_city_vetted,
  current_city_vetted_date,
  current_city_vetted_note,
  countryofcitizenship_vetted,
  countryofcitizenship_vetted_date,
  countryofcitizenship_vetted_note,
  countryofbirth_vetted,
  countryofbirth_vetted_date,
  countryofbirth_vetted_note,
  company_domain_name_vetted,
  company_domain_name_vetted_date,
  company_domain_name_vetted_note,
  current_company_vetted,
  current_company_vetted_date,
  current_company_vetted_note,
  job_title_vetted,
  job_title_vetted_date,
  job_title_vetted_note,
  linkedin_url_vetted,
  linkedin_url_vetted_date,
  linkedin_url_vetted_note,
  college_name_vetted,
  college_name_vetted_date,
  college_name_vetted_note,
  highest_degree_completed_vetted,
  highest_degree_completed_vetted_date,
  highest_degree_completed_vetted_note,
  professional_license_vetted,
  professional_license_vetted_date,
  professional_license_vetted_note,
  degree_graduation_date_vetted,
  degree_graduation_date_vetted_date,
  degree_graduation_date_vetted_note,
  id_verification,
  id_verification_date,
  work_verification,
  work_verification_date,
  education_verification,
  education_verification_date,
  linkedin_verification,
  linkedin_verification_date
)
SELECT
  t.singles_id,
  NULLIF(
    BTRIM(CONCAT_WS(' ', t.firstname, t.middlename, t.lastname)),
    ''
  ),
  t.firstname,
  t.middlename,
  t.lastname,
  (28 + (t.rn % 18))::smallint,
  CASE (t.rn % 5)
    WHEN 1 THEN '5''02"'
    WHEN 2 THEN '5''05"'
    WHEN 3 THEN '5''08"'
    WHEN 4 THEN '5''10"'
    ELSE '6''00"'
  END,
  CASE
    WHEN lower(COALESCE(t.firstname, '')) IN (
      'michelle', 'donna', 'marie', 'deborah', 'ming', 'kiran'
    ) THEN 'Female'
    WHEN lower(COALESCE(t.firstname, '')) IN (
      'steven', 'andrew', 'gary', 'kevin'
    ) THEN 'Male'
    WHEN (t.rn % 2) = 0 THEN 'Female'
    ELSE 'Male'
  END,
  (ARRAY[
    'Annandale, VA',
    'Arlington, VA',
    'Fairfax, VA',
    'Culver City, CA',
    'Austin, TX',
    'Seattle, WA',
    'Boston, MA',
    'Denver, CO',
    'Atlanta, GA',
    'Chicago, IL'
  ])[t.rn],
  'United States of America',
  CASE (t.rn % 5)
    WHEN 1 THEN 'United States of America'
    WHEN 2 THEN 'Canada'
    WHEN 3 THEN 'United States'
    WHEN 4 THEN 'India'
    ELSE 'China'
  END,
  (ARRAY[
    'acme.com',
    'northwind.io',
    'contoso.dev',
    'fabrikam.net',
    'adventureworks.com',
    'tailspin.ai',
    'wideworld.tech',
    'blueyonder.co',
    'humongous.org',
    'litware.app'
  ])[t.rn],
  (ARRAY[
    'Acme Robotics',
    'Northwind Labs',
    'Contoso Health',
    'Fabrikam Media',
    'Adventure Works',
    'Tailspin Analytics',
    'Wide World Imports',
    'Blue Yonder Air',
    'Humongous Insurance',
    'Litware Software'
  ])[t.rn],
  (ARRAY[
    'Software Engineer',
    'Product Manager',
    'Data Analyst',
    'UX Designer',
    'Marketing Lead',
    'Operations Manager',
    'Account Executive',
    'Research Scientist',
    'Nurse Practitioner',
    'Financial Analyst'
  ])[t.rn],
  'https://www.linkedin.com/in/demo-user-' || t.singles_id::text,
  (ARRAY[
    'George Mason University',
    'University of Virginia',
    'Virginia Tech',
    'UCLA',
    'UT Austin',
    'University of Washington',
    'Boston University',
    'University of Colorado',
    'Georgia Tech',
    'Northwestern University'
  ])[t.rn],
  (ARRAY[
    'Bachelor of Science in Computer Science',
    'Master of Science in Business Administration',
    'Bachelor of Arts in Biology',
    'MBA in Psychology',
    'PhD in Electrical Engineering',
    'Associate Degree in Nursing',
    'Bachelor of Engineering in Economics',
    'Master of Arts in Chemistry',
    'JD in Law',
    'MD in Medicine'
  ])[t.rn],
  (ARRAY[
    'Computer Science',
    'Business Administration',
    'Biology',
    'Psychology',
    'Electrical Engineering',
    'Nursing',
    'Economics',
    'Chemistry',
    'Law',
    'Medicine'
  ])[t.rn],
  (ARRAY[
    'May 2012',
    'June 2014',
    'December 2015',
    'May 2016',
    'June 2017',
    'May 2018',
    'December 2019',
    'May 2020',
    'June 2021',
    'May 2022'
  ])[t.rn],
  'info_matches'::helloworldjunktest.vetting_status,
  CURRENT_TIMESTAMP,
  'Demo seed',
  'info_matches'::helloworldjunktest.vetting_status,
  CURRENT_TIMESTAMP,
  'Demo seed',
  'info_matches'::helloworldjunktest.vetting_status,
  CURRENT_TIMESTAMP,
  'Demo seed',
  'info_matches'::helloworldjunktest.vetting_status,
  CURRENT_TIMESTAMP,
  'Demo seed',
  'info_matches'::helloworldjunktest.vetting_status,
  CURRENT_TIMESTAMP,
  'Demo seed',
  'info_matches'::helloworldjunktest.vetting_status,
  CURRENT_TIMESTAMP,
  'Demo seed',
  'info_matches'::helloworldjunktest.vetting_status,
  CURRENT_TIMESTAMP,
  'Demo seed',
  'info_matches'::helloworldjunktest.vetting_status,
  CURRENT_TIMESTAMP,
  'Demo seed',
  'info_matches'::helloworldjunktest.vetting_status,
  CURRENT_TIMESTAMP,
  'Demo seed',
  'info_matches'::helloworldjunktest.vetting_status,
  CURRENT_TIMESTAMP,
  'Demo seed',
  'info_matches'::helloworldjunktest.vetting_status,
  CURRENT_TIMESTAMP,
  'Demo seed',
  'info_matches'::helloworldjunktest.vetting_status,
  CURRENT_TIMESTAMP,
  'Demo seed',
  'info_matches'::helloworldjunktest.vetting_status,
  CURRENT_TIMESTAMP,
  'Demo seed',
  'info_matches'::helloworldjunktest.vetting_status,
  CURRENT_TIMESTAMP,
  'Demo seed',
  'info_matches'::helloworldjunktest.vetting_status,
  CURRENT_TIMESTAMP,
  'Demo seed',
  'info_matches'::helloworldjunktest.vetting_status,
  CURRENT_TIMESTAMP,
  'Demo seed',
  'info_matches'::helloworldjunktest.vetting_status,
  CURRENT_TIMESTAMP,
  'Demo seed',
  'info_matches'::helloworldjunktest.vetting_status,
  CURRENT_TIMESTAMP,
  'Demo seed',
  'completed'::helloworldjunktest.verification_status,
  CURRENT_TIMESTAMP,
  'completed'::helloworldjunktest.verification_status,
  CURRENT_TIMESTAMP,
  'completed'::helloworldjunktest.verification_status,
  CURRENT_TIMESTAMP,
  'completed',
  CURRENT_TIMESTAMP
FROM demo_self_report_targets t
ON CONFLICT (singles_id) DO UPDATE SET
  fullname = EXCLUDED.fullname,
  firstname = EXCLUDED.firstname,
  middlename = EXCLUDED.middlename,
  lastname = EXCLUDED.lastname,
  age = EXCLUDED.age,
  height = EXCLUDED.height,
  official_gender = EXCLUDED.official_gender,
  current_city = EXCLUDED.current_city,
  countryofcitizenship = EXCLUDED.countryofcitizenship,
  countryofbirth = EXCLUDED.countryofbirth,
  company_domain_name = EXCLUDED.company_domain_name,
  current_company = EXCLUDED.current_company,
  job_title = EXCLUDED.job_title,
  linkedin_url = EXCLUDED.linkedin_url,
  college_name = EXCLUDED.college_name,
  highest_degree_completed = EXCLUDED.highest_degree_completed,
  professional_license = EXCLUDED.professional_license,
  degree_graduation_date = EXCLUDED.degree_graduation_date,
  profilephoto_vetted = EXCLUDED.profilephoto_vetted,
  profilephoto_vetted_date = EXCLUDED.profilephoto_vetted_date,
  profilephoto_vetted_note = EXCLUDED.profilephoto_vetted_note,
  firstname_vetted = EXCLUDED.firstname_vetted,
  firstname_vetted_date = EXCLUDED.firstname_vetted_date,
  firstname_vetted_note = EXCLUDED.firstname_vetted_note,
  middlename_vetted = EXCLUDED.middlename_vetted,
  middlename_vetted_date = EXCLUDED.middlename_vetted_date,
  middlename_vetted_note = EXCLUDED.middlename_vetted_note,
  lastname_vetted = EXCLUDED.lastname_vetted,
  lastname_vetted_date = EXCLUDED.lastname_vetted_date,
  lastname_vetted_note = EXCLUDED.lastname_vetted_note,
  age_vetted = EXCLUDED.age_vetted,
  age_vetted_date = EXCLUDED.age_vetted_date,
  age_vetted_note = EXCLUDED.age_vetted_note,
  height_vetted = EXCLUDED.height_vetted,
  height_vetted_date = EXCLUDED.height_vetted_date,
  height_vetted_note = EXCLUDED.height_vetted_note,
  official_gender_vetted = EXCLUDED.official_gender_vetted,
  official_gender_vetted_date = EXCLUDED.official_gender_vetted_date,
  official_gender_vetted_note = EXCLUDED.official_gender_vetted_note,
  current_city_vetted = EXCLUDED.current_city_vetted,
  current_city_vetted_date = EXCLUDED.current_city_vetted_date,
  current_city_vetted_note = EXCLUDED.current_city_vetted_note,
  countryofcitizenship_vetted = EXCLUDED.countryofcitizenship_vetted,
  countryofcitizenship_vetted_date = EXCLUDED.countryofcitizenship_vetted_date,
  countryofcitizenship_vetted_note = EXCLUDED.countryofcitizenship_vetted_note,
  countryofbirth_vetted = EXCLUDED.countryofbirth_vetted,
  countryofbirth_vetted_date = EXCLUDED.countryofbirth_vetted_date,
  countryofbirth_vetted_note = EXCLUDED.countryofbirth_vetted_note,
  company_domain_name_vetted = EXCLUDED.company_domain_name_vetted,
  company_domain_name_vetted_date = EXCLUDED.company_domain_name_vetted_date,
  company_domain_name_vetted_note = EXCLUDED.company_domain_name_vetted_note,
  current_company_vetted = EXCLUDED.current_company_vetted,
  current_company_vetted_date = EXCLUDED.current_company_vetted_date,
  current_company_vetted_note = EXCLUDED.current_company_vetted_note,
  job_title_vetted = EXCLUDED.job_title_vetted,
  job_title_vetted_date = EXCLUDED.job_title_vetted_date,
  job_title_vetted_note = EXCLUDED.job_title_vetted_note,
  linkedin_url_vetted = EXCLUDED.linkedin_url_vetted,
  linkedin_url_vetted_date = EXCLUDED.linkedin_url_vetted_date,
  linkedin_url_vetted_note = EXCLUDED.linkedin_url_vetted_note,
  college_name_vetted = EXCLUDED.college_name_vetted,
  college_name_vetted_date = EXCLUDED.college_name_vetted_date,
  college_name_vetted_note = EXCLUDED.college_name_vetted_note,
  highest_degree_completed_vetted = EXCLUDED.highest_degree_completed_vetted,
  highest_degree_completed_vetted_date = EXCLUDED.highest_degree_completed_vetted_date,
  highest_degree_completed_vetted_note = EXCLUDED.highest_degree_completed_vetted_note,
  professional_license_vetted = EXCLUDED.professional_license_vetted,
  professional_license_vetted_date = EXCLUDED.professional_license_vetted_date,
  professional_license_vetted_note = EXCLUDED.professional_license_vetted_note,
  degree_graduation_date_vetted = EXCLUDED.degree_graduation_date_vetted,
  degree_graduation_date_vetted_date = EXCLUDED.degree_graduation_date_vetted_date,
  degree_graduation_date_vetted_note = EXCLUDED.degree_graduation_date_vetted_note,
  id_verification = EXCLUDED.id_verification,
  id_verification_date = EXCLUDED.id_verification_date,
  work_verification = EXCLUDED.work_verification,
  work_verification_date = EXCLUDED.work_verification_date,
  education_verification = EXCLUDED.education_verification,
  education_verification_date = EXCLUDED.education_verification_date,
  linkedin_verification = EXCLUDED.linkedin_verification,
  linkedin_verification_date = EXCLUDED.linkedin_verification_date;

-- ---------------------------------------------------------------------------
-- misc_bio: Optional favorites / personal fields
-- ---------------------------------------------------------------------------
INSERT INTO helloworldjunktest.misc_bio AS mb (
  singles_id,
  favorite_hobbies,
  favorite_food,
  favorite_drinks,
  favorite_desserts,
  favorite_movie,
  favorite_spectator_sport_team,
  favorite_music,
  favorite_books,
  favorite_video_games,
  favorite_vacation_places,
  favorite_memories,
  children_info,
  marriage_history,
  ethnicity,
  country_of_birth,
  religion
)
SELECT
  t.singles_id,
  (ARRAY[
    'Hiking, photography',
    'Cooking, gardening',
    'Running, yoga',
    'Chess, reading',
    'Cycling, painting',
    'Travel, museums',
    'Fishing, camping',
    'Dancing, baking',
    'Tennis, podcasts',
    'Volunteering, puzzles'
  ])[t.rn],
  (ARRAY[
    'Sushi',
    'Tacos',
    'Pho',
    'Pasta',
    'BBQ',
    'Ramen',
    'Curry',
    'Pizza',
    'Seafood',
    'Dim sum'
  ])[t.rn],
  (ARRAY[
    'Iced tea',
    'Coffee',
    'Sparkling water',
    'Green tea',
    'Lemonade',
    'Smoothies',
    'Kombucha',
    'Hot chocolate',
    'Matcha latte',
    'Fresh juice'
  ])[t.rn],
  (ARRAY[
    'Cheesecake',
    'Chocolate cake',
    'Mochi ice cream',
    'Apple pie',
    'Tiramisu',
    'Brownies',
    'Gelato',
    'Fruit tart',
    'Creme brulee',
    'Baklava'
  ])[t.rn],
  (ARRAY[
    'The Matrix',
    'Pride and Prejudice',
    'Inception',
    'Spirited Away',
    'Casablanca',
    'The Grand Budapest Hotel',
    'Hidden Figures',
    'La La Land',
    'The Martian',
    'Coco'
  ])[t.rn],
  (ARRAY[
    'NFL / Commanders',
    'NBA / Wizards',
    'MLB / Nationals',
    'Soccer / USWNT',
    'NHL / Capitals',
    'Tennis / US Open',
    'F1 / Mercedes',
    'NBA / Lakers',
    'NFL / Cowboys',
    'Olympics track'
  ])[t.rn],
  (ARRAY[
    'Jazz',
    'Indie pop',
    'Classical',
    'Hip-hop',
    'Country',
    'K-pop',
    'Rock',
    'R&B',
    'Folk',
    'Electronic'
  ])[t.rn],
  (ARRAY[
    'Atomic Habits',
    'Educated',
    'Sapiens',
    'The Alchemist',
    'Becoming',
    'Dune',
    'Pride and Prejudice',
    'The Midnight Library',
    'Where the Crawdads Sing',
    'Project Hail Mary'
  ])[t.rn],
  (ARRAY[
    'Stardew Valley',
    'Zelda',
    'Animal Crossing',
    'Chess.com puzzles',
    'Mario Kart',
    'Minecraft',
    'Overwatch',
    'Among Us',
    'FIFA',
    'Wordle'
  ])[t.rn],
  (ARRAY[
    'Hawaii',
    'Tokyo',
    'Paris',
    'Banff',
    'New Zealand',
    'Italy',
    'Costa Rica',
    'Iceland',
    'Singapore',
    'Barcelona'
  ])[t.rn],
  (ARRAY[
    'Family road trips',
    'College graduation',
    'First concert',
    'Beach sunsets',
    'Holiday dinners',
    'Travel with friends',
    'Learning to cook',
    'Pet adoption day',
    'Mountain hike',
    'Surprise birthday'
  ])[t.rn],
  (ARRAY[
    'None',
    'None',
    '1 child',
    'None',
    '2 children',
    'None',
    'None',
    '1 child',
    'None',
    'None'
  ])[t.rn],
  (ARRAY[
    'Never married',
    'Never married',
    'Divorced',
    'Never married',
    'Widowed',
    'Never married',
    'Divorced',
    'Never married',
    'Never married',
    'Divorced'
  ])[t.rn],
  (ARRAY[
    'Asian',
    'White',
    'Hispanic',
    'Black',
    'Mixed',
    'Asian',
    'White',
    'South Asian',
    'Hispanic',
    'Mixed'
  ])[t.rn],
  CASE (t.rn % 5)
    WHEN 1 THEN 'United States of America'
    WHEN 2 THEN 'Canada'
    WHEN 3 THEN 'United States'
    WHEN 4 THEN 'India'
    ELSE 'China'
  END,
  (ARRAY[
    'Christian',
    'Agnostic',
    'Buddhist',
    'Hindu',
    'Jewish',
    'Spiritual',
    'Catholic',
    'Atheist',
    'Muslim',
    'Other'
  ])[t.rn]
FROM demo_self_report_targets t
ON CONFLICT (singles_id) DO UPDATE SET
  favorite_hobbies = EXCLUDED.favorite_hobbies,
  favorite_food = EXCLUDED.favorite_food,
  favorite_drinks = EXCLUDED.favorite_drinks,
  favorite_desserts = EXCLUDED.favorite_desserts,
  favorite_movie = EXCLUDED.favorite_movie,
  favorite_spectator_sport_team = EXCLUDED.favorite_spectator_sport_team,
  favorite_music = EXCLUDED.favorite_music,
  favorite_books = EXCLUDED.favorite_books,
  favorite_video_games = EXCLUDED.favorite_video_games,
  favorite_vacation_places = EXCLUDED.favorite_vacation_places,
  favorite_memories = EXCLUDED.favorite_memories,
  children_info = EXCLUDED.children_info,
  marriage_history = EXCLUDED.marriage_history,
  ethnicity = EXCLUDED.ethnicity,
  country_of_birth = EXCLUDED.country_of_birth,
  religion = EXCLUDED.religion;

-- Summary for the operator
SELECT
  t.singles_id,
  t.email,
  vb.age,
  vb.current_city,
  vb.job_title,
  vb.age_vetted::text AS age_match,
  vb.id_verification::text AS id_svc,
  mb.favorite_hobbies IS NOT NULL AS has_misc
FROM demo_self_report_targets t
JOIN helloworldjunktest.vet_bio vb ON vb.singles_id = t.singles_id
JOIN helloworldjunktest.misc_bio mb ON mb.singles_id = t.singles_id
ORDER BY t.singles_id;

COMMIT;
