import PropTypes from 'prop-types';

/** Page title row (Earn Tokens lives in PageInstructionEarnTokensAction under the instruction link). */
export default function EarnTokensPageTitle({ children }) {
  return children;
}

EarnTokensPageTitle.propTypes = {
  children: PropTypes.node.isRequired
};
