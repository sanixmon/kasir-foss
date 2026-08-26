export const SHIFT_ROLLOVER_HOUR = 6;

export function getShiftDate(ts, rolloverHour = SHIFT_ROLLOVER_HOUR) {
  const d = ts ? new Date(ts) : new Date();
  d.setHours(d.getHours() - rolloverHour);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function checkShiftExpiration(shiftDate, currentShiftDate) {
  return !!shiftDate && shiftDate !== currentShiftDate;
}

