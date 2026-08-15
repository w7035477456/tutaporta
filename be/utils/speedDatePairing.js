function pairKey(a, b) {
  const lo = Math.min(Number(a), Number(b));
  const hi = Math.max(Number(a), Number(b));
  return `${lo}_${hi}`;
}

function shuffleCopy(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function genderLetter(value) {
  const g = String(value ?? '').trim().toUpperCase().slice(0, 1);
  return g === 'M' || g === 'F' ? g : '';
}

/**
 * Build one round of 1:1 pairs without repeating a prior pair in this event.
 * @param {{ singles_id: number, gender?: string }[]} members
 * @param {Set<string>} previousPairKeys keys from pairKey()
 * @param {'gender'|'random'} mixMode
 * @param {number} roundNo 1-based
 */
export function buildRoundPairs(members, previousPairKeys, mixMode, roundNo) {
  const present = (Array.isArray(members) ? members : [])
    .map((m) => ({
      singles_id: Number(m?.singles_id),
      gender: genderLetter(m?.gender)
    }))
    .filter((m) => Number.isFinite(m.singles_id) && m.singles_id > 0);

  const used = previousPairKeys instanceof Set ? previousPairKeys : new Set();
  const paired = new Set();
  const pairs = [];

  const tryPair = (a, b) => {
    const idA = Number(a);
    const idB = Number(b);
    if (!Number.isFinite(idA) || !Number.isFinite(idB) || idA === idB) return false;
    if (paired.has(idA) || paired.has(idB)) return false;
    const key = pairKey(idA, idB);
    if (used.has(key)) return false;
    paired.add(idA);
    paired.add(idB);
    pairs.push([Math.min(idA, idB), Math.max(idA, idB)]);
    return true;
  };

  if (String(mixMode).toLowerCase() === 'gender') {
    const males = present.filter((m) => m.gender === 'M').map((m) => m.singles_id);
    const females = present.filter((m) => m.gender === 'F').map((m) => m.singles_id);
    const others = present.filter((m) => m.gender !== 'M' && m.gender !== 'F').map((m) => m.singles_id);

    if (males.length && females.length) {
      const rotate = Math.max(0, Number(roundNo) - 1) % females.length;
      const rotatedF = females.slice(rotate).concat(females.slice(0, rotate));
      males.forEach((maleId, i) => {
        if (i >= rotatedF.length) return;
        if (!tryPair(maleId, rotatedF[i])) {
          for (const femaleId of females) {
            if (tryPair(maleId, femaleId)) break;
          }
        }
      });
    }

    const leftover = shuffleCopy([...males, ...females, ...others].filter((id) => !paired.has(id)));
    for (let i = 0; i < leftover.length; i += 1) {
      if (paired.has(leftover[i])) continue;
      for (let j = i + 1; j < leftover.length; j += 1) {
        if (tryPair(leftover[i], leftover[j])) break;
      }
    }
  } else {
    const order = shuffleCopy(present.map((m) => m.singles_id));
    for (let i = 0; i < order.length; i += 1) {
      if (paired.has(order[i])) continue;
      for (let j = i + 1; j < order.length; j += 1) {
        if (tryPair(order[i], order[j])) break;
      }
    }
  }

  const sitOuts = present.map((m) => m.singles_id).filter((id) => !paired.has(id));
  return { pairs, sitOuts };
}

export { pairKey };
