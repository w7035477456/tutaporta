import sampleDriverLicenseUrl from 'assets/images/sampleDriverLicense.jpg';
import sampleUSPassportUrl from 'assets/images/sampleUSPassport.jpg';
import { normalizeVerificationImageFromUrl } from 'utils/normalizeVerificationImage';

export { sampleDriverLicenseUrl, sampleUSPassportUrl };

/** Default gov ID slot previews (1000px max width) until the member uploads their own. */
export async function loadIdVerificationSamplePreviews() {
  const [driverLicense, passport] = await Promise.all([
    normalizeVerificationImageFromUrl(sampleDriverLicenseUrl),
    normalizeVerificationImageFromUrl(sampleUSPassportUrl)
  ]);
  return { driverLicense, passport };
}
