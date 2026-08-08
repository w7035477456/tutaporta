import { Suspense } from 'react';

// project imports
import Loader from './Loader';

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
