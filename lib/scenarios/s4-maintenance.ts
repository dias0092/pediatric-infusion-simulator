import type { Scenario } from '../engine/types';
import { RATE_UNITS, SOURCES } from './common';

export const s4Maintenance: Scenario = {
  id: 's4-maintenance',
  number: 4,
  title: { ru: 'Поддерживающая инфузия: правило 4-2-1', kk: 'Демеуші инфузия: 4-2-1 ережесі' },
  reviewStatus: 'draft',
  patient: {
    code: '№004',
    age: { ru: '4 года', kk: '4 жас' },
    weightKg: 15,
    condition: {
      ru: 'Герпетический стоматит, не может пить из-за боли. Признаков обезвоживания нет.',
      kk: 'Герпестік стоматит, ауырсынуға байланысты іше алмайды. Сусыздану белгілері жоқ.',
    },
    accesses: ['piv'],
  },
  order: {
    ru: 'Поддерживающая инфузия NaCl 0,9% + глюкоза 5%: скорость по правилу 4-2-1, на 8 часов.',
    kk: 'NaCl 0,9% + глюкоза 5% демеуші инфузиясы: жылдамдық 4-2-1 ережесі бойынша, 8 сағатқа.',
  },
  prescription: { kind: 'maintenance421', durationMin: 480 },
  drugOptions: [
    {
      id: 'nacl-09-glucose-5',
      name: { ru: 'NaCl 0,9% + глюкоза 5%', kk: 'NaCl 0,9% + глюкоза 5%' },
      pumpLabel: 'NaCl 0.9% + GLU 5%',
      softMinRate: 5,
      softMaxRate: 100,
    },
    {
      id: 'glucose-5',
      name: { ru: 'Глюкоза 5%', kk: 'Глюкоза 5%' },
      pumpLabel: 'GLUCOSE 5%',
      softMinRate: 5,
      softMaxRate: 100,
    },
    {
      id: 'nacl-045',
      name: { ru: 'NaCl 0,45%', kk: 'NaCl 0,45%' },
      pumpLabel: 'NaCl 0.45%',
      softMinRate: 5,
      softMaxRate: 100,
    },
  ],
  correctDrugId: 'nacl-09-glucose-5',
  acceptableRoutes: ['piv'],
  criticalRoutes: [],
  calcSteps: [
    {
      id: 'rate',
      quantity: 'rateMlH',
      prompt: {
        ru: 'Рассчитайте скорость по правилу 4-2-1.',
        kk: '4-2-1 ережесі бойынша жылдамдықты есептеңіз.',
      },
      hint: {
        ru: '4 мл/кг/ч на первые 10 кг + 2 мл/кг/ч на следующие 10 кг + 1 мл/кг/ч на каждый кг сверх 20',
        kk: 'Алғашқы 10 кг-ға 4 мл/кг/сағ + келесі 10 кг-ға 2 мл/кг/сағ + 20 кг-нан асқан әр кг-ға 1 мл/кг/сағ',
      },
      unit: 'ml_h',
      unitOptions: RATE_UNITS,
    },
  ],
  alarm: {
    type: 'lowBattery',
    atProgress: 0.3,
    depleteAtProgress: 0.7,
    actions: [
      { id: 'connect_power', label: { ru: 'Подключить насос к сети', kk: 'Сорғыны желіге қосу' } },
      {
        id: 'power_off',
        label: { ru: 'Выключить насос, чтобы сберечь заряд', kk: 'Зарядты үнемдеу үшін сорғыны өшіру' },
      },
      { id: 'remove_battery', label: { ru: 'Вынуть аккумулятор', kk: 'Аккумуляторды шығару' } },
    ],
    sequence: ['connect_power'],
  },
  sources: [SOURCES.hollidaySegar, SOURCES.nice29],
};
