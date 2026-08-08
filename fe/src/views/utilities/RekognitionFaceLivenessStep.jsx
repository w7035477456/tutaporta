import { useEffect, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { isBenignLivenessWidgetError, parseLivenessDetectorError } from 'utils/livenessErrorMessage';
import { isValidRekognitionIdentityPoolId } from 'utils/rekognitionIdentityPoolId';

import '@aws-amplify/ui-react/styles.css';
import '@aws-amplify/ui-react-liveness/styles.css';
import '../../styles/rekognitionLivenessLayout.css';

/**
 * AWS Face Liveness UI (requires @aws-amplify/ui-react-liveness + Cognito Identity Pool).
 */
export default function RekognitionFaceLivenessStep({
  sessionId,
  region,
  identityPoolId,
  onComplete,
  onError,
  livenessAlreadyPassed = false,
  showInlineErrors = true
}) {
  const [Detector, setDetector] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [detectorError, setDetectorError] = useState('');
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  const livenessPassedRef = useRef(livenessAlreadyPassed);

  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;
  livenessPassedRef.current = livenessAlreadyPassed;

  useEffect(() => {
    let cancelled = false;
    setLoadError('');
    setDetector(null);

    (async () => {
      try {
        if (!isValidRekognitionIdentityPoolId(identityPoolId)) {
          throw new Error(
            'Invalid identity pool id for face liveness. Use REKOGNITION_COGNITO_IDENTITY_POOL_ID in ~/.ssh/be/.env (not a placeholder like your-pool-id).'
          );
        }
        const [{ FaceLivenessDetector }, { Amplify }] = await Promise.all([
          import('@aws-amplify/ui-react-liveness'),
          import('aws-amplify')
        ]);
        Amplify.configure({
          Auth: {
            Cognito: {
              identityPoolId,
              allowGuestAccess: true
            }
          }
        });
        if (!cancelled) {
          setDetector(() => FaceLivenessDetector);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err?.message || 'Face liveness UI failed to load';
          setLoadError(message);
          onErrorRef.current?.(message);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [identityPoolId]);

  useEffect(() => {
    setDetectorError('');
  }, [sessionId]);

  if (loadError) {
    return (
      <Alert severity="warning">
        Face liveness could not load. Please refresh and try again, or contact support if this continues.
      </Alert>
    );
  }

  if (!Detector) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  const displayInlineError = showInlineErrors && detectorError && !onErrorRef.current;

  return (
    <Box className="rekognition-liveness-root" sx={{ width: '100%', mx: 'auto' }}>
      <Typography variant="body2" sx={{ mb: 1, textAlign: 'center' }}>
        Center your face in the oval on the camera view, then follow the color prompts. Move forward into the oval when
        asked, then hold still.
      </Typography>
      {displayInlineError ? (
        <Alert severity="warning" sx={{ mb: 1 }}>
          {detectorError}
        </Alert>
      ) : null}
      <Detector
        sessionId={sessionId}
        region={region}
        onAnalysisComplete={() => {
          setDetectorError('');
          onCompleteRef.current?.();
        }}
        onError={(event) => {
          if (import.meta.env.DEV) {
            console.warn('[rekognition-liveness] widget onError', event);
          }
          const msg = parseLivenessDetectorError(event);
          if (isBenignLivenessWidgetError(msg, livenessPassedRef.current)) {
            return;
          }
          if (onErrorRef.current) {
            onErrorRef.current(msg, event);
            return;
          }
          setDetectorError(msg);
        }}
      />
    </Box>
  );
}
