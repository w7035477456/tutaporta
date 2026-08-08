import PropTypes from 'prop-types';

import PageInstructionPopup from 'ui-component/PageInstructionPopup';
import PageInstructionAudioTutorial from 'ui-component/PageInstructionAudioTutorial';
import audioMyAlbumSora from 'assets/sound/my_album_postings_instruction_Sora.m4a';
import audioMyAlbumJessica from 'assets/sound/my_album_postings_instruction_Jessica.m4a';
import audioMyAlbumMichael from 'assets/sound/my_album_postings_instruction_Michael.m4a';
import {
  MY_ALBUM_POSTINGS_INSTRUCTION_CONTEXT_STEP,
  MY_ALBUM_POSTINGS_INSTRUCTION_CONTEXT_TITLE
} from 'constants/myAlbumPostingsInstructionText';

const MY_ALBUM_POSTINGS_INSTRUCTION_AUDIO_BY_VOICE = {
  Sora: typeof audioMyAlbumSora === 'string' ? audioMyAlbumSora : audioMyAlbumSora?.default || '',
  Jessica: typeof audioMyAlbumJessica === 'string' ? audioMyAlbumJessica : audioMyAlbumJessica?.default || '',
  Michael: typeof audioMyAlbumMichael === 'string' ? audioMyAlbumMichael : audioMyAlbumMichael?.default || ''
};

function InstructionSection({ title, children }) {
  return (
    <>
      {title ? <PageInstructionPopup.SectionLabel>{title}</PageInstructionPopup.SectionLabel> : null}
      {children}
    </>
  );
}

InstructionSection.propTypes = {
  title: PropTypes.string,
  children: PropTypes.node.isRequired
};

export function MyAlbumPostingsInstructionBody() {
  return (
    <>
      <PageInstructionPopup.BodyText>
        👋 Welcome to Your Album &amp; Postings! This is the heart of your profile—the perfect spot to share your favorite photos and stories
        so others can truly get to know the wonderful you!
      </PageInstructionPopup.BodyText>

      <InstructionSection title="✨ Designing Your Photo Albums">
        <PageInstructionPopup.BodyText>
          At the very top, you can easily upload your photos, choose a profile picture, and crop, zoom, or pan each image until it looks just
          right. You have complete control over who sees your memories:
        </PageInstructionPopup.BodyText>
        <PageInstructionPopup.BodyText component="ul">
          <li>
            <strong>Public Album:</strong> Open for everyone to enjoy!
          </li>
          <li>
            <strong>Friends-Only Album:</strong> Exclusively visible to your friends. (Remember, friends are those who have approved your
            request to view their Full Bio!)
          </li>
        </PageInstructionPopup.BodyText>
      </InstructionSection>

      <InstructionSection title="💡 Need more space?">
        <PageInstructionPopup.BodyText>
          By default, each album holds up to 10 photos. But if you have more of your beautiful world to share, we&apos;d love to help! Just tap
          the Bell Icon and send us a quick message to request an increase.
        </PageInstructionPopup.BodyText>
      </InstructionSection>

      <InstructionSection title="📝 Sharing Your Stories (Postings)">
        <PageInstructionPopup.BodyText>
          Right below your albums is your personal posting section. Feel free to create as many posts as your heart desires! It works just like
          your favorite social media feeds, and sharing is as easy as pie:
        </PageInstructionPopup.BodyText>
        <PageInstructionPopup.BodyText component="ul">
          <li>
            <strong>Create Your Post:</strong> Simply drag and drop one or more photos into the space inside the red dotted box, and type up
            your caption or comment right below it!
          </li>
          <li>
            <strong>Choose Your Audience:</strong> Before you click save, don&apos;t forget to set your post&apos;s visibility to Public,
            Buddies, or MySelf.
          </li>
          <li>
            <strong>Change Your Mind?</strong> No worries at all! If you ever want to delete a post—whether it&apos;s brand new or from your
            past history—just click the red &ldquo;X&rdquo; in the top-right corner.
          </li>
        </PageInstructionPopup.BodyText>
      </InstructionSection>

      <InstructionSection title="💬 Connect, Interact &amp; Customize">
        <PageInstructionPopup.BodyText component="ul">
          <li>
            <strong>Spread the Love:</strong> Once you save a post, it will appear for others under the Pick and Post menu. Friends and
            visitors can leave sweet comments or give your posts a &ldquo;Like&rdquo;—and you can do the exact same for them!
          </li>
          <li>
            <strong>Total Control:</strong> You can update your past photos and captions whenever you like. You also have the power to delete
            comments left by others, edit your own past comments, or change a post&apos;s visibility at any time (choose between Public,
            Buddies, or MySelf).
          </li>
        </PageInstructionPopup.BodyText>
      </InstructionSection>

      <InstructionSection title="🔍 Quick Tip:">
        <PageInstructionPopup.BodyText>
          To keep things loading fast and looking tidy, we show your 10 most recent posts by default. To stroll further down memory lane,
          simply click the Next 2/5/10 posting buttons to see more!
        </PageInstructionPopup.BodyText>
      </InstructionSection>
    </>
  );
}

export function MyAlbumPostingsInstructionPopup({ open, onClose }) {
  return (
    <PageInstructionPopup open={open} onClose={onClose} closeOnBackdrop bodyTextAlignLeft centeredLeadLines={1}>
      <PageInstructionPopup.Body>
        <PageInstructionAudioTutorial
          active={open}
          audioByVoice={MY_ALBUM_POSTINGS_INSTRUCTION_AUDIO_BY_VOICE}
          title={MY_ALBUM_POSTINGS_INSTRUCTION_CONTEXT_TITLE}
          contextStep={MY_ALBUM_POSTINGS_INSTRUCTION_CONTEXT_STEP}
        />
        <MyAlbumPostingsInstructionBody />
      </PageInstructionPopup.Body>
    </PageInstructionPopup>
  );
}

MyAlbumPostingsInstructionPopup.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
};
