import type { CalcStep, L10n, UnitId } from '../engine/types';

export const DOSE_UNITS: UnitId[] = ['mg', 'g', 'mg_kg', 'ml'];
export const VOLUME_UNITS: UnitId[] = ['ml', 'mg', 'ml_h', 'mg_ml'];
export const RATE_UNITS: UnitId[] = ['ml_h', 'ml', 'mg_kg', 'ml_kg'];

export const SOURCES = {
  bnfc: 'BNF for Children (BNFC), актуальное издание',
  paracetamol: 'Инструкция по медицинскому применению: парацетамол, раствор для инфузий 10 мг/мл',
  ceftriaxone: 'Инструкция по медицинскому применению: цефтриаксон, порошок для приготовления раствора',
  whoPocketBook: 'WHO. Pocket Book of Hospital Care for Children, 2nd ed., 2013 — Plan C',
  hollidaySegar:
    'Holliday M.A., Segar W.E. The maintenance need for water in parenteral fluid therapy. Pediatrics, 1957',
  nice29: 'NICE NG29. Intravenous fluid therapy in children and young people in hospital',
  aspen: 'ASPEN: предел осмолярности растворов для периферического введения; глюкоза > 12,5 % — только центрально',
  gir: 'GIR (мг/кг/мин) = концентрация глюкозы (%) × скорость (мл/ч) ÷ (6 × масса (кг))',
};

export const doseStep = (prompt: L10n): CalcStep => ({
  id: 'dose',
  quantity: 'doseMg',
  prompt,
  hint: {
    ru: 'Доза (мг) = доза на кг (мг/кг) × масса (кг)',
    kk: 'Доза (мг) = 1 кг-ға доза (мг/кг) × салмақ (кг)',
  },
  unit: 'mg',
  unitOptions: DOSE_UNITS,
});

export const volumeFromDoseStep = (): CalcStep => ({
  id: 'volume',
  quantity: 'volumeMl',
  prompt: {
    ru: 'Рассчитайте объём раствора для введения.',
    kk: 'Енгізілетін ерітінді көлемін есептеңіз.',
  },
  hint: {
    ru: 'Объём (мл) = доза (мг) ÷ концентрация (мг/мл)',
    kk: 'Көлем (мл) = доза (мг) ÷ концентрация (мг/мл)',
  },
  unit: 'ml',
  unitOptions: VOLUME_UNITS,
});
