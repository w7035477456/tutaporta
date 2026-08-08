import {
  fetchMeasureOneEducationStatus,
  startMeasureOneEducationVerification
} from 'api/measureoneFe';
import { getMeasureOneQuickstartUrl } from 'config/measureoneEnv';
import { runMeasureOneMockVerification } from 'utils/runMeasureOneMockVerification';

function buildMeasureOneLaunchUrl(widget) {
  const params = new URLSearchParams({
    access_key: widget.accessKey,
    host_name: widget.hostName,
    datarequest_id: widget.datarequestId,
    script_url: widget.scriptUrl
  });

  const quickstartUrl = getMeasureOneQuickstartUrl();
  if (quickstartUrl) {
    return `${quickstartUrl}?${params.toString()}`;
  }

  return `/measureone/education?${params.toString()}`;
}

/**
 * Starts a MeasureOne education session and opens the widget (in-app launch page or external quickstart URL).
 * @returns {Promise<{ launchUrl: string, datarequestId: string }>}
 */
export async function launchMeasureOneEducation({ target = '_blank', preferMock = false } = {}) {
  const status = await fetchMeasureOneEducationStatus();
  if (!status?.configured) {
    throw new Error(
      'MeasureOne is not configured yet. Add MEASUREONE_CLIENT_ID and MEASUREONE_CLIENT_SECRET to ~/.ssh/be/.env (see MeasureOne Quickstart Setup).'
    );
  }

  if (status.mockEnabled || preferMock) {
    const data = await runMeasureOneMockVerification();
    return { mock: true, data };
  }

  const startData = await startMeasureOneEducationVerification();
  const widget = startData?.widget;
  if (!widget?.accessKey || !widget?.datarequestId) {
    throw new Error('MeasureOne did not return widget credentials.');
  }

  const launchUrl = buildMeasureOneLaunchUrl(widget);
  if (target === '_self') {
    window.location.assign(launchUrl);
  } else {
    window.open(launchUrl, '_blank', 'noopener,noreferrer');
  }

  return { launchUrl, datarequestId: startData.datarequestId };
}
