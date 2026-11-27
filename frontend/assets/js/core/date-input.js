function validDateParts(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() + 1 === month
    && date.getUTCDate() === day;
}

export function isoDateFromDisplay(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value).trim());
  if (!match) return '';
  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText), month = Number(monthText), year = Number(yearText);
  if (!validDateParts(year, month, day)) return '';
  return `${yearText}-${monthText}-${dayText}`;
}

export function displayDateFromIso(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (!match) return '';
  const [, yearText, monthText, dayText] = match;
  if (!validDateParts(Number(yearText), Number(monthText), Number(dayText))) return '';
  return `${dayText}/${monthText}/${yearText}`;
}

export function formatDateInput(event) {
  const input = event.currentTarget;
  const oldValue = input.value;
  const oldCaret = input.selectionStart ?? oldValue.length;
  const digitsBeforeCaret = oldValue.slice(0, oldCaret).replace(/\D/g, '').length;
  const digits = oldValue.replace(/\D/g, '').slice(0, 8);
  let value = digits;
  if (digits.length > 2) value = `${digits.slice(0, 2)}/${digits.slice(2)}`;
  if (digits.length > 4) value = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  input.value = value;

  let caret = 0;
  let counted = 0;
  while (caret < value.length && counted < digitsBeforeCaret) {
    if (/\d/.test(value[caret])) counted += 1;
    caret += 1;
  }
  if (value[caret] === '/' && (digitsBeforeCaret === 2 || digitsBeforeCaret === 4)) caret += 1;
  input.setSelectionRange(caret, caret);
}
