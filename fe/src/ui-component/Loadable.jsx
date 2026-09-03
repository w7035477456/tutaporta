import { lazy as reactLazy, Suspense } from 'react';

// project imports
import Loader from './Loader';
import { clearStaleModuleReloadGuard, importWithStaleChunkRetry } from 'utils/hardReloadOnStaleModule';

/** Same as React.lazy, but retries + cache-busts once on stale Vite chunks. */
export function lazy(importer) {
  return reactLazy(() =>
    importWithStaleChunkRetry(importer).then((mod) => {
      clearStaleModuleReloadGuard();
      return mod;
    })
  );
}

export default function Loadable(Component) {
  if (!Component) {
    throw new Error('Loadable: Component is required');
  }

  const WrappedComponent = (props) => (
    <Suspense fallback={<Loader />}>
      <Component {...props} />
    </Suspense>
  );

  // Set display name for better debugging
  WrappedComponent.displayName = `Loadable(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent;
}
