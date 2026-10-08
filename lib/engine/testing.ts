import { FIELD_DIGITS, toDigits } from './pump';
import type { PumpButton } from './types';

/** Button presses that turn an all-zero draft (cursor on the first digit) into `tenths`. */
export function digitPresses(tenths: number, count: number): PumpButton[] {
  const presses: PumpButton[] = [];
  toDigits(tenths, count).forEach((digit, index) => {
    if (index > 0) presses.push('RIGHT');
    for (let k = 0; k < digit; k++) presses.push('PLUS');
  });
  return presses;
}

/** From a switched-off pump: power on, enter RATE, switch to VTBI, enter VTBI. */
export function programPump(rateTenths: number, vtbiTenths: number): PumpButton[] {
  return [
    'POWER',
    'ENTER', ...digitPresses(rateTenths, FIELD_DIGITS.rate), 'ENTER',
    'MENU',
    'ENTER', ...digitPresses(vtbiTenths, FIELD_DIGITS.vtbi), 'ENTER',
  ];
}
