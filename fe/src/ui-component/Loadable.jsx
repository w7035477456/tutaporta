import { lazy as reactLazy, Suspense } from 'react';

// project imports
import Loader from './Loader';
import { tryHardReloadOnFailedDynamicImport } from 'utils/hardReloadOnStaleModule';

/** Same as React.lazy, but Shift-Cmd-R-equivalent reload once on stale Vite chunks. */
export function lazy(importer) {
  return reactLazy(() =>
    Promise.resolve()
      .then(importer)
      .catch((error) => {
        if (tryHardReloadOnFailedDynamicImport(error)) {
          return new Promise(() => {});
        }
        throw error;
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
