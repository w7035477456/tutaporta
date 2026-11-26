#!/usr/bin/env python3
"""
Find duplicate files across the TutaMall storage folders. READ-ONLY: never changes or deletes anything.

Step 1: group every regular file by size (cheap, no reading).
Step 2: for sizes shared by 2+ files, hash the first 64 KB to split obvious non-matches.
Step 3: confirm with a full SHA-256. Only identical SHA-256 = duplicate.

Default folders (relative to the current directory):
  ./tutamallStorageFolder_outdatedOct2021
  ./tutamallStorageFolder_largecheapstorage_outdatedOct2021

Usage:
  cd ~/i/mac_storage                       # Mac   (Ubuntu: cd ~/i/ubuntu_storage)
  python3 ~/code/main/scripts/find-storage-duplicates.py
  python3 ~/code/main/scripts/find-storage-duplicates.py --min-size 1024 --csv dups.csv
  python3 ~/code/main/scripts/find-storage-duplicates.py DIR1 DIR2 ...

Options:
  --min-size N   ignore files smaller than N bytes (default 1; empty files are always ignored)
  --csv FILE     also write every duplicate as a CSV row: group,sha256,size,path
  --quiet        summary only

Notes:
  * Symlinks are not followed (e.g. notes/TutaNotes/photos -> photos/ is not double-counted).
  * Vault `.enc` files are encrypted with a random IV, so two copies of the same photo sealed
    separately are NOT byte-identical and will not show here. Identical `.enc` files mean the same
    sealed file was copied.
"""
import argparse
import csv
import hashlib
import os
import sys
from collections import defaultdict

DEFAULT_DIRS = [
    './tutamallStorageFolder_outdatedOct2021',
    './tutamallStorageFolder_largecheapstorage_outdatedOct2021',
]
HEAD_BYTES = 64 * 1024
CHUNK = 1024 * 1024


def human(n):
    for unit in ('B', 'KB', 'MB', 'GB', 'TB'):
        if n < 1024 or unit == 'TB':
            return f'{n:.1f} {unit}' if unit != 'B' else f'{n} B'
        n /= 1024


def walk_files(root):
    """Yield (path, size) for regular files; never follows symlinks."""
    stack = [root]
    while stack:
        d = stack.pop()
        try:
            with os.scandir(d) as it:
                for e in it:
                    try:
                        if e.is_symlink():
                            continue
                        if e.is_dir(follow_symlinks=False):
                            stack.append(e.path)
                        elif e.is_file(follow_symlinks=False):
                            yield e.path, e.stat(follow_symlinks=False).st_size
                    except OSError as err:
                        print(f'  skip {e.path}: {err}', file=sys.stderr)
        except OSError as err:
            print(f'  skip {d}: {err}', file=sys.stderr)


def hash_file(path, limit=None):
    h = hashlib.sha256()
    read = 0
    with open(path, 'rb') as f:
        while True:
            want = CHUNK if limit is None else min(CHUNK, limit - read)
            if want <= 0:
                break
            b = f.read(want)
            if not b:
                break
            h.update(b)
            read += len(b)
    return h.hexdigest()


def split_by(paths, key_fn):
    groups = defaultdict(list)
    for p in paths:
        try:
            groups[key_fn(p)].append(p)
        except OSError as err:
            print(f'  skip {p}: {err}', file=sys.stderr)
    return [g for g in groups.values() if len(g) > 1], groups


def main():
    ap = argparse.ArgumentParser(description='Find duplicate files (size, then SHA-256). Read-only.')
    ap.add_argument('dirs', nargs='*', default=DEFAULT_DIRS)
    ap.add_argument('--min-size', type=int, default=1)
    ap.add_argument('--csv')
    ap.add_argument('--quiet', action='store_true')
    a = ap.parse_args()

    roots = []
    for d in a.dirs:
        if os.path.isdir(d):
            roots.append(os.path.abspath(d))
        else:
            print(f'WARNING: not a folder, skipped: {d}', file=sys.stderr)
    if not roots:
        print('ERROR: no folders to scan (cd to the storage parent folder, or pass folders).', file=sys.stderr)
        return 2

    # Same inode reached twice (hard links / overlapping roots) counts once.
    by_size = defaultdict(list)
    seen = set()
    total = 0
    for r in roots:
        print(f'Scanning {r} …', file=sys.stderr)
        for path, size in walk_files(r):
            try:
                st = os.stat(path, follow_symlinks=False)
            except OSError:
                continue
            ino = (st.st_dev, st.st_ino)
            if ino in seen:
                continue
            seen.add(ino)
            total += 1
            if size >= max(1, a.min_size):
                by_size[size].append(path)

    candidates = {s: ps for s, ps in by_size.items() if len(ps) > 1}
    n_cand = sum(len(ps) for ps in candidates.values())
    print(f'{total} files scanned; {n_cand} share a size with another file — checking content …', file=sys.stderr)

    dup_groups = []  # (sha, size, [paths])
    for size, paths in sorted(candidates.items(), reverse=True):
        head_groups, _ = split_by(paths, lambda p: hash_file(p, HEAD_BYTES))
        for hg in head_groups:
            if size <= HEAD_BYTES:
                full = {hash_file(hg[0], HEAD_BYTES): hg}  # head hash already covers the whole file
            else:
                _, full = split_by(hg, hash_file)
            for sha, ps in full.items():
                if len(ps) > 1:
                    dup_groups.append((sha, size, sorted(ps)))

    dup_groups.sort(key=lambda g: g[1] * (len(g[2]) - 1), reverse=True)
    wasted = sum(size * (len(ps) - 1) for _, size, ps in dup_groups)
    extra = sum(len(ps) - 1 for _, _, ps in dup_groups)

    if not a.quiet:
        for i, (sha, size, ps) in enumerate(dup_groups, 1):
            print(f'\n#{i}  {len(ps)} copies x {human(size)}  sha256={sha[:16]}…')
            for p in ps:
                print(f'    {p}')

    print('\n=== SUMMARY ===')
    print(f'folders scanned : {len(roots)}')
    print(f'files scanned   : {total}')
    print(f'duplicate groups: {len(dup_groups)}')
    print(f'extra copies    : {extra}')
    print(f'space reclaimable if one copy kept per group: {human(wasted)}')

    if a.csv:
        with open(a.csv, 'w', newline='') as f:
            w = csv.writer(f)
            w.writerow(['group', 'sha256', 'size', 'path'])
            for i, (sha, size, ps) in enumerate(dup_groups, 1):
                for p in ps:
                    w.writerow([i, sha, size, p])
        print(f'CSV written: {os.path.abspath(a.csv)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
