import type { Scenario } from '../engine/types';
import { SOURCES, doseStep, volumeFromDoseStep } from './common';

export const s2Ceftriaxone: Scenario = {
  id: 's2-ceftriaxone',
  number: 2,
  title: { ru: 'Пневмония: цефтриаксон', kk: 'Пневмония: цефтриаксон' },
  reviewStatus: 'draft',
  patient: {
    code: '№002',
    age: { ru: '8 месяцев', kk: '8 ай' },
    weightKg: 8,
    condition: {
      ru: 'Внебольничная пневмония, температура 38,5 °C.',
      kk: 'Ауруханадан тыс пневмония, температура 38,5 °C.',
    },
    accesses: ['piv'],
  },
  order: {
    ru: 'Цефтриаксон 50 мг/кг в/в капельно за 30 минут. Приготовленный раствор 10 мг/мл.',
    kk: 'Цефтриаксон 50 мг/кг вена ішіне тамшылатып, 30 минут ішінде. Дайындалған ерітінді 10 мг/мл.',
  },
  prescription: { kind: 'dosePerKg', mgPerKg: 50, concentrationMgPerMl: 10, durationMin: 30 },
  drugOptions: [
    {
      id: 'ceftriaxone-10',
      name: { ru: 'Цефтриаксон 10 мг/мл', kk: 'Цефтриаксон 10 мг/мл' },
      pumpLabel: 'CEFTRIAXONE 10 mg/mL',
      softMinRate: 20,
      softMaxRate: 150,
    },
    {
      id: 'cefazolin-10',
      name: { ru: 'Цефазолин 10 мг/мл', kk: 'Цефазолин 10 мг/мл' },
      pumpLabel: 'CEFAZOLIN 10 mg/mL',
      softMinRate: 20,
      softMaxRate: 150,
    },
    {
      id: 'cefuroxime-10',
      name: { ru: 'Цефуроксим 10 мг/мл', kk: 'Цефуроксим 10 мг/мл' },
      pumpLabel: 'CEFUROXIME 10 mg/mL',
      softMinRate: 20,
      softMaxRate: 150,
    },
  ],
  correctDrugId: 'ceftriaxone-10',
  acceptableRoutes: ['piv'],
  criticalRoutes: [],
  calcSteps: [
    doseStep({
      ru: 'Рассчитайте разовую дозу цефтриаксона.',
      kk: 'Цефтриаксонның бір реттік дозасын есептеңіз.',
    }),
    volumeFromDoseStep(),
  ],
  alarm: {
    type: 'occlusion',
    atProgress: 0.4,
    actions: [
      {
        id: 'check_line',
        label: {
          ru: 'Осмотреть линию от насоса до пациента: зажимы, перегибы, место катетера',
          kk: 'Сорғыдан науқасқа дейінгі желіні тексеру: қысқыштар, бүгілулер, катетер орны',
        },
        reveals: {
          ru: 'Причина найдена: роликовый зажим ниже насоса закрыт.',
          kk: 'Себебі табылды: сорғыдан төмен роликті қысқыш жабық.',
        },
      },
      { id: 'open_clamp', label: { ru: 'Открыть роликовый зажим', kk: 'Роликті қысқышты ашу' } },
      { id: 'flush_force', label: { ru: 'Промыть катетер с усилием', kk: 'Катетерді күшпен жуу' } },
      {
        id: 'increase_rate',
        label: {
          ru: 'Увеличить скорость, чтобы «продавить» линию',
          kk: 'Желіні «итеру» үшін жылдамдықты арттыру',
        },
      },
      { id: 'power_cycle', label: { ru: 'Выключить и включить насос', kk: 'Сорғыны өшіріп, қайта қосу' } },
    ],
    sequence: ['check_line', 'open_clamp'],
  },
  sources: [SOURCES.ceftriaxone, SOURCES.bnfc],
};
