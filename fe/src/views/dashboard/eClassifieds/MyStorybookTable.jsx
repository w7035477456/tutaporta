const ONES = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19
};

const TENS = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90
};

const SCALES = {
  hundred: 100,
  thousand: 1000,
  million: 1000000
};

/** Common misspellings seen in demo / free-text prices. */
const WORD_ALIASES = {
  hundres: 'hundred',
  hundered: 'hundred',
  hundurd: 'hundred'
};

function wordsToNumber(text) {
  const raw = String(text)
    .toLowerCase()
    .replace(/[^a-z\s-]/g, ' ')
    .trim();
  if (!raw) return null;

  let total = 0;
  let current = 0;
  let sawNumberWord = false;

  for (const part of raw.split(/[\s-]+/)) {
    const word = WORD_ALIASES[part] || part;
    if (word === 'and' || word === 'dollar' || word === 'dollars' || word === 'buck' || word === 'bucks') {
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(ONES, word)) {
      current += ONES[word];
      sawNumberWord = true;
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(TENS, word)) {
      current += TENS[word];
      sawNumberWord = true;
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(SCALES, word)) {
      current = (current || 1) * SCALES[word];
      if (SCALES[word] >= 1000) {
        total += current;
        current = 0;
      }
      sawNumberWord = true;
      continue;
    }
  }

  if (!sawNumberWord) return null;
  return total + current;
}

function formatPrice(price) {
  if (price == null || price === '') return '—';

  const asNumber = Number(price);
  if (Number.isFinite(asNumber) && String(price).trim() !== '') {
    // Digits (number or numeric string)
    if (typeof price === 'number' || /^-?\d+(\.\d+)?$/.test(String(price).trim())) {
      return `$${asNumber}`;
    }
  }

  const fromWords = wordsToNumber(price);
  if (fromWords != null) return `$${fromWords}`;

  return String(price);
}

/** Accept "City, ST", "City, ST 22201", or a bare ZIP like 22201 / "22201". */
function formatCity(city) {
  if (city == null || city === '') return '—';
  if (typeof city === 'number' && Number.isFinite(city)) return String(city);
  return String(city).trim();
}

/**
 * Presentational listings table for eClassifieds storybook demos.
 * Pass static or live `listings` to demo/test the table in isolation.
 */
export default function MyStorybookTable({ listings = [], busyId = '', onSubmitForReview }) {
  return (
    <table className="ecsb-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Title</th>
          <th>Category</th>
          <th>Price</th>
          <th>City</th>
          <th>Seller</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {listings.map((l) => (
          <tr key={l.id}>
            <td>
              <span className="ecsb-code">{l.id}</span>
            </td>
            <td>{l.title}</td>
            <td>{l.category}</td>
            <td>{formatPrice(l.price)}</td>
            <td>{formatCity(l.city)}</td>
            <td>{l.seller}</td>
            <td>
              <button
                type="button"
                className="ecsb-btn ecsb-btn-primary"
                disabled={Boolean(busyId) || !onSubmitForReview}
                onClick={() => onSubmitForReview?.(l.id)}
              >
                {busyId === l.id ? 'Starting…' : 'Submit for review'}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
