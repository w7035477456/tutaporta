import PropTypes from 'prop-types';
import { useState } from 'react';
import Box from '@mui/material/Box';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import { MEMBER_RAFFLE_RELATED_SASH_SX } from 'config/memberRelationshipRibbon';

/**
 * Yellow "Related" diagonal sash (red text) across the top-left of a member photo when the logged-in
 * member shares a raffle event (current or past) with this person, or one referred the other
 * (raffle refer code, or the Refer Email / Post FB refer code).
 * Render inside the avatar's `position: relative` wrapper. Click → popup with details.
 * `belowOtherSash` shifts it down so it sits under an Approved / Requested sash on the same photo.
 */
export default function RaffleRelationshipBadge({ relationship, memberLabel = 'this member', belowOtherSash = false, sx }) {
  const [open, setOpen] = useState(false);
  const events = Array.isArray(relationship?.events) ? relationship.events : [];
  const isMyReferrer = relationship?.isMyReferrer === true;
  const isMyReferee = relationship?.isMyReferee === true;
  const isMyMemberReferrer = relationship?.isMyMemberReferrer === true;
  const isMyMemberReferee = relationship?.isMyMemberReferee === true;
  if (!events.length && !isMyReferrer && !isMyReferee && !isMyMemberReferrer && !isMyMemberReferee) return null;

  return (
    <>
      <Box
        component="button"
        type="button"
        data-clickable-zone="true"
        aria-label={`Raffle relationship with ${memberLabel}`}
        title="You have a relationship with this person"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        onDoubleClick={(event) => event.stopPropagation()}
        sx={{
          ...MEMBER_RAFFLE_RELATED_SASH_SX,
          ...(belowOtherSash ? { top: '32%' } : null),
          ...sx
        }}
      >
        Related
      </Box>
      <ColorTemplate7PopupLargeDark
        open={open}
        onClose={() => setOpen(false)}
        maxWidth={560}
        closeButtonAriaLabel="Close raffle relationship"
      >
        <ColorTemplate7PopupLargeDark.Title>You and {memberLabel}</ColorTemplate7PopupLargeDark.Title>
        <ColorTemplate7PopupLargeDark.Body spacing={1.5}>
          {events.length ? (
            <>
              <ColorTemplate7PopupLargeDark.BodyText>
                You both have a raffle ticket for:
              </ColorTemplate7PopupLargeDark.BodyText>
              <Box component="ul" sx={{ m: 0, pl: 3 }}>
                {events.map((ev) => (
                  <Box component="li" key={ev.eventId} sx={{ mb: 0.75 }}>
                    <Box component="span" sx={{ fontWeight: 700 }}>
                      {ev.title}
                    </Box>
                    {ev.hostName ? ` (hosted by ${ev.hostName})` : ''}
                    <Box component="span" sx={{ display: 'block' }}>
                      {ev.eventDate ? `Event date: ${ev.eventDate}` : 'Event date: to be announced'}
                    </Box>
                  </Box>
                ))}
              </Box>
            </>
          ) : null}
          {isMyReferrer ? (
            <ColorTemplate7PopupLargeDark.BodyText>
              {memberLabel} is your referrer (you signed up with their raffle refer code).
            </ColorTemplate7PopupLargeDark.BodyText>
          ) : null}
          {isMyReferee ? (
            <ColorTemplate7PopupLargeDark.BodyText>
              {memberLabel} is your referee (they signed up with your raffle refer code).
            </ColorTemplate7PopupLargeDark.BodyText>
          ) : null}
          {isMyMemberReferrer ? (
            <ColorTemplate7PopupLargeDark.BodyText>
              {memberLabel} is your referrer via Post FB / Refer Email (you signed up for your account with their refer code).
            </ColorTemplate7PopupLargeDark.BodyText>
          ) : null}
          {isMyMemberReferee ? (
            <ColorTemplate7PopupLargeDark.BodyText>
              {memberLabel} is your referee via Post FB / Refer Email (they signed up for an account with your refer code).
            </ColorTemplate7PopupLargeDark.BodyText>
          ) : null}
        </ColorTemplate7PopupLargeDark.Body>
      </ColorTemplate7PopupLargeDark>
    </>
  );
}

RaffleRelationshipBadge.propTypes = {
  relationship: PropTypes.shape({
    events: PropTypes.arrayOf(
      PropTypes.shape({
        eventId: PropTypes.number,
        title: PropTypes.string,
        hostName: PropTypes.string,
        eventDate: PropTypes.string
      })
    ),
    isMyReferrer: PropTypes.bool,
    isMyReferee: PropTypes.bool,
    isMyMemberReferrer: PropTypes.bool,
    isMyMemberReferee: PropTypes.bool
  }),
  memberLabel: PropTypes.string,
  belowOtherSash: PropTypes.bool,
  sx: PropTypes.object
};
