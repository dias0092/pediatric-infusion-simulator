import type { Scenario } from '../engine/types';
import { SOURCES, doseStep, volumeFromDoseStep } from './common';

export const s1Paracetamol: Scenario = {
  id: 's1-paracetamol',
  number: 1,
  title: { ru: 'Лихорадка: парацетамол в/в', kk: 'Қызба: парацетамол вена ішіне' },
  reviewStatus: 'draft',
  patient: {
    code: '№001',
    age: { ru: '3 года', kk: '3 жас' },
    weightKg: 14,
    condition: {
      ru: 'Лихорадка 39,2 °C, рвота, не может принимать лекарства внутрь.',
      kk: 'Қызба 39,2 °C, құсу, дәріні ішке қабылдай алмайды.',
    },
    accesses: ['piv'],
  },
  order: {
    ru: 'Парацетамол 15 мг/кг в/в, инфузия за 15 минут. Раствор 10 мг/мл.',
    kk: 'Парацетамол 15 мг/кг вена ішіне, инфузия 15 минут ішінде. Ерітінді 10 мг/мл.',
  },
  prescription: { kind: 'dosePerKg', mgPerKg: 15, concentrationMgPerMl: 10, durationMin: 15 },
  drugOptions: [
    {
      id: 'paracetamol-10',
      name: { ru: 'Парацетамол 10 мг/мл', kk: 'Парацетамол 10 мг/мл' },
      pumpLabel: 'PARACETAMOL 10 mg/mL',
      softMinRate: 20,
      softMaxRate: 150,
    },
    {
      id: 'metamizole-500',
      name: { ru: 'Метамизол натрия 500 мг/мл', kk: 'Метамизол натрийі 500 мг/мл' },
      pumpLabel: 'METAMIZOLE 500 mg/mL',
      softMinRate: 1,
      softMaxRate: 20,
    },
    {
      id: 'ketorolac-30',
      name: { ru: 'Кеторолак 30 мг/мл', kk: 'Кеторолак 30 мг/мл' },
      pumpLabel: 'KETOROLAC 30 mg/mL',
      softMinRate: 1,
      softMaxRate: 30,
    },
  ],
  correctDrugId: 'paracetamol-10',
  acceptableRoutes: ['piv'],
  criticalRoutes: [],
  calcSteps: [
    doseStep({
      ru: 'Рассчитайте разовую дозу парацетамола.',
      kk: 'Парацетамолдың бір реттік дозасын есептеңіз.',
    }),
    volumeFromDoseStep(),
  ],
  alarm: null,
  sources: [SOURCES.paracetamol, SOURCES.bnfc],
};
