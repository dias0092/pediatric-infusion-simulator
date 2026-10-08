import type { Scenario } from '../engine/types';
import { SOURCES, VOLUME_UNITS } from './common';

export const s3SalineBolus: Scenario = {
  id: 's3-saline-bolus',
  number: 3,
  title: { ru: 'Тяжёлое обезвоживание: NaCl 0,9%', kk: 'Ауыр сусыздану: NaCl 0,9%' },
  reviewStatus: 'draft',
  patient: {
    code: '№003',
    age: { ru: '2 года', kk: '2 жас' },
    weightKg: 12,
    condition: {
      ru: 'Острая диарея, тяжёлое обезвоживание: вялость, запавшие глаза, кожная складка расправляется очень медленно.',
      kk: 'Жедел диарея, ауыр сусыздану: әлсіздік, көздері шүңірейген, тері қатпары өте баяу жазылады.',
    },
    accesses: ['piv'],
  },
  order: {
    ru: 'NaCl 0,9% 30 мл/кг в/в за 30 минут (план C ВОЗ, первый этап).',
    kk: 'NaCl 0,9% 30 мл/кг вена ішіне 30 минут ішінде (ДДСҰ C жоспары, бірінші кезең).',
  },
  prescription: { kind: 'volumePerKg', mlPerKg: 30, durationMin: 30 },
  drugOptions: [
    {
      id: 'nacl-09',
      name: { ru: 'NaCl 0,9%', kk: 'NaCl 0,9%' },
      pumpLabel: 'NaCl 0.9%',
      softMinRate: 10,
      softMaxRate: 999.9,
    },
    {
      id: 'nacl-10',
      name: { ru: 'NaCl 10%', kk: 'NaCl 10%' },
      pumpLabel: 'NaCl 10%',
      softMinRate: 1,
      softMaxRate: 20,
      critical: true,
    },
    {
      id: 'glucose-5',
      name: { ru: 'Глюкоза 5%', kk: 'Глюкоза 5%' },
      pumpLabel: 'GLUCOSE 5%',
      softMinRate: 5,
      softMaxRate: 200,
    },
  ],
  correctDrugId: 'nacl-09',
  acceptableRoutes: ['piv'],
  criticalRoutes: [],
  calcSteps: [
    {
      id: 'volume',
      quantity: 'volumeMl',
      prompt: { ru: 'Рассчитайте объём болюса.', kk: 'Болюс көлемін есептеңіз.' },
      hint: { ru: 'Объём (мл) = мл/кг × масса (кг)', kk: 'Көлем (мл) = мл/кг × салмақ (кг)' },
      unit: 'ml',
      unitOptions: VOLUME_UNITS,
    },
  ],
  alarm: {
    type: 'airInLine',
    atProgress: 0.5,
    actions: [
      {
        id: 'clamp_line',
        label: { ru: 'Перекрыть зажим линии к пациенту', kk: 'Науқасқа баратын желінің қысқышын жабу' },
      },
      {
        id: 'remove_air',
        label: {
          ru: 'Удалить воздух из линии по инструкции насоса',
          kk: 'Сорғы нұсқаулығы бойынша желіден ауаны шығару',
        },
      },
      { id: 'unclamp_line', label: { ru: 'Открыть зажим', kk: 'Қысқышты ашу' } },
      { id: 'disable_sensor', label: { ru: 'Отключить датчик воздуха', kk: 'Ауа датчигін өшіру' } },
      {
        id: 'flush_bubble',
        label: {
          ru: 'Промыть катетер, чтобы протолкнуть пузырь',
          kk: 'Көпіршікті итеру үшін катетерді жуу',
        },
      },
    ],
    sequence: ['clamp_line', 'remove_air', 'unclamp_line'],
  },
  sources: [SOURCES.whoPocketBook],
};
