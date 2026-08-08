import { useMemo } from 'react';
import {
  getManualRefreshHintContainerSx,
  getManualRefreshHintLineSx
} from 'config/manualRefreshButtonEnv';

export default function useManualRefreshHintSx() {
  return useMemo(
    () => ({
      containerSx: getManualRefreshHintContainerSx(),
      lineSx: getManualRefreshHintLineSx()
    }),
    []
  );
}
