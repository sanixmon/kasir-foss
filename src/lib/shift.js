export function getShiftDate(ts) {
  const d = ts ? new Date(ts) : new Date();
  d.setHours(d.getHours() - 6);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function checkShiftExpiration(shiftDate, currentShiftDate) {
  return !!shiftDate && shiftDate !== currentShiftDate;
}

