#!/usr/bin/env bash
# CreatePosting.sh — print 3 suggested posting messages (display only — no DB insert).
#   bash /Users/a/code/main/CreatePosting.sh

set -euo pipefail

rand_int() {
  local min="$1" max="$2"
  echo $((min + RANDOM % (max - min + 1)))
}

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

pool_n=${#POSTING_COMMENT_POOL[@]}
declare -a MESSAGES=()
declare -a used_idx=()

while [[ ${#MESSAGES[@]} -lt 3 ]]; do
  idx=$(rand_int 0 $((pool_n - 1)))
  already=0
  for u in "${used_idx[@]-}"; do
    [[ -n "${u:-}" ]] || continue
    if [[ "$u" -eq "$idx" ]]; then
      already=1
      break
    fi
  done
  if [[ "$already" -eq 1 ]]; then
    continue
  fi
  used_idx+=("$idx")
  MESSAGES+=("${POSTING_COMMENT_POOL[$idx]}")
done

printf '%s\n' "${MESSAGES[@]}"
