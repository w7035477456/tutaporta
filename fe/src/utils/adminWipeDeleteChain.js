/** DeleteById tab: Postgres FK cascade chain for red/yellow Delete Chain marks. */

export const WIPE_PHOTO_FOLDER_KEY = 'vsingles_photo_folder';

/** Direct ON DELETE CASCADE (or app-linked) children per DeleteById table key. */
export const ADMIN_WIPE_DELETE_CHAIN_CHILDREN = {
  singles: [
    'postings',
    'photos',
    'videos',
    'vet_bio',
    'misc_bio',
    'requests',
    'audit_registrations',
    'user_customization',
    'mobile_photo_upload_sessions',
    'photo_albums_invites',
    'photo_albums_shared_albums'
  ],
  postings: ['posting_photos'],
  posting_photos: ['posting_comments'],
  photos: [WIPE_PHOTO_FOLDER_KEY]
};

/**
 * @param {Iterable<string>} primaryKeys
 * @param {Set<string>} visibleKeys
 */
export function computeDeleteChainMarks(primaryKeys, visibleKeys) {
  const primary = new Set();
  const child = new Set();

  for (const key of primaryKeys) {
    if (visibleKeys.has(key)) primary.add(key);
  }

  const addDescendants = (key) => {
    const children = ADMIN_WIPE_DELETE_CHAIN_CHILDREN[key] ?? [];
    for (const childKey of children) {
      if (!visibleKeys.has(childKey)) continue;
      if (primary.has(childKey)) continue;
      if (child.has(childKey)) {
        addDescendants(childKey);
        continue;
      }
      child.add(childKey);
      addDescendants(childKey);
    }
  };

  for (const key of primary) addDescendants(key);
  return { primary, child };
}

/**
 * Drop primaries covered by another selected primary's cascade chain.
 * @param {Set<string>} primaryKeys
 * @param {Set<string>} visibleKeys
 */
export function minimalDeleteChainPrimaries(primaryKeys, visibleKeys) {
  const { primary } = computeDeleteChainMarks(primaryKeys, visibleKeys);
  const allDescendants = new Map();

  for (const key of primary) {
    const descendants = new Set();
    const walk = (node) => {
      for (const childKey of ADMIN_WIPE_DELETE_CHAIN_CHILDREN[node] ?? []) {
        if (!visibleKeys.has(childKey)) continue;
        descendants.add(childKey);
        walk(childKey);
      }
    };
    walk(key);
    allDescendants.set(key, descendants);
  }

  return [...primary].filter((key) => {
    for (const other of primary) {
      if (other === key) continue;
      if (allDescendants.get(other)?.has(key)) return false;
    }
    return true;
  });
}

/**
 * @param {Array<{ key: string, label?: string }>} tables
 * @param {string[]} primaryKeys
 */
export function describeDeleteChainPlan(tables, primaryKeys) {
  const visibleKeys = new Set(tables.map((row) => row.key));
  const { primary, child } = computeDeleteChainMarks(primaryKeys, visibleKeys);
  const minimal = minimalDeleteChainPrimaries(primary, visibleKeys);
  const labelByKey = new Map(tables.map((row) => [row.key, row.label ?? row.key]));

  return {
    primary: [...primary].map((key) => labelByKey.get(key) ?? key),
    child: [...child].map((key) => labelByKey.get(key) ?? key),
    executeKeys: minimal
  };
}
