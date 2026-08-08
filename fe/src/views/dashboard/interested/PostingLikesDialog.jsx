import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import { formatAliasWithMemberCode } from 'utils/memberLabel';

export default function PostingLikesDialog({ open, loading, error, likesList, onClose }) {
  return (
    <ColorTemplate7PopupLargeDark
      open={open}
      onClose={onClose}
      closeButtonAriaLabel="Close likes popup"
      showCloseButton
      closeOnBackdrop
    >
      <ColorTemplate7PopupLargeDark.Body spacing={1.25}>
        <ColorTemplate7PopupLargeDark.Title>Liked by</ColorTemplate7PopupLargeDark.Title>

        {loading ? <ColorTemplate7PopupLargeDark.BodyText>Loading…</ColorTemplate7PopupLargeDark.BodyText> : null}
        {error ? <ColorTemplate7PopupLargeDark.ErrorBar>{error}</ColorTemplate7PopupLargeDark.ErrorBar> : null}

        {!loading && !error && likesList.length
          ? likesList.map((likeEntry) => (
              <ColorTemplate7PopupLargeDark.BodyText key={likeEntry.author_id}>
                {formatAliasWithMemberCode({
                  alias: likeEntry.alias,
                  memberCode: likeEntry.member_number
                })}
              </ColorTemplate7PopupLargeDark.BodyText>
            ))
          : null}

        {!loading && !error && !likesList.length ? (
          <ColorTemplate7PopupLargeDark.BodyText>No likes yet.</ColorTemplate7PopupLargeDark.BodyText>
        ) : null}
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}
