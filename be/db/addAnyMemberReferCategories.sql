-- member_category_enum: ANYMEMBER-R (signed up with a Raffle Refer Code R####) and
-- ANYMEMBER-S (signed up with a Signup Refer Code A####). Both behave like ANYMEMBER in code.
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/addAnyMemberReferCategories.sql

ALTER TYPE outdateddbsnapshotoct2024.member_category_enum ADD VALUE IF NOT EXISTS 'ANYMEMBER-R' AFTER 'ANYMEMBER';
ALTER TYPE outdateddbsnapshotoct2024.member_category_enum ADD VALUE IF NOT EXISTS 'ANYMEMBER-S' AFTER 'ANYMEMBER-R';
