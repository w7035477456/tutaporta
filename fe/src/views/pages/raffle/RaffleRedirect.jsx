import PropTypes from 'prop-types';
import { Navigate } from 'react-router-dom';
import { markGetMyRafflePending } from 'constants/raffleRoute';

/**
 * /raffleMustafa → /mall. /getmyraffle → /mall and auto-open the Get My Raffle popup
 * (login / signup happens on the way via ProtectedRoute).
 */
export default function RaffleRedirect({ openPopup = false }) {
  if (openPopup) markGetMyRafflePending();
  return <Navigate to="/mall" replace />;
}

RaffleRedirect.propTypes = {
  openPopup: PropTypes.bool
};
