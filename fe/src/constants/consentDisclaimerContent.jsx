import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import PropTypes from 'prop-types';
import { colorTemplate2PopupLinkSx } from 'config/colorTemplate2Popup';

function ThirdPartyLink() {
  return (
    <Link href="https://checkr.com/" target="_blank" rel="noopener noreferrer" underline="always" sx={colorTemplate2PopupLinkSx()}>
      3rd-Party
    </Link>
  );
}

const CONSENT_CHECKBOX_LABEL =
  'I have reviewed the volunteered data points above. I certify that I am the owner of this data, and I explicitly authorize and direct Vetted Singles of OnlineMall.Website to evaluate and display my profile verification match status to the specific user I selected.';

export function getConsentCheckboxLabel() {
  return CONSENT_CHECKBOX_LABEL;
}

export function ConsentDisclaimerBody({ approvedViewingDurationMonths = 12 }) {
  const viewingMonths = Number.isFinite(Number(approvedViewingDurationMonths))
    ? Number(approvedViewingDurationMonths)
    : 12;

  return (
    <>
      <Typography variant="body1" paragraph>
        Your bio remains hidden until you grant access. By checking the box below and clicking &quot;Submit Consent&quot;, you explicitly
        authorize Vetted Singles of OnlineMall.Website to cross-reference your volunteered biographical information with data retrieved
        securely via our third-party verification partner (<ThirdPartyLink />
        ), according to our privacy standards. By doing so, you also authorize your designated peer(s) to view this information.
      </Typography>
      <Typography variant="body1" paragraph sx={{ fontWeight: 700 }}>
        FCRA &amp; Privacy Disclosure: To strictly comply with the Fair Credit Reporting Act (FCRA) and data privacy regulations, this
        website NEVER shares raw data, consumer reports, background checks, or consumer data to any third party or peer. This website only
        functions as a binary matching interface that displays only a &quot;Matches&quot; or &quot;Does Not Match&quot; tag based on
        volunteered profile attributes. The raw data provided by our verification partner remains secure and unexposed.
      </Typography>
      <Typography variant="body1" paragraph sx={{ fontWeight: 700 }}>
        Bio Data Privacy &amp; Peer Access Duration: We do not sell your biographical information to any third party. Only the specific
        designated peer you explicitly authorize here will be permitted to view your bio, for a minimum duration of {viewingMonths} months.
        Upon authorization, a snapshot of your signature and your released biographical information will be made available to your designated
        peer. This peer will also be able to view any updates you add to your bio throughout the {viewingMonths}-month period. After{' '}
        {viewingMonths} months, a button will be displayed allowing you to disable the designated peer&apos;s access to your bio and updates.
        Furthermore, if you decide to block a designated peer at any time, their access to your bio will be revoked immediately until you
        choose to unblock them.
      </Typography>
      <Typography variant="body1" paragraph>
        Upon successful cross-referencing, you authorize your specific designated peer to exclusively view the resulting verification match
        statuses (e.g., &quot;Info Matches&quot; / &quot;Verification Not Completed&quot;).
      </Typography>
      <Typography variant="body1" paragraph sx={{ fontWeight: 700 }}>
        Legal Acknowledgments &amp; Waiver of Liability:
      </Typography>
      <Typography variant="body1" paragraph>
        User-Directed Match Disclosure: You acknowledge that Vetted Singles of OnlineMall.Website acts strictly as a technical intermediary
        verifying self-reported profiles at your explicit request for personal social networking trust and safety purposes.
      </Typography>
      <Typography variant="body1" paragraph>
        Non-Consumer / Non-Commercial Scope: You and the viewing peer user explicitly agree that this verification status is not being
        requested, provided, or utilized for any &quot;permissible purpose&quot; governed by the Fair Credit Reporting Act (FCRA). It shall
        not be used for employment screening, tenant evaluation, credit underwriting, or any commercial eligibility assessment.
      </Typography>
      <Typography variant="body1" paragraph>
        Full Release of Liability: You hereby release, indemnify, and hold harmless Vetted Singles of OnlineMall.Website, its corporate
        owners, and its technical infrastructure from any and all liability, claims, or damages (including but not limited to defamation,
        data transmission lag, error states, or emotional distress) resulting from data mismatches or how the receiving specific user acts
        upon seeing a &quot;Matches&quot; or &quot;Does Not Match&quot; tag.
      </Typography>
      <Typography variant="body1" paragraph>
        Right to Revoke: You retain the absolute right to revoke a peer&apos;s access to view your verification match status at any time via
        your platform dashboard. You acknowledge that our platform cannot retract or eliminate inferences, notes, or screenshots taken by the
        peer user while access was active.
      </Typography>
    </>
  );
}

ConsentDisclaimerBody.propTypes = {
  approvedViewingDurationMonths: PropTypes.number
};
