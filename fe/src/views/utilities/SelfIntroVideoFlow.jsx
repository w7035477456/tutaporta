import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import SelfIntroVideoCta from './SelfIntroVideoCta';
import SelfIntroVideoInstructionPopup from './SelfIntroVideoInstructionPopup';
import SelfIntroVideoFavoritesPopup from './SelfIntroVideoFavoritesPopup';
import SelfIntroVideoPhrasePickerPopup from './SelfIntroVideoPhrasePickerPopup';
import SelfIntroVideoRecordPopup from './SelfIntroVideoRecordPopup';
import SelfIntroVideoSlotsFullPopup from './SelfIntroVideoSlotsFullPopup';
import { fetchSelfIntroVideoSlots } from 'api/selfIntroVideoFe';
import { allSelfIntroVideoSlotsFull } from 'utils/selfIntroVideoSlotHelpers';
import api from 'api/axios';

function miscBioRowsToMap(miscBioInitialValues) {
  const map = {};
  if (Array.isArray(miscBioInitialValues)) {
    miscBioInitialValues.forEach((row) => {
      if (row?.key) map[row.key] = row.response ?? '';
    });
  } else if (miscBioInitialValues && typeof miscBioInitialValues === 'object') {
    Object.assign(map, miscBioInitialValues);
  }
  return map;
}

/**
 * Self intro video: CTA → instructions → favorites → phrase picker → record.
 * Maintains three video slots on singles (video1_fk … video3_fk).
 */
const SelfIntroVideoFlow = forwardRef(function SelfIntroVideoFlow(
  { miscBioInitialValues, onGenerated, onVideoSaved, prefetchMiscBio = true, hideCta = false },
  ref
) {
  const [instructionOpen, setInstructionOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [phrasePickerOpen, setPhrasePickerOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [slotsFullOpen, setSlotsFullOpen] = useState(false);
  const [generatedPhrases, setGeneratedPhrases] = useState([]);
  const [selectedPhrase, setSelectedPhrase] = useState(null);
  const [fetchedMiscBio, setFetchedMiscBio] = useState(null);

  const refreshSlots = useCallback(async () => {
    try {
      return await fetchSelfIntroVideoSlots();
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    if (!favoritesOpen || !prefetchMiscBio) return undefined;
    let cancelled = false;
    void api
      .get('/api/checkr/bio-review')
      .then(({ data }) => {
        if (cancelled) return;
        const map = miscBioRowsToMap(data?.miscBio);
        const currentCity = (data?.briefBio || []).find((row) => row?.key === 'current_city')?.response;
        if (currentCity) map.city_state = currentCity;
        setFetchedMiscBio(map);
      })
      .catch(() => {
        if (!cancelled) setFetchedMiscBio({});
      });
    return () => {
      cancelled = true;
    };
  }, [favoritesOpen, prefetchMiscBio]);

  const initialValues = useMemo(() => {
    const fromProp = miscBioRowsToMap(miscBioInitialValues);
    return { ...(fetchedMiscBio || {}), ...fromProp };
  }, [miscBioInitialValues, fetchedMiscBio]);

  const handleCtaClick = useCallback(async () => {
    const current = await refreshSlots();
    if (allSelfIntroVideoSlotsFull(current)) {
      setSlotsFullOpen(true);
      return;
    }
    setInstructionOpen(true);
  }, [refreshSlots]);

  useImperativeHandle(ref, () => ({ startFlow: () => void handleCtaClick() }), [handleCtaClick]);

  const handleInstructionClose = useCallback(() => {
    setInstructionOpen(false);
  }, []);

  const handleInstructionReady = useCallback(() => {
    setInstructionOpen(false);
    setFavoritesOpen(true);
  }, []);

  const handleFavoritesClose = useCallback(() => {
    setFavoritesOpen(false);
  }, []);

  const handleGenerated = useCallback(
    ({ phrases }) => {
      setFavoritesOpen(false);
      setGeneratedPhrases(Array.isArray(phrases) ? phrases : []);
      setPhrasePickerOpen(true);
      onGenerated?.({ phrases });
    },
    [onGenerated]
  );

  const handlePhrasePickerClose = useCallback(() => {
    setPhrasePickerOpen(false);
  }, []);

  const handleMakeVideo = useCallback((phrase) => {
    setSelectedPhrase(phrase);
    setPhrasePickerOpen(false);
    setRecordOpen(true);
  }, []);

  const handleRecordClose = useCallback(() => {
    setRecordOpen(false);
    setSelectedPhrase(null);
  }, []);

  const handleVideoSaved = useCallback(
    async (result) => {
      await refreshSlots();
      onVideoSaved?.(result);
    },
    [onVideoSaved, refreshSlots]
  );

  return (
    <>
      {!hideCta ? <SelfIntroVideoCta onClick={() => void handleCtaClick()} /> : null}
      <SelfIntroVideoInstructionPopup
        open={instructionOpen}
        onClose={handleInstructionClose}
        onReady={handleInstructionReady}
      />
      <SelfIntroVideoFavoritesPopup
        open={favoritesOpen}
        onClose={handleFavoritesClose}
        initialValues={initialValues}
        onGenerated={handleGenerated}
      />
      <SelfIntroVideoPhrasePickerPopup
        open={phrasePickerOpen}
        onClose={handlePhrasePickerClose}
        fallbackPhrases={generatedPhrases}
        onMakeVideo={handleMakeVideo}
      />
      <SelfIntroVideoRecordPopup
        open={recordOpen}
        onClose={handleRecordClose}
        scriptText={selectedPhrase?.filledText ?? ''}
        highlightTerms={selectedPhrase?.highlightTerms ?? []}
        onSaved={(result) => void handleVideoSaved(result)}
      />
      <SelfIntroVideoSlotsFullPopup open={slotsFullOpen} onClose={() => setSlotsFullOpen(false)} />
    </>
  );
});

export default SelfIntroVideoFlow;

SelfIntroVideoFlow.propTypes = {
  miscBioInitialValues: PropTypes.oneOfType([PropTypes.array, PropTypes.object]),
  onGenerated: PropTypes.func,
  onVideoSaved: PropTypes.func,
  prefetchMiscBio: PropTypes.bool,
  hideCta: PropTypes.bool
};
