/** Meetup events offered in the Get My Raffle drop-down (source of truth for FE + ticket checks). */
export const RAFFLE_EVENTS = [
  {
    key: 'ssb-halloween-greenhouse-2026',
    label: 'Social Sips & Bites Halloween Party at The Greenhouse! (hosted by Sam M. and 2 others)',
    url: 'https://www.meetup.com/social-sips-bites-mclean-edition/events/316355608/?recId=df3aa9bc-4b09-428c-bb1e-5724f22c7ba3&recSource=ml-popular-events-nearby-offline&searchId=74883366-2f70-4c05-ab1c-787e0f3c4a50&eventOrigin=find_page%24inPerson'
  },
  {
    key: 'meet-greet-mustafa-2026',
    label: 'Meet & Greet by Mustafa R.',
    url: 'https://www.meetup.com/dmv-social-20-s-40-s/events/316715239/?recId=df3aa9bc-4b09-428c-bb1e-5724f22c7ba3&recSource=ml-popular-events-nearby-offline&searchId=74883366-2f70-4c05-ab1c-787e0f3c4a50&eventOrigin=find_page%24inPerson'
  }
];

export function findRaffleEvent(eventKey) {
  const key = String(eventKey ?? '').trim();
  return RAFFLE_EVENTS.find((event) => event.key === key) || null;
}
