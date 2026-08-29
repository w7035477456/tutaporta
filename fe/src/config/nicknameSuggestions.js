/**
 * Nickname picker: adjective mood groups + real first-name lists.
 *
 * Rules for a valid site nickname (Adjective + FirstName):
 * 1) 2nd word must be a real first name from these lists (not the member’s legal first name).
 * 2) 1st and 2nd words must “rhyme” = same first letter (e.g. BrainyBobby).
 * 3) 1st word must be an adjective/adverb from the adjective lists below.
 */

export const NICKNAME_ADJECTIVE_GROUPS = [
  {
    key: 'fun-playful',
    label: 'Fun & Playful',
    description: 'Best for lighthearted, energetic, or slightly chaotic personalities.',
    adjectives: [
      { word: 'Giggle', example: 'GiggleGina' },
      { word: 'Goofy', example: 'GoofyGreg' },
      { word: 'Silly', example: 'SillySam' },
      { word: 'Bubbly', example: 'BubblyBeth' },
      { word: 'Chirpy', example: 'ChirpyChris' },
      { word: 'Birdy', example: 'BirdyBen' },
      { word: 'Frolic', example: 'FrolicFran' },
      { word: 'Zany', example: 'ZanyZoe' },
      { word: 'Wacky', example: 'WackyWill' },
      { word: 'Cheeky', example: 'CheekyChloe' },
      { word: 'Perky', example: 'PerkyPat' },
      { word: 'Quirky', example: 'QuirkyQuinn' }
    ],
    female: [
      'Amy', 'Anna', 'Becca', 'Bonnie', 'Carla', 'Cindy', 'Dana', 'Debra', 'Emma', 'Erica',
      'Faye', 'Fran', 'Gina', 'Grace', 'Hannah', 'Holly', 'Iris', 'Ivy', 'Jill', 'Judy',
      'Kara', 'Kim', 'Lana', 'Lisa', 'Mona', 'Mary', 'Nina', 'Nora', 'Olga', 'Opal',
      'Pam', 'Polly', 'Quinn', 'Rita', 'Rose', 'Sara', 'Sue', 'Tina', 'Tess', 'Uma',
      'Vera', 'Vicky', 'Wendy', 'Willa', 'Xena', 'Yara', 'Yvonne', 'Zara', 'Zoe', 'Zola'
    ],
    male: [
      'Adam', 'Andy', 'Ben', 'Bill', 'Carl', 'Chris', 'Dan', 'Dave', 'Ed', 'Eric',
      'Frank', 'Fred', 'Greg', 'Gus', 'Hank', 'Hugo', 'Ian', 'Ivan', 'Jack', 'Jeff',
      'Ken', 'Kurt', 'Leo', 'Luke', 'Mark', 'Matt', 'Ned', 'Nick', 'Omar', 'Otto',
      'Pat', 'Pete', 'Quinn', 'Ray', 'Ron', 'Sam', 'Scott', 'Ted', 'Tim', 'Ulysses',
      'Vic', 'Vince', 'Wade', 'Will', 'Xander', 'York', 'Yuri', 'Zack', 'Zane', 'Zeke'
    ]
  },
  {
    key: 'cool-edgy',
    label: 'Cool & Edgy',
    description: 'Best for sharp, confident, or mysterious personas.',
    adjectives: [
      { word: 'Sleek', example: 'SleekSam' },
      { word: 'Cosmic', example: 'CosmicCole' },
      { word: 'Neon', example: 'NeonNina' },
      { word: 'Echo', example: 'EchoEmma' },
      { word: 'Diesel', example: 'DieselDan' },
      { word: 'Rogue', example: 'RogueRita' },
      { word: 'Vandal', example: 'VandalVic' },
      { word: 'Shadow', example: 'ShadowSue' },
      { word: 'Frosty', example: 'FrostyFran' },
      { word: 'Alpha', example: 'AlphaAmy' },
      { word: 'Static', example: 'StaticSeth' }
    ],
    female: [
      'Aria', 'Ava', 'Bella', 'Blair', 'Chloe', 'Claire', 'Elena', 'Elle', 'Fiona', 'Faith',
      'Hazel', 'Hope', 'Ivy', 'Isla', 'Jade', 'Juno', 'Kira', 'Kate', 'Luna', 'Lila',
      'Nova', 'Nyla', 'Olivia', 'Opal', 'Piper', 'Pearl', 'Quinn', 'Ruby', 'Reina', 'Stella',
      'Sage', 'Tessa', 'Tara', 'Una', 'Vera', 'Vega', 'Willa', 'Wynne', 'Xena', 'Yara',
      'Yuki', 'Zara', 'Zola', 'Cleo', 'Danni', 'Faye', 'Gigi', 'Iris', 'Lyra', 'Maya'
    ],
    male: [
      'Ace', 'Axel', 'Blaze', 'Bryn', 'Cole', 'Cash', 'Dash', 'Dex', 'Echo', 'Erik',
      'Finn', 'Ford', 'Gage', 'Grant', 'Hawk', 'Holt', 'Ian', 'Ivan', 'Jax', 'Jude',
      'Kai', 'Knox', 'Leo', 'Lane', 'Max', 'Miles', 'Nash', 'Noah', 'Owen', 'Otto',
      'Pax', 'Pike', 'Quinn', 'Rex', 'Remy', 'Seth', 'Troy', 'Tate', 'Vance', 'Vince',
      'Wade', 'Wes', 'Xander', 'York', 'Zane', 'Zeke', 'Felix', 'Hugo', 'Joel', 'Kurt'
    ]
  },
  {
    key: 'sweet-friendly',
    label: 'Sweet & Friendly',
    description: 'Best for warm, approachable, and endearing vibes.',
    adjectives: [
      { word: 'Sunny', example: 'SunnySue' },
      { word: 'Sweet', example: 'SweetSam' },
      { word: 'Merry', example: 'MerryMary' },
      { word: 'Jolly', example: 'JollyJack' },
      { word: 'Cozy', example: 'CozyCarl' },
      { word: 'Kind', example: 'KindKim' },
      { word: 'Gentle', example: 'GentleGina' },
      { word: 'Tiny', example: 'TinyTina' },
      { word: 'Little', example: 'LittleLuke' },
      { word: 'Happy', example: 'HappyHank' },
      { word: 'Honest', example: 'HonestHolly' }
    ],
    female: [
      'Alice', 'Amy', 'Beth', 'Betsy', 'Carol', 'Cathy', 'Daisy', 'Donna', 'Eve', 'Ellen',
      'Fern', 'Faye', 'Ginger', 'Gina', 'Holly', 'Helen', 'Joy', 'Jane', 'Kitty', 'Kate',
      'Lily', 'Lucy', 'Melody', 'Mary', 'Nora', 'Nancy', 'Pearl', 'Patty', 'Queenie', 'Quinn',
      'Rosie', 'Ruth', 'Sugar', 'Sara', 'Tulip', 'Tina', 'Violet', 'Vera', 'Wendy', 'Wanda',
      'Angel', 'Annie', 'Ellie', 'Emma', 'Flora', 'Grace', 'Isla', 'Jewel', 'Lulu', 'Sadie'
    ],
    male: [
      'Buddy', 'Bobby', 'Chip', 'Charlie', 'Duke', 'Danny', 'Earl', 'Eddie', 'Gus', 'Greg',
      'Hank', 'Harry', 'Jack', 'Joey', 'King', 'Kenny', 'Luke', 'Lenny', 'Mack', 'Mikey',
      'Nick', 'Ned', 'Pat', 'Pete', 'Ray', 'Reggie', 'Sam', 'Sonny', 'Tex', 'Timmy',
      'Vic', 'Vinny', 'Willie', 'Walt', 'Ziggy', 'Zack', 'Alfie', 'Andy', 'Cody', 'Dylan',
      'Frankie', 'Georgie', 'Ollie', 'Oscar', 'Benny', 'Billy', 'Tommy', 'Tony', 'Ricky', 'Roger'
    ]
  },
  {
    key: 'high-energy',
    label: 'High-Energy & Action',
    description: 'Best for fast-paced, intense, or bold personalities.',
    adjectives: [
      { word: 'Flash', example: 'FlashFran' },
      { word: 'Turbo', example: 'TurboTim' },
      { word: 'Hyper', example: 'HyperHank' },
      { word: 'Wild', example: 'WildWill' },
      { word: 'Nitro', example: 'NitroNina' },
      { word: 'Blaze', example: 'BlazeBen' },
      { word: 'Stormy', example: 'StormySam' },
      { word: 'Spark', example: 'SparkSue' },
      { word: 'Rapid', example: 'RapidRuth' },
      { word: 'Dash', example: 'DashDan' },
      { word: 'Heavy', example: 'HeavyHank' }
    ],
    female: [
      'Ada', 'Ava', 'Becca', 'Bella', 'Cara', 'Cora', 'Dana', 'Dora', 'Eden', 'Eva',
      'Faith', 'Fran', 'Gail', 'Gina', 'Hana', 'Hope', 'Iris', 'Ivy', 'Jade', 'June',
      'Kayla', 'Kara', 'Lana', 'Lena', 'Maya', 'Mira', 'Nina', 'Nora', 'Olga', 'Opal',
      'Paige', 'Piper', 'Quinn', 'Rita', 'Ruth', 'Sage', 'Sara', 'Terra', 'Tina', 'Uma',
      'Vera', 'Vicky', 'Wendy', 'Willa', 'Xena', 'Yara', 'Zoe', 'Zola', 'Mila', 'Nora'
    ],
    male: [
      'Adam', 'Alex', 'Ben', 'Brad', 'Carl', 'Cody', 'Dan', 'Drew', 'Ethan', 'Erik',
      'Finn', 'Frank', 'Gabe', 'Greg', 'Hank', 'Hugo', 'Ian', 'Ivan', 'Jake', 'Joel',
      'Kurt', 'Kyle', 'Leo', 'Liam', 'Mark', 'Matt', 'Nate', 'Nick', 'Omar', 'Owen',
      'Paul', 'Pete', 'Quinn', 'Ryan', 'Ross', 'Sam', 'Seth', 'Tom', 'Troy', 'Ulysses',
      'Vic', 'Vince', 'Wade', 'Will', 'Xander', 'York', 'Zack', 'Zane', 'Blake', 'Chase'
    ]
  },
  {
    key: 'brainy-quirky',
    label: 'Brainy & Quirky',
    description: 'Best for clever, sarcastic, or slightly eccentric names.',
    adjectives: [
      { word: 'Clever', example: 'CleverChris' },
      { word: 'Smarty', example: 'SmartySam' },
      { word: 'Crafty', example: 'CraftyCarl' },
      { word: 'Brainy', example: 'BrainyBobby' },
      { word: 'Savvy', example: 'SavvySue' },
      { word: 'Sharp', example: 'SharpSam' },
      { word: 'Sly', example: 'SlySeth' },
      { word: 'Chilly', example: 'ChillyChris' },
      { word: 'Witty', example: 'WittyWill' },
      { word: 'Moody', example: 'MoodyMary' },
      { word: 'Snazzy', example: 'SnazzySam' },
      { word: 'Loony', example: 'LoonyLuke' }
    ],
    female: [
      'Ada', 'Amy', 'Beth', 'Bella', 'Cara', 'Chloe', 'Dana', 'Dolly', 'Ember', 'Emma',
      'Fawn', 'Fran', 'Grace', 'Gina', 'Holly', 'Helen', 'Iris', 'Ivy', 'Jade', 'Jill',
      'Kara', 'Kim', 'Lana', 'Lucy', 'Maya', 'Mary', 'Nina', 'Nora', 'Olga', 'Opal',
      'Pam', 'Pearl', 'Quinn', 'Rita', 'Rose', 'Sadie', 'Sue', 'Tess', 'Tina', 'Una',
      'Vera', 'Vicky', 'Wendy', 'Willa', 'Xena', 'Yara', 'Zoey', 'Zara', 'Bunny', 'Candy'
    ],
    male: [
      'Adam', 'Andy', 'Ben', 'Bobby', 'Carl', 'Chip', 'Dan', 'Drew', 'Ernie', 'Eric',
      'Freddy', 'Finn', 'Gordie', 'Greg', 'Hugh', 'Hank', 'Ian', 'Ivan', 'Jeff', 'Joel',
      'Kurt', 'Ken', 'Leo', 'Luke', 'Mark', 'Matt', 'Ned', 'Nick', 'Otis', 'Omar',
      'Pat', 'Pete', 'Quinn', 'Ray', 'Ron', 'Sam', 'Seth', 'Ted', 'Tim', 'Ulric',
      'Vince', 'Vic', 'Wes', 'Will', 'Xavi', 'Yuri', 'Zack', 'Zeke', 'Ryder', 'Hugo'
    ]
  }
];

function titleCaseWord(word) {
  const w = String(word ?? '').replace(/[^A-Za-z0-9]/g, '');
  if (!w) return '';
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

function firstLetterKey(word) {
  const m = String(word ?? '').match(/[A-Za-z]/);
  return m ? m[0].toLowerCase() : '';
}

/** All adjective words from the picker (title case). */
export function listNicknameAdjectives() {
  const out = [];
  const seen = new Set();
  for (const group of NICKNAME_ADJECTIVE_GROUPS) {
    for (const item of group.adjectives ?? []) {
      const word = titleCaseWord(typeof item === 'string' ? item : item.word);
      const key = word.toLowerCase();
      if (!word || seen.has(key)) continue;
      seen.add(key);
      out.push(word);
    }
  }
  return out;
}

/** All real first names (female + male), unique, title case. */
export function listNicknameFirstNames({ gender = 'any' } = {}) {
  const out = [];
  const seen = new Set();
  for (const group of NICKNAME_ADJECTIVE_GROUPS) {
    const pools = [];
    if (gender === 'female' || gender === 'any') pools.push(group.female ?? []);
    if (gender === 'male' || gender === 'any') pools.push(group.male ?? []);
    for (const pool of pools) {
      for (const raw of pool) {
        const word = titleCaseWord(raw);
        const key = word.toLowerCase();
        if (!word || seen.has(key)) continue;
        seen.add(key);
        out.push(word);
      }
    }
  }
  return out;
}

/**
 * Split CamelCase alias into adjective + first-name using known adjective list
 * (longest adjective prefix wins). Trailing digits are ignored for matching.
 */
export function parseNicknameParts(alias, adjectives = listNicknameAdjectives()) {
  const raw = String(alias ?? '').replace(/[^A-Za-z0-9]/g, '');
  if (!raw) return null;
  const letters = raw.replace(/[0-9]+$/g, '');
  if (letters.length < 4) return null;
  const sorted = [...adjectives].sort((a, b) => b.length - a.length);
  const lower = letters.toLowerCase();
  for (const adj of sorted) {
    const a = adj.toLowerCase();
    if (a.length < 2 || a.length >= lower.length) continue;
    if (!lower.startsWith(a)) continue;
    const namePart = letters.slice(adj.length);
    if (!namePart || !/^[A-Za-z]/.test(namePart)) continue;
    return {
      adjective: titleCaseWord(adj),
      firstName: titleCaseWord(namePart.replace(/[0-9]+$/g, '') || namePart),
      suffixDigits: (raw.match(/[0-9]+$/) || [''])[0]
    };
  }
  return null;
}

export function isKnownNicknameFirstName(name, firstNames = listNicknameFirstNames()) {
  const key = titleCaseWord(name).toLowerCase();
  if (!key) return false;
  return firstNames.some((n) => n.toLowerCase() === key);
}

/**
 * Valid when Adj + FirstName, both known, same first letter, and firstName ≠ excludeFirstName.
 */
export function isValidRhymingNickname(alias, opts = {}) {
  const adjectives = opts.adjectives || listNicknameAdjectives();
  const firstNames = opts.firstNames || listNicknameFirstNames();
  const exclude = titleCaseWord(opts.excludeFirstName).toLowerCase();
  const parts = parseNicknameParts(alias, adjectives);
  if (!parts) return false;
  if (!isKnownNicknameFirstName(parts.firstName, firstNames)) return false;
  if (exclude && parts.firstName.toLowerCase() === exclude) return false;
  return firstLetterKey(parts.adjective) === firstLetterKey(parts.firstName);
}

export function buildRhymingNickname(adjective, firstName, suffixDigits = '') {
  const adj = titleCaseWord(adjective);
  const name = titleCaseWord(firstName);
  if (!adj || !name) return '';
  return `${adj}${name}${String(suffixDigits || '').replace(/[^0-9]/g, '')}`.slice(0, 80);
}

const NICKNAME_GENDER_PREFERENCE_KEY = 'nicknamePickerGenderPreference';

/** First female/male name click in this browser session (female | male). */
export function readNicknameGenderPreference() {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const v = String(sessionStorage.getItem(NICKNAME_GENDER_PREFERENCE_KEY) || '').trim();
    return v === 'female' || v === 'male' ? v : null;
  } catch {
    return null;
  }
}

export function setNicknameGenderPreferenceOnce(gender) {
  if (gender !== 'female' && gender !== 'male') return;
  if (readNicknameGenderPreference()) return;
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(NICKNAME_GENDER_PREFERENCE_KEY, gender);
  } catch {
    // ignore
  }
}

/** Map singles.gender_self_report ('M'|'F') to nickname name-list gender. */
export function genderSelfReportToNicknameGender(genderSelfReport) {
  const g = String(genderSelfReport ?? '')
    .trim()
    .toUpperCase();
  if (g === 'M') return 'male';
  if (g === 'F') return 'female';
  return null;
}

/** Prefer profile gender from login popup, then first female/male name click this session. */
export function resolveNicknameSuggestGender({ genderSelfReport } = {}) {
  return genderSelfReportToNicknameGender(genderSelfReport) || readNicknameGenderPreference() || 'any';
}

/** Random adjective + matching first name; gender from first name-column pick, else any. */
export function generateRandomRhymingNickname({ gender = 'any', excludeFirstName = '' } = {}) {
  const adjectives = listNicknameAdjectives();
  const exclude = titleCaseWord(excludeFirstName).toLowerCase();
  const resolvedGender = gender === 'female' || gender === 'male' ? gender : 'any';

  for (let attempt = 0; attempt < 240; attempt += 1) {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const letter = firstLetterKey(adj);
    if (!letter) continue;

    const matchingNames = listNicknameFirstNames({ gender: resolvedGender }).filter(
      (name) => firstLetterKey(name) === letter && name.toLowerCase() !== exclude
    );
    if (!matchingNames.length) continue;

    const firstName = matchingNames[Math.floor(Math.random() * matchingNames.length)];
    const built = buildRhymingNickname(adj, firstName);
    if (built && isValidRhymingNickname(built, { excludeFirstName, adjectives, firstNames: listNicknameFirstNames() })) {
      return built;
    }
  }
  return '';
}

export function wordsShareFirstLetter(a, b) {
  const la = firstLetterKey(a);
  const lb = firstLetterKey(b);
  return Boolean(la && lb && la === lb);
}

export { titleCaseWord as titleCaseNicknameWord, firstLetterKey as nicknameFirstLetterKey };

/** @deprecated use NICKNAME_ADJECTIVE_GROUPS */
export const FEMALE_NICKNAME_SUGGESTIONS = Object.fromEntries(
  NICKNAME_ADJECTIVE_GROUPS.map((g) => [g.label, g.female])
);

/** @deprecated use NICKNAME_ADJECTIVE_GROUPS */
export const MALE_NICKNAME_SUGGESTIONS = Object.fromEntries(
  NICKNAME_ADJECTIVE_GROUPS.map((g) => [g.label, g.male])
);
