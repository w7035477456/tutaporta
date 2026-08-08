/**
 * Client-side rules matching viewvettedstatus (no DB triggers).
 * Counts fields whose verification status equals "Completed" (case-insensitive).
 */

export const U_REQUEST_OTHERS_BASIC_COMPLETED_MIN = 2;
export const U_REQUEST_OTHERS_DETAIL_COMPLETED_MIN = 3;

function isCompletedStatus(value) {
  if (value === true || value === 1) return true;
  const s = String(value ?? '').trim().toLowerCase();
  return s === 'completed' || s === 'vetted';
}

/**
 * @param {object} row - Row from `useGetRequestsSent()` (`profile_vetting` shape)
 * @returns {{ completedCount: number, vetted_basic_status: boolean }}
 */
export function update_vetted_basic_count(row) {
  const v = row?.profile_vetting ?? {};
  const statuses = [v.name?.status, v.photo?.status, v.age?.status, v.currentCity?.status];
  const completedCount = statuses.filter(isCompletedStatus).length;
  return {
    completedCount,
    vetted_basic_status: completedCount >= U_REQUEST_OTHERS_BASIC_COMPLETED_MIN
  };
}

/**
 * Six fields per spec: education, career, children, home city, religion, hobbies (not country of birth).
 * @param {object} row
 * @returns {{ completedCount: number, vetted_detail_status: boolean }}
 */
export function update_vetted_detail_count(row) {
  const v = row?.profile_vetting ?? {};
  const statuses = [
    v.education?.status,
    v.career?.status,
    v.children?.status,
    v.homeCity?.status,
    v.religion?.status,
    v.hobbies?.status
  ];
  const completedCount = statuses.filter(isCompletedStatus).length;
  return {
    completedCount,
    vetted_detail_status: completedCount >= U_REQUEST_OTHERS_DETAIL_COMPLETED_MIN
  };
}
