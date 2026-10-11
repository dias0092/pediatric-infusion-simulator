import type { Scenario } from '../engine/types';
import { RATE_UNITS, SOURCES } from './common';

export const s5Glucose: Scenario = {
  id: 's5-glucose',
  number: 5,
  title: { ru: 'Гипогликемия: глюкоза 20%', kk: 'Гипогликемия: глюкоза 20%' },
  reviewStatus: 'draft',
  patient: {
    code: '№005',
    age: { ru: '5 месяцев', kk: '5 ай' },
    weightKg: 6,
    condition: {
      ru: 'ОРИТ, стойкая гипогликемия, ограничение жидкости.',
      kk: 'Реанимация бөлімі, тұрақты гипогликемия, сұйықтық шектелген.',
    },
    accesses: ['picc', 'piv'],
  },
  order: {
    ru: 'Глюкоза 20% со скоростью введения глюкозы (GIR) 6 мг/кг/мин, на 4 часа.',
    kk: 'Глюкоза 20%, глюкоза енгізу жылдамдығы (GIR) 6 мг/кг/мин, 4 сағатқа.',
  },
  prescription: { kind: 'gir', mgPerKgMin: 6, concentrationMgPerMl: 200, durationMin: 240 },
  drugOptions: [
    {
      id: 'glucose-20',
      name: { ru: 'Глюкоза 20%', kk: 'Глюкоза 20%' },
      pumpLabel: 'GLUCOSE 20%',
      softMinRate: 2,
      softMaxRate: 20,
    },
    {
      id: 'glucose-10',
      name: { ru: 'Глюкоза 10%', kk: 'Глюкоза 10%' },
      pumpLabel: 'GLUCOSE 10%',
      softMinRate: 2,
      softMaxRate: 40,
    },
    {
      id: 'glucose-40',
      name: { ru: 'Глюкоза 40%', kk: 'Глюкоза 40%' },
      pumpLabel: 'GLUCOSE 40%',
      softMinRate: 1,
      softMaxRate: 10,
      critical: true,
    },
  ],
  correctDrugId: 'glucose-20',
  acceptableRoutes: ['picc', 'cvc'],
  criticalRoutes: ['piv'],
  calcSteps: [
    {
      id: 'rate',
      quantity: 'rateMlH',
      prompt: { ru: 'Рассчитайте скорость по GIR.', kk: 'GIR бойынша жылдамдықты есептеңіз.' },
      hint: {
        ru: 'Скорость (мл/ч) = GIR (мг/кг/мин) × масса (кг) × 60 ÷ концентрация (мг/мл). Глюкоза 20% = 200 мг/мл.',
        kk: 'Жылдамдық (мл/сағ) = GIR (мг/кг/мин) × салмақ (кг) × 60 ÷ концентрация (мг/мл). Глюкоза 20% = 200 мг/мл.',
      },
      unit: 'ml_h',
      unitOptions: RATE_UNITS,
    },
  ],
  alarm: null,
  sources: [SOURCES.aspen, SOURCES.gir],
};
