import {
  TOUR_STEP_ALL_SINGLES,
  TOUR_STEP_MY_PICKS,
  TOUR_STEP_PICKS_BRIEF_BIO,
  TOUR_STEP_THEME,
  TOUR_STEP_VETTED_FRIENDS_SMS
} from 'utils/vsinglesTour';

export const VSINGLES_TOUR_STEPS = {
  [TOUR_STEP_THEME]: {
    title: 'Guided Tour:',
    body:
      'This is the theme selection. You can select either series of light or series of dark theme. Here you can also logout of entire mall.',
    showPrev: false,
    showNext: true,
    showEnd: true,
    nextLabel: 'Next',
    centerPopup: false
  },
  [TOUR_STEP_ALL_SINGLES]: {
    title: 'Guided Tour:',
    body:
      'Step 1: Click on All Singles. Here you can use filter to get list of singles near your zip code and age group. Once you see someone you may be interested in knowing more, click \'My Picks\'.',
    showPrev: true,
    showNext: true,
    showEnd: true,
    nextLabel: 'NEXT',
    prevLabel: 'PREV',
    endLabel: 'End Tour',
    centerPopup: true
  },
  [TOUR_STEP_MY_PICKS]: {
    title: 'Guided Tour: Step 2 of 7',
    bodyParagraphs: [
      'The members you added on All Singles appear here on Picks & Posts. Tap a photo on the left to read their posts and messages on the right.',
      'Use the green Brief Bio and Full Bio buttons under each pick to request more information when you are ready.'
    ],
    sections: [
      {
        heading: 'How Bio Requests Work',
        items: [
          'Mutual Privacy: Your request is private until the member accepts.',
          'Full Control: Members choose what to share and can decline at any time.',
          'Next Steps: After a request is accepted, you can continue the conversation in posts and messages.'
        ]
      },
      {
        heading: 'Security & Verification',
        items: [
          'Vetted Profiles: Look for verified members when browsing singles.',
          'Data Protection: Your picks and requests stay within the mall account system.'
        ]
      },
      {
        heading: 'Try the Demo',
        items: [
          'Three demo members (M100164, M100357, and M100236) were added to your picks so you can practice the flow.'
        ]
      }
    ],
    showPrev: true,
    showNext: true,
    showEnd: true,
    nextLabel: 'NEXT',
    prevLabel: 'PREV',
    endLabel: 'End Tour',
    wideRightPopup: true
  },
  [TOUR_STEP_PICKS_BRIEF_BIO]: {
    title: 'Guided Tour: Step 3 of 7',
    bodyParagraphs: [
      'We have added three Demo Users from the \'All Singles\' menu into your Picks & Posts list. Each demo user has a completed bio ready for you.',
      'When you click Next, the system will automatically request their brief bios. While real users typically take a few days to reply, these demo users will instantly approve your request!',
      'The tour will then automatically take you to the \'Vetted Friends\' menu so you can see your new connections. Click Next to try it out!'
    ],
    showPrev: true,
    showNext: true,
    showEnd: true,
    nextLabel: 'NEXT',
    prevLabel: 'PREV',
    endLabel: 'End Tour',
    wideRightPopup: true
  },
  [TOUR_STEP_VETTED_FRIENDS_SMS]: {
    title: 'Guided Tour: Step 4 of 7',
    bodyParagraphs: [
      'Here is how different permission levels affect your options:',
      'Lisa (Full Bio Approved): You can now fully interact by using SMS Chat and sending flowers.',
      'John (Full Bio Denied): Because access was declined, chat and flower options are unavailable.',
      'M000239110 (Brief Bio Approved, Full Bio Denied): Chatting and sending flowers require Full Bio approval, so these options remain locked.'
    ],
    sections: [
      {
        heading: 'Try it out',
        items: [
          'The guided tour has automatically clicked on LISA\'S "SMS Chat" button, and so opened a chat with Lisa. You can type a message at the bottom, add emojis or photos using the icons above the input bar, and press SEND!'
        ]
      }
    ],
    showPrev: true,
    showNext: true,
    showEnd: true,
    nextLabel: 'NEXT',
    prevLabel: 'PREV',
    endLabel: 'End Tour',
    wideRightPopup: true
  }
};
