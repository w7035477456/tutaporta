/** Copy for one-time first-visit welcome popups (ColorTemplate16PopupCenterWide). */

export const FIRST_VISIT_INTRO_BOLD_PREFIX = "Don't be surprised to see";

export const FIRST_VISIT_PAGE_WELCOME_COPY = {
  picksPosts: {
    title: 'Welcome to your first visit to the Picks & Posts page!',
    introBody:
      " three profiles already here that you didn't pick—we added them to demonstrate how the platform works:",
    bullets: [
      'One profile has an approved brief bio request.',
      'One profile has an approved full bio request.',
      'One profile has a pending bio request with no response yet.'
    ],
    closing:
      "This is your go-to spot to browse member albums and posts, find people you'd like to connect with, and request their bios to turn them into acquaintances or buddies."
  },
  acquaintBuddies: {
    title: 'Welcome to your first visit to the Acquaint & Buddies page!',
    introBody:
      " two profiles here that you didn't pick—we added them to demonstrate how the platform works:",
    bullets: [
      'One profile is now your acquaintance because you have an approved brief bio request. As acquaintances, you can mutually access each other\'s Acquaintance Area. This includes viewing their brief bio by clicking "View Acquaintance Bio (Brief Bio)" and exploring their private Acquaintance Photo Albums, which are hidden from the public.',
      'One profile is now your buddy because you have an approved full bio request. As buddies, you can mutually access each other\'s Buddies Area, which includes viewing their full bio by clicking "View Buddies Bio (Full Bio)" and checking out their private photo albums. Buddies also enjoy several extra privileges beyond acquaintances, including Buddies Chat, Group Chat, and Buddies Postings.'
    ]
  },
  recBioRequest: {
    title: 'Welcome to your first visit to the Received Bio Req page!',
    introBody:
      ' two demo profiles here that have requested your bio—we added them to demonstrate how the platform works:',
    bullets: [
      'One profile requested to be your acquaintance, and you approved it. This happens automatically when you send a pick and post request to someone else; if they approve your request, you agree to mutually approve theirs so you both become acquaintances and can see each other\'s brief bios. If anything goes wrong, you always have the option to block or unblock them.',
      'One profile requested to be your buddy, and you approved it. This works similarly to your picks and posts—when you request someone as a buddy and they approve, you agree to mutually approve them as well, giving them access to your full bio so you become buddies. If anything goes wrong, you have the option to block or unblock them.'
    ]
  }
};
