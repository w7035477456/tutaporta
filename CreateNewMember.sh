#!/usr/bin/env bash
# CreateNewMember.sh — interactive Mac helper to insert one helloworldjunktest.singles
# (+ vet_bio + misc_bio). Run from repo root or anywhere:
#   bash /Users/a/code/main/CreateNewMember.sh
#
# Requires: psql, local tunnel DB (127.0.0.1:50010 / onlinemallwebsite / test_user1).

set -euo pipefail

PSQL_HOST="${PSQL_HOST:-127.0.0.1}"
PSQL_PORT="${PSQL_PORT:-50010}"
PSQL_USER="${PSQL_USER:-test_user1}"
PSQL_DB="${PSQL_DB:-onlinemallwebsite}"
SCHEMA="helloworldjunktest"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_SQL="${SCRIPT_DIR}/be/db/addRegularMemberAnyMemberInactive.sql"
NICKNAME_JS="${SCRIPT_DIR}/fe/src/config/nicknameSuggestions.js"
DM1_EMAIL="dm1@gmail.com"

trim() {
  local s="${1-}"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "$s"
}

psql_q() {
  PGPASSWORD="${PGPASSWORD:-}" psql -h "$PSQL_HOST" -p "$PSQL_PORT" -U "$PSQL_USER" -d "$PSQL_DB" -v ON_ERROR_STOP=1 "$@"
}

sql_escape() {
  # Escape single quotes for SQL string literals.
  printf '%s' "${1-}" | sed "s/'/''/g"
}

rand_int() {
  local min="$1" max="$2"
  echo $((min + RANDOM % (max - min + 1)))
}

pick_from() {
  local -a arr=("$@")
  local n=${#arr[@]}
  [[ "$n" -gt 0 ]] || return 1
  echo "${arr[$((RANDOM % n))]}"
}

title_case() {
  local w="$1"
  [[ -z "$w" ]] && { echo ""; return; }
  local first="${w:0:1}" rest="${w:1}"
  echo "$(printf '%s' "$first" | tr '[:lower:]' '[:upper:]')$(printf '%s' "$rest" | tr '[:upper:]' '[:lower:]')"
}

# ---------------------------------------------------------------------------
# Ensure enums exist
# ---------------------------------------------------------------------------
echo "==> Ensuring RegularMember / AnyMember / inactive enums exist..."
psql_q -f "$MIGRATION_SQL" >/dev/null

# ---------------------------------------------------------------------------
# 1) member_category
# ---------------------------------------------------------------------------
echo
echo "singles.member_category:"
echo "  1) DemoUser"
echo "  2) RegularMember"
echo "  3) AnyMember"
while true; do
  read -r -p "Choose [1-3]: " cat_choice
  case "$cat_choice" in
    1) MEMBER_CATEGORY="DemoUser"; break ;;
    2) MEMBER_CATEGORY="RegularMember"; break ;;
    3) MEMBER_CATEGORY="AnyMember"; break ;;
    *) echo "Please enter 1, 2, or 3." ;;
  esac
done

# ---------------------------------------------------------------------------
# 2) email
# ---------------------------------------------------------------------------
next_email_for_prefix() {
  local prefix="$1"
  local max_n
  max_n=$(psql_q -Atc "
    SELECT COALESCE(MAX(
      CASE WHEN lower(email) ~ ('^' || lower('${prefix}') || '[0-9]+@gmail\\.com\$')
           THEN NULLIF(regexp_replace(split_part(lower(email), '@', 1), '^' || lower('${prefix}'), '', 'i'), '')::int
           ELSE NULL END
    ), 0)
    FROM ${SCHEMA}.singles;
  ")
  # Always lowercase — login matches LOWER(email).
  echo "$(printf '%s' "${prefix}$((max_n + 1))@gmail.com" | tr '[:upper:]' '[:lower:]')"
}

DEFAULT_EMAIL="$(next_email_for_prefix RegularMember)"

echo
read -r -p "Email [Enter = ${DEFAULT_EMAIL}]: " EMAIL_IN
if [[ -z "${EMAIL_IN// }" ]]; then
  EMAIL="$DEFAULT_EMAIL"
else
  EMAIL="$(trim "$EMAIL_IN")"
fi
# Login normalizes email to lowercase — always store lowercase.
EMAIL="$(printf '%s' "$EMAIL" | tr '[:upper:]' '[:lower:]')"

exists=$(psql_q -Atc "SELECT 1 FROM ${SCHEMA}.singles WHERE lower(email)=lower('$(sql_escape "$EMAIL")') LIMIT 1;")
if [[ "$exists" == "1" ]]; then
  echo "ERROR: email already exists: $EMAIL"
  exit 1
fi

# ---------------------------------------------------------------------------
# 6) Gender
# ---------------------------------------------------------------------------
echo
while true; do
  read -r -p "Male or Female [M/F]: " gender_in
  g="$(trim "$(printf '%s' "$gender_in" | tr '[:upper:]' '[:lower:]')")"
  case "$g" in
    m|male) DL_SEX="M"; GENDER_WORD="Male"; GENDER_KEY="male"; break ;;
    f|female) DL_SEX="F"; GENDER_WORD="Female"; GENDER_KEY="female"; break ;;
    *) echo "Enter M/Male or F/Female." ;;
  esac
done

# ---------------------------------------------------------------------------
# 7) Ethnicity + names
# ---------------------------------------------------------------------------
echo
echo "Ethnic name groups: asian | white | hispanic | black | southasian | middleeastern | mixed"
read -r -p "What ethnic name? [asian]: " ETHNIC_IN
ETHNIC="$(printf '%s' "${ETHNIC_IN:-asian}" | tr '[:upper:]' '[:lower:]' | tr -d ' ')"

# first|middle|last pools per ethnicity (gender-aware first names)
case "$ETHNIC" in
  asian)
    M_FIRST=(Wei Jian Hao Ming Kai Chen Wei Li Jun Tao)
    F_FIRST=(Mei Ling Xia Yan Hui Jing Wei Fang Lan Yun)
    MIDDLE=(Li Wei Chen Yong An)
    LAST=(Wang Li Zhang Liu Chen Yang Huang Zhao Wu Zhou)
    ETHNIC_LABEL="Asian"
    ;;
  white|caucasian)
    M_FIRST=(James John Robert Michael William David Richard Joseph Thomas Charles)
    F_FIRST=(Mary Patricia Jennifer Linda Elizabeth Barbara Susan Jessica Sarah Karen)
    MIDDLE=(Ann Marie Lee Ray Jo)
    LAST=(Smith Johnson Williams Brown Jones Miller Davis Wilson Anderson Taylor)
    ETHNIC_LABEL="White"
    ;;
  hispanic|latino|latina)
    M_FIRST=(Carlos Miguel Jose Luis Juan Diego Antonio Pedro Pablo Andres)
    F_FIRST=(Maria Sofia Isabella Camila Valentina Lucia Elena Gabriela Ana Rosa)
    MIDDLE=(Luis Marie Jose Ann Cruz)
    LAST=(Garcia Rodriguez Martinez Hernandez Lopez Gonzalez Perez Sanchez Ramirez Torres)
    ETHNIC_LABEL="Hispanic"
    ;;
  black|africanamerican|african)
    M_FIRST=(Jamal Malik Darius Tyrone Andre Marcus DeShawn Khalil Omari Jabari)
    F_FIRST=(Aaliyah Imani Keisha Latoya Nia Destiny Shanice Ebony Jasmine Monique)
    MIDDLE=(Lee Ann Marie Ray Jo)
    LAST=(Williams Johnson Brown Davis Jackson Wilson Harris Thompson Robinson Lewis)
    ETHNIC_LABEL="Black"
    ;;
  southasian|indian)
    M_FIRST=(Arjun Rohan Vikram Amir Raj Kabir Nikhil Sameer Dev Aditya)
    F_FIRST=(Priya Ananya Aisha Meera Kavya Neha Sanya Isha Diya Riya)
    MIDDLE=(Kumar Devi Ann Marie Das)
    LAST=(Patel Sharma Khan Singh Gupta Reddy Mehta Joshi Nair Chopra)
    ETHNIC_LABEL="South Asian"
    ;;
  middleeastern|arab)
    M_FIRST=(Omar Hassan Ali Youssef Karim Samir Rami Tarek Ziad Fadi)
    F_FIRST=(Layla Nora Yasmin Amira Fatima Hana Sara Rania Dina Maya)
    MIDDLE=(Ali Noor Ann Marie)
    LAST=(Hassan Ali Khan Ahmed Ibrahim Mansour Farouk Nasser Saleh Rahman)
    ETHNIC_LABEL="Middle Eastern"
    ;;
  mixed|*)
    M_FIRST=(Alex Jordan Casey Taylor Riley Avery Quinn Morgan Cameron Reese)
    F_FIRST=(Alex Jordan Casey Taylor Riley Avery Quinn Morgan Cameron Reese)
    MIDDLE=(Lee Ann Marie Ray Jo)
    LAST=(Nguyen Garcia Smith Patel Kim Lopez Brown Lee Park Hernandez)
    ETHNIC_LABEL="Mixed"
    ;;
esac

if [[ "$GENDER_KEY" == "female" ]]; then
  FIRST_NAME="$(pick_from "${F_FIRST[@]}")"
else
  FIRST_NAME="$(pick_from "${M_FIRST[@]}")"
fi
MIDDLE_NAME="$(pick_from "${MIDDLE[@]}")"
LAST_NAME="$(pick_from "${LAST[@]}")"
FIRST_NAME="$(title_case "$FIRST_NAME")"
MIDDLE_NAME="$(title_case "$MIDDLE_NAME")"
LAST_NAME="$(title_case "$LAST_NAME")"

# ---------------------------------------------------------------------------
# 8) Alias — adjective + rhyming first-name style (BubblyBob)
# ---------------------------------------------------------------------------
load_nickname_words() {
  # Extract adjective words and gender name lists from nicknameSuggestions.js
  ADJECTIVES=(Bubbly Sunny Clever Goofy Flash Turbo Merry Witty Cheeky Cosmic Neon Echo Rogue Frosty Alpha)
  MALE_NICK=(Bob Champ Ace Jax Leo Max Nash Rex Troy Zane Buddy Chip Duke Gus Hank Jack Luke Nick Sam Tex)
  FEMALE_NICK=(Coco Luna Nova Ruby Stella Aria Bella Jade Ivy Zara Alice Daisy Joy Lily Pearl Rosie Sunny Violet)
  if [[ ! -f "$NICKNAME_JS" ]]; then
    return
  fi
  local adj_line names_line
  adj_line="$(grep -E "word: '" "$NICKNAME_JS" | sed -E "s/.*word: '([^']+)'.*/\1/" | sort -u | tr '\n' ' ')"
  if [[ -n "$adj_line" ]]; then
    # shellcheck disable=SC2206
    ADJECTIVES=($adj_line)
  fi
  names_line="$(python3 - "$NICKNAME_JS" <<'PY' 2>/dev/null || true
import re, sys
path = sys.argv[1]
text = open(path).read()
female = []
male = []
for block in re.finditer(r"female:\s*\[(.*?)\]", text, re.S):
    female += re.findall(r"'([^']+)'", block.group(1))
for block in re.finditer(r"male:\s*\[(.*?)\]", text, re.S):
    male += re.findall(r"'([^']+)'", block.group(1))
print("FEMALE|" + " ".join(dict.fromkeys(female)))
print("MALE|" + " ".join(dict.fromkeys(male)))
PY
)"
  local line
  while IFS= read -r line; do
    case "$line" in
      FEMALE\|*)
        # shellcheck disable=SC2206
        FEMALE_NICK=(${line#FEMALE|})
        ;;
      MALE\|*)
        # shellcheck disable=SC2206
        MALE_NICK=(${line#MALE|})
        ;;
    esac
  done <<EOF
$names_line
EOF
  [[ ${#ADJECTIVES[@]} -gt 0 ]] || ADJECTIVES=(Bubbly Sunny Clever Goofy Flash Turbo Merry Witty Cheeky Cosmic)
  [[ ${#FEMALE_NICK[@]} -gt 0 ]] || FEMALE_NICK=(Coco Luna Nova Ruby Stella Aria Bella Jade Ivy Zara)
  [[ ${#MALE_NICK[@]} -gt 0 ]] || MALE_NICK=(Bob Champ Ace Jax Leo Max Nash Rex Troy Zane)
}

rhyme_tail() {
  local w
  w="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z')"
  local n=${#w}
  if [[ "$n" -ge 3 ]]; then
    echo "${w:$((n - 3))}"
  elif [[ "$n" -ge 2 ]]; then
    echo "${w:$((n - 2))}"
  else
    echo "$w"
  fi
}

generate_alias() {
  load_nickname_words
  local -a nick_pool
  if [[ "$GENDER_KEY" == "female" ]]; then
    nick_pool=("${FEMALE_NICK[@]}")
  else
    nick_pool=("${MALE_NICK[@]}")
  fi
  local attempt adj nick adj_l nick_l tail rhymes=()
  for attempt in $(seq 1 40); do
    adj="$(pick_from "${ADJECTIVES[@]}")"
    adj_l="$(printf '%s' "$adj" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z')"
    tail="$(rhyme_tail "$adj_l")"
    rhymes=()
    for nick in "${nick_pool[@]}"; do
      nick_l="$(printf '%s' "$nick" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z')"
      if [[ "$nick_l" == *"$tail" ]]; then
        rhymes+=("$nick")
      fi
    done
    if [[ ${#rhymes[@]} -gt 0 ]]; then
      nick="$(pick_from "${rhymes[@]}")"
    else
      nick="$(pick_from "${nick_pool[@]}")"
    fi
    # Bubbly + Bob -> BubblyBob
    ALIAS="$(title_case "$adj")$(title_case "$nick")"
    ALIAS="$(printf '%s' "$ALIAS" | tr -cd 'A-Za-z0-9' | cut -c1-80)"
    local taken
    taken=$(psql_q -Atc "SELECT 1 FROM ${SCHEMA}.singles WHERE lower(alias)=lower('$(sql_escape "$ALIAS")') LIMIT 1;")
    if [[ "$taken" != "1" && -n "$ALIAS" ]]; then
      return 0
    fi
  done
  ALIAS="Alias$(rand_int 1000 9999)"
}

generate_alias

# ---------------------------------------------------------------------------
# 3) member_id
# DemoUser / RegularMember: 2-digit sequential prefix + 5 random = 7 digits
#   (highest 11##### → next 12#####). Unique among all singles.member_id.
# AnyMember: random unique 6-digit (100000–999999).
# ---------------------------------------------------------------------------
allocate_member_id() {
  if [[ "$MEMBER_CATEGORY" == "AnyMember" ]]; then
    local cand attempt
    for attempt in $(seq 1 50); do
      cand=$(rand_int 100000 999999)
      local taken
      taken=$(psql_q -Atc "SELECT 1 FROM ${SCHEMA}.singles WHERE member_id=${cand} LIMIT 1;")
      if [[ "$taken" != "1" ]]; then
        MEMBER_ID="$cand"
        return 0
      fi
    done
    echo "ERROR: could not allocate unique AnyMember member_id"
    exit 1
  fi

  local next_seq
  next_seq=$(psql_q -Atc "
    SELECT COALESCE(
      MAX(
        CASE
          WHEN member_id::text ~ '^[0-9]{7}$'
           AND member_category::text IN ('DemoUser', 'RegularMember')
          THEN substring(member_id::text from 1 for 2)::int
          ELSE NULL
        END
      ),
      9
    ) + 1
    FROM ${SCHEMA}.singles;
  ")
  if (( next_seq < 10 )); then next_seq=10; fi
  if (( next_seq > 99 )); then
    echo "ERROR: sequential member_id prefix exhausted (>99)."
    exit 1
  fi

  local prefix rand5 cand attempt taken
  prefix=$(printf '%02d' "$next_seq")
  for attempt in $(seq 1 50); do
    rand5=$(printf '%05d' "$(rand_int 0 99999)")
    cand="${prefix}${rand5}"
    taken=$(psql_q -Atc "SELECT 1 FROM ${SCHEMA}.singles WHERE member_id=${cand} LIMIT 1;")
    if [[ "$taken" != "1" ]]; then
      MEMBER_ID="$cand"
      return 0
    fi
  done
  echo "ERROR: could not allocate unique DemoUser/RegularMember member_id"
  exit 1
}

allocate_member_id

# ---------------------------------------------------------------------------
# 4–5) password_hash + status + initial_setup_done
# ---------------------------------------------------------------------------
if [[ "$MEMBER_CATEGORY" == "DemoUser" || "$MEMBER_CATEGORY" == "RegularMember" ]]; then
  PASSWORD_HASH=$(psql_q -Atc "SELECT password_hash FROM ${SCHEMA}.singles WHERE lower(email)=lower('${DM1_EMAIL}') LIMIT 1;")
  if [[ -z "$PASSWORD_HASH" ]]; then
    echo "ERROR: could not clone password_hash from ${DM1_EMAIL}"
    exit 1
  fi
  STATUS="inactive"
  INITIAL_SETUP_DONE="true"
else
  PASSWORD_HASH=$(psql_q -Atc "SELECT password_hash FROM ${SCHEMA}.singles WHERE lower(email)=lower('${DM1_EMAIL}') LIMIT 1;")
  if [[ -z "$PASSWORD_HASH" ]]; then
    echo "ERROR: could not clone password_hash from ${DM1_EMAIL}"
    exit 1
  fi
  STATUS="active"
  INITIAL_SETUP_DONE="false"
fi

# ---------------------------------------------------------------------------
# 9) mailing address
# ---------------------------------------------------------------------------
STREETS=("100 Main St" "245 Oak Ave" "78 Pine Rd" "512 Maple Blvd" "9 Cedar Ln" "330 Elm St" "1501 River Rd" "88 Sunset Dr")
CITIES=("Annandale" "Arlington" "Fairfax" "Alexandria" "Reston" "Vienna" "McLean" "Falls Church")
MAILING_STREET="$(pick_from "${STREETS[@]}")"
MAILING_CITY="$(pick_from "${CITIES[@]}")"
MAILING_ZIP="$(printf '%05d' "$(rand_int 20001 22315)")"
MAILING_COUNTRY="USA"

# Unique phone (required NOT NULL)
PHONE=""
for _ in $(seq 1 40); do
  cand="+1555$(printf '%07d' "$(rand_int 0 9999999)")"
  taken=$(psql_q -Atc "SELECT 1 FROM ${SCHEMA}.singles WHERE phone='$(sql_escape "$cand")' LIMIT 1;")
  if [[ "$taken" != "1" ]]; then
    PHONE="$cand"
    break
  fi
done
[[ -n "$PHONE" ]] || { echo "ERROR: could not allocate unique phone"; exit 1; }

# Bio helpers
HEIGHTS=("5'02\"" "5'04\"" "5'06\"" "5'08\"" "5'10\"" "6'00\"" "6'02\"")
HEIGHT="$(pick_from "${HEIGHTS[@]}")"
AGE=$(rand_int 25 45)
CURRENT_CITY="$(pick_from "Annandale, VA" "Arlington, VA" "Fairfax, VA" "Austin, TX" "Culver City, CA")"
COMPANIES=("Acme Corp" "Northwind" "Contoso" "Brightside Labs" "Rivertech" "Summit Soft")
JOBS=("Engineer" "Analyst" "Designer" "Manager" "Teacher" "Consultant" "Nurse" "Developer")
COLLEGES=("GMU" "UVA" "Virginia Tech" "Georgetown" "UMD" "Stanford")
DEGREES=("BS" "BA" "MS" "MBA" "PhD")
DOMAINS=("acme.com" "northwind.io" "contoso.com" "brightside.dev" "rivertech.co")
HOBBIES=("Hiking, photography" "Cooking, gardening" "Running, yoga" "Chess, reading" "Cycling, painting")
FOODS=("Sushi" "Tacos" "Pho" "Pasta" "BBQ" "Ramen" "Curry" "Pizza")
DRINKS=("Iced tea" "Coffee" "Sparkling water" "Green tea" "Lemonade")
DESSERTS=("Cheesecake" "Chocolate cake" "Mochi ice cream" "Apple pie" "Tiramisu")
MOVIES=("The Matrix" "Inception" "Spirited Away" "La La Land" "Coco")
SPORTS=("NFL / Commanders" "NBA / Wizards" "MLB / Nationals" "NHL / Capitals")
MUSIC=("Jazz" "Indie pop" "Classical" "Hip-hop" "Rock" "R&B")
BOOKS=("Atomic Habits" "Sapiens" "Dune" "The Alchemist" "Educated")
GAMES=("Stardew Valley" "Zelda" "Mario Kart" "Minecraft" "Wordle")
VACATIONS=("Hawaii" "Tokyo" "Paris" "Banff" "Italy" "Iceland")
MEMORIES=("Family road trips" "College graduation" "Beach sunsets" "Mountain hike")
CHILDREN=("None" "None" "1 child" "2 children")
MARRIAGE=("Never married" "Never married" "Divorced")
RELIGIONS=("Christian" "Agnostic" "Buddhist" "Hindu" "Jewish" "Spiritual" "Catholic" "Atheist")
BIRTH_COUNTRIES=("United States of America" "Canada" "India" "China" "Mexico")
GRAD_YEAR=$(rand_int 2005 2022)
COMPANY="$(pick_from "${COMPANIES[@]}")"
JOB_TITLE="$(pick_from "${JOBS[@]}")"
COLLEGE="$(pick_from "${COLLEGES[@]}")"
DEGREE="$(pick_from "${DEGREES[@]}")"
DOMAIN="$(pick_from "${DOMAINS[@]}")"
LINKEDIN="https://www.linkedin.com/in/$(printf '%s' "$FIRST_NAME$LAST_NAME" | tr '[:upper:]' '[:lower:]')$(rand_int 10 99)"
COMPANY_EMAIL="$(printf '%s' "$FIRST_NAME" | tr '[:upper:]' '[:lower:]').$(printf '%s' "$LAST_NAME" | tr '[:upper:]' '[:lower:]')@${DOMAIN}"
CITIZENSHIP="United States of America"
BIRTH_COUNTRY="$(pick_from "${BIRTH_COUNTRIES[@]}")"
FULLNAME="${FIRST_NAME} ${MIDDLE_NAME} ${LAST_NAME}"
MY_REFER_CODE=$(printf '%06d' "$(rand_int 0 999999)")

FAV_HOBBIES="$(pick_from "${HOBBIES[@]}")"
FAV_FOOD="$(pick_from "${FOODS[@]}")"
FAV_DRINKS="$(pick_from "${DRINKS[@]}")"
FAV_DESSERTS="$(pick_from "${DESSERTS[@]}")"
FAV_MOVIE="$(pick_from "${MOVIES[@]}")"
FAV_SPORT="$(pick_from "${SPORTS[@]}")"
FAV_MUSIC="$(pick_from "${MUSIC[@]}")"
FAV_BOOK="$(pick_from "${BOOKS[@]}")"
FAV_GAME="$(pick_from "${GAMES[@]}")"
FAV_VACATION="$(pick_from "${VACATIONS[@]}")"
FAV_MEMORY="$(pick_from "${MEMORIES[@]}")"
CHILDREN_INFO="$(pick_from "${CHILDREN[@]}")"
MARRIAGE_HISTORY="$(pick_from "${MARRIAGE[@]}")"
RELIGION="$(pick_from "${RELIGIONS[@]}")"

# ---------------------------------------------------------------------------
# Preview
# ---------------------------------------------------------------------------
echo
echo "============================================================"
echo " PREVIEW — new member (not inserted yet)"
echo "============================================================"
printf "%-22s %s\n" "member_category:" "$MEMBER_CATEGORY"
printf "%-22s %s\n" "email:" "$EMAIL"
printf "%-22s %s\n" "member_id:" "$MEMBER_ID"
printf "%-22s %s\n" "status:" "$STATUS"
printf "%-22s %s\n" "initial_setup_done:" "$INITIAL_SETUP_DONE"
printf "%-22s %s\n" "password_hash:" "(cloned from ${DM1_EMAIL})"
printf "%-22s %s\n" "dl_sex:" "$DL_SEX"
printf "%-22s %s\n" "ethnicity:" "$ETHNIC_LABEL"
printf "%-22s %s\n" "dl/mailing name:" "$FIRST_NAME / $MIDDLE_NAME / $LAST_NAME"
printf "%-22s %s\n" "alias:" "$ALIAS"
printf "%-22s %s\n" "mailing_street:" "$MAILING_STREET"
printf "%-22s %s\n" "mailing_city:" "$MAILING_CITY"
printf "%-22s %s\n" "mailing_zip:" "$MAILING_ZIP"
printf "%-22s %s\n" "mailing_country:" "$MAILING_COUNTRY"
printf "%-22s %s\n" "phone:" "$PHONE"
printf "%-22s %s\n" "vet_bio:" "age=$AGE city=$CURRENT_CITY job=$JOB_TITLE company=$COMPANY"
printf "%-22s %s\n" "misc_bio:" "ethnicity=$ETHNIC_LABEL hobbies=$FAV_HOBBIES"
echo "============================================================"
echo
read -r -p "Confirm Insert (Y/n) ? " CONFIRM
CONFIRM_NORM="$(trim "$(printf '%s' "${CONFIRM:-Y}" | tr '[:upper:]' '[:lower:]')")"
if [[ -n "$CONFIRM_NORM" && "$CONFIRM_NORM" != "y" && "$CONFIRM_NORM" != "yes" ]]; then
  echo "NO INSERT"
  exit 0
fi

# ---------------------------------------------------------------------------
# Insert
# ---------------------------------------------------------------------------
TMP_SQL="$(mktemp -t CreateNewMember.XXXXXX.sql)"
trap 'rm -f "$TMP_SQL"' EXIT

cat > "$TMP_SQL" <<SQL
BEGIN;

-- Keep sequence ahead of existing rows (e.g. max=34 → nextval returns 35).
SELECT setval(
  '${SCHEMA}.singles_id_seq',
  (SELECT COALESCE(MAX(singles_id), 0) FROM ${SCHEMA}.singles)
);

WITH new_row AS (
  INSERT INTO ${SCHEMA}.singles (
    singles_id,
    member_id,
    member_category,
    email,
    phone,
    password_hash,
    status,
    theme,
    graphic,
    alias,
    prefix,
    mailing_firstname,
    mailing_middlename,
    mailing_lastname,
    mailing_street,
    mailing_city,
    mailing_zip,
    mailing_country,
    dl_firstname,
    dl_middlename,
    dl_lastname,
    dl_sex,
    dl_height,
    pp_nationality,
    pp_place_of_birth,
    my_refer_code,
    initial_setup_done,
    created_at,
    updated_at
  ) VALUES (
    nextval('${SCHEMA}.singles_id_seq'),
    ${MEMBER_ID},
    '$(sql_escape "$MEMBER_CATEGORY")'::${SCHEMA}.member_category_enum,
    '$(sql_escape "$EMAIL")',
    '$(sql_escape "$PHONE")',
    '$(sql_escape "$PASSWORD_HASH")',
    '$(sql_escape "$STATUS")'::${SCHEMA}.singles_status,
    'Coffey Dark',
    'maximum',
    '$(sql_escape "$ALIAS")',
    0,
    '$(sql_escape "$FIRST_NAME")',
    '$(sql_escape "$MIDDLE_NAME")',
    '$(sql_escape "$LAST_NAME")',
    '$(sql_escape "$MAILING_STREET")',
    '$(sql_escape "$MAILING_CITY")',
    '$(sql_escape "$MAILING_ZIP")',
    '$(sql_escape "$MAILING_COUNTRY")',
    '$(sql_escape "$FIRST_NAME")',
    '$(sql_escape "$MIDDLE_NAME")',
    '$(sql_escape "$LAST_NAME")',
    '$(sql_escape "$DL_SEX")',
    '$(sql_escape "$HEIGHT")',
    '$(sql_escape "$CITIZENSHIP")',
    '$(sql_escape "$BIRTH_COUNTRY")',
    '$(sql_escape "$MY_REFER_CODE")',
    ${INITIAL_SETUP_DONE},
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
  RETURNING singles_id
),
ins_vet AS (
  INSERT INTO ${SCHEMA}.vet_bio (
    singles_id,
    fullname,
    firstname,
    middlename,
    lastname,
    age,
    height,
    official_gender,
    current_city,
    homecity,
    countryofcitizenship,
    countryofbirth,
    company_domain_name,
    current_company,
    job_title,
    linkedin_url,
    company_email,
    college_name,
    highest_degree_completed,
    professional_license,
    degree_graduation_date,
    credit_score_grade,
    id_verification,
    work_verification,
    education_verification,
    linkedin_verification
  )
  SELECT
    new_row.singles_id,
    '$(sql_escape "$FULLNAME")',
    '$(sql_escape "$FIRST_NAME")',
    '$(sql_escape "$MIDDLE_NAME")',
    '$(sql_escape "$LAST_NAME")',
    ${AGE},
    '$(sql_escape "$HEIGHT")',
    '$(sql_escape "$GENDER_WORD")',
    '$(sql_escape "$CURRENT_CITY")',
    '$(sql_escape "$MAILING_CITY")',
    '$(sql_escape "$CITIZENSHIP")',
    '$(sql_escape "$BIRTH_COUNTRY")',
    '$(sql_escape "$DOMAIN")',
    '$(sql_escape "$COMPANY")',
    '$(sql_escape "$JOB_TITLE")',
    '$(sql_escape "$LINKEDIN")',
    '$(sql_escape "$COMPANY_EMAIL")',
    '$(sql_escape "$COLLEGE")',
    '$(sql_escape "$DEGREE")',
    'n/a',
    '${GRAD_YEAR}',
    'B',
    'notstarted',
    'notstarted',
    'notstarted',
    'notstarted'
  FROM new_row
  RETURNING singles_id
)
INSERT INTO ${SCHEMA}.misc_bio (
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
  religion,
  favorite_quotes
)
SELECT
  ins_vet.singles_id,
  '$(sql_escape "$FAV_HOBBIES")',
  '$(sql_escape "$FAV_FOOD")',
  '$(sql_escape "$FAV_DRINKS")',
  '$(sql_escape "$FAV_DESSERTS")',
  '$(sql_escape "$FAV_MOVIE")',
  '$(sql_escape "$FAV_SPORT")',
  '$(sql_escape "$FAV_MUSIC")',
  '$(sql_escape "$FAV_BOOK")',
  '$(sql_escape "$FAV_GAME")',
  '$(sql_escape "$FAV_VACATION")',
  '$(sql_escape "$FAV_MEMORY")',
  '$(sql_escape "$CHILDREN_INFO")',
  '$(sql_escape "$MARRIAGE_HISTORY")',
  '$(sql_escape "$ETHNIC_LABEL")',
  '$(sql_escape "$BIRTH_COUNTRY")',
  '$(sql_escape "$RELIGION")',
  'Be kind whenever possible.'
FROM ins_vet;

COMMIT;
SQL

if psql_q -f "$TMP_SQL" >/dev/null; then
  echo "INSERT SUCCESS"
else
  echo "NO INSERT"
  exit 1
fi

echo
echo "============================================================"
echo " INSERTED ROW"
echo "============================================================"
psql_q -c "
SELECT
  email AS \"email\",
  member_category::text AS \"member_category\",
  mailing_firstname AS \"firstname\",
  mailing_middlename AS \"middlename\",
  mailing_lastname AS \"lastname\",
  singles_id AS \"singles_id\",
  member_id AS \"member_id\",
  alias AS \"alias\"
FROM ${SCHEMA}.singles
WHERE lower(email) = lower('$(sql_escape "$EMAIL")');
"

# ---------------------------------------------------------------------------
# Suggested posting comments (display only — no insert yet)
# Facebook-style: short intros, dating-site outreach, life / travel stories.
# ---------------------------------------------------------------------------
POSTING_COMMENT_POOL=(
  "Hi everyone, I am new to TutaDates — looking forward to meeting y'all."
  "Hey we just went hiking, here are some photos:"
  "First time posting here. Soft hello from someone who loves weekend adventures."
  "Just got back from a beach trip — sand, sunsets, and way too much ice cream."
  "Coffee lover seeking good conversation. Bonus points if you like museums."
  "Spent the afternoon at a farmers market. Who else lives for fresh peaches?"
  "New to the area and exploring cute cafes. Any hidden gems to recommend?"
  "Road-tripped through the mountains last week. Nature really resets the soul."
  "Trying to be braver about putting myself out there. Hi, nice to meet you!"
  "Cooked a big Sunday dinner for friends. Food is my love language."
  "Caught a local live-music night — the band was amazing. Who else likes concerts?"
  "Vacation mode: passport stamps, messy itineraries, and happy tired feet."
  "Dog park mornings are my favorite. Looking for buddies who love outdoor walks."
  "Just finished a pottery class. Messy hands, big smile. Here's what I made:"
  "Visiting family this weekend — hometown nostalgia hits different."
  "Book + blanket + rainy day = perfect. What are you reading lately?"
  "Tried a new Thai place downtown. Spicy enough to make me cry (in a good way)."
  "Sunrise hike before work. Worth every early alarm. Photos coming:"
  "Looking for kind people to chat with — no games, just genuine connection."
  "Birthday dinner with friends last night. Grateful for the people who show up."
  "Flea market finds and thrift-store treasures. Anyone else love a good hunt?"
  "Weekend farmer's brunch, then a long walk by the river. Simple joys."
  "Just moved and still unpacking boxes. Send coffee recommendations please!"
  "Snow day vibes — hot chocolate and board games. What's your cozy ritual?"
  "Volunteered at the animal shelter today. My heart is so full."
  "Wine tasting with my sister. Looking for new friends who enjoy slow weekends."
  "City lights from the rooftop last night. Felt like a movie scene."
  "Training for a 5K — slow and steady. Anyone want an accountability buddy?"
  "Holiday market was packed but magical. Sharing a few snaps:"
  "Hello from someone who still believes in good first conversations."
)

suggest_count=$(rand_int 2 3)
pool_n=${#POSTING_COMMENT_POOL[@]}
declare -a SUGGESTED_COMMENTS=()
declare -a used_idx=()

while [[ ${#SUGGESTED_COMMENTS[@]} -lt "$suggest_count" ]]; do
  idx=$(rand_int 0 $((pool_n - 1)))
  already=0
  if [[ ${#used_idx[@]} -gt 0 ]]; then
    for u in "${used_idx[@]}"; do
      if [[ "$u" -eq "$idx" ]]; then
        already=1
        break
      fi
    done
  fi
  if [[ "$already" -eq 1 ]]; then
    continue
  fi
  used_idx+=("$idx")
  SUGGESTED_COMMENTS+=("${POSTING_COMMENT_POOL[$idx]}")
done

echo
echo "============================================================"
echo " SUGGESTED POSTING COMMENTS (display only — not inserted)"
echo " Pick one later when you create a posting. Count: ${#SUGGESTED_COMMENTS[@]}"
echo "============================================================"
i=1
for comment in "${SUGGESTED_COMMENTS[@]}"; do
  printf "  [%d] %s\n" "$i" "$comment"
  i=$((i + 1))
done
echo "============================================================"
