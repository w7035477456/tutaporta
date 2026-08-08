/**
 * All Singles + Interested:
 * - md+: three equal columns (~⅓ of main content width, i.e. viewport minus sidebar).
 * - xs/sm: one column; outer wrapper (SINGLES_GRID_OUTER_SX) full-bleeds to 100vw on phones.
 */
export const SINGLES_GRID_OUTER_SX = {
  width: { xs: '100vw', sm: '100%' },
  position: { xs: 'relative', sm: 'static' },
  left: { xs: '50%', sm: 'auto' },
  transform: { xs: 'translateX(-50%)', sm: 'none' },
  flexShrink: 0,
  minHeight: 0
};

export const SINGLES_MEMBER_GRID_SX = {
  display: 'grid',
  gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' },
  gap: { xs: 1.5, sm: 1.5, md: 2 },
  height: { xs: 'auto', sm: '100%' },
  minHeight: 0,
  gridAutoRows: 'auto',
  width: '100%'
};
