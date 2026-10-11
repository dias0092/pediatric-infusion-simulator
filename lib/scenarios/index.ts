import type { Scenario } from '../engine/types';
import { s1Paracetamol } from './s1-paracetamol';
import { s2Ceftriaxone } from './s2-ceftriaxone';
import { s3SalineBolus } from './s3-saline-bolus';
import { s4Maintenance } from './s4-maintenance';
import { s5Glucose } from './s5-glucose';

export const scenarios: Scenario[] = [s1Paracetamol, s2Ceftriaxone, s3SalineBolus, s4Maintenance, s5Glucose];

export function getScenario(id: string): Scenario | undefined {
  return scenarios.find((s) => s.id === id);
}
