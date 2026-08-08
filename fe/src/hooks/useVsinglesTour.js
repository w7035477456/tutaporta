import { useEffect, useState } from 'react';

import {
  VSINGLES_TOUR_END_EVENT,
  VSINGLES_TOUR_START_EVENT,
  VSINGLES_TOUR_STEP_EVENT,
  getTourStep,
  isTourOpen
} from 'utils/vsinglesTour';

export default function useVsinglesTour() {
  const [state, setState] = useState(() => ({
    open: isTourOpen(),
    step: getTourStep()
  }));

  useEffect(() => {
    const sync = () => {
      setState({ open: isTourOpen(), step: getTourStep() });
    };
    window.addEventListener(VSINGLES_TOUR_START_EVENT, sync);
    window.addEventListener(VSINGLES_TOUR_STEP_EVENT, sync);
    window.addEventListener(VSINGLES_TOUR_END_EVENT, sync);
    return () => {
      window.removeEventListener(VSINGLES_TOUR_START_EVENT, sync);
      window.removeEventListener(VSINGLES_TOUR_STEP_EVENT, sync);
      window.removeEventListener(VSINGLES_TOUR_END_EVENT, sync);
    };
  }, []);

  return state;
}
