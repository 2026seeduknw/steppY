/**
 * 암산용(mental) 환율표 — city_attraction_currency_pipeline/src/mental_rate.py 산출물
 * (data/currency_rates_final.json)을 그대로 옮김. 실제 환율 대신 "1 CNY ≈ 200원"처럼
 * 학생이 암산으로 대략 감을 잡기 좋은 반올림 값. 22개 통화, 기준일 2026-08-18/19.
 */
const MENTAL_FX_RATES = {
  AUD: { mentalUnit: 1, mentalKrw: 1000 },
  CAD: { mentalUnit: 1, mentalKrw: 1000 },
  CHF: { mentalUnit: 1, mentalKrw: 1700 },
  CNY: { mentalUnit: 1, mentalKrw: 200 },
  DKK: { mentalUnit: 1, mentalKrw: 200 },
  EUR: { mentalUnit: 1, mentalKrw: 1600 },
  GBP: { mentalUnit: 1, mentalKrw: 1900 },
  HKD: { mentalUnit: 1, mentalKrw: 200 },
  JPY: { mentalUnit: 100, mentalKrw: 900 },
  MXN: { mentalUnit: 10, mentalKrw: 800 },
  MYR: { mentalUnit: 1, mentalKrw: 300 },
  NOK: { mentalUnit: 1, mentalKrw: 100 },
  NZD: { mentalUnit: 1, mentalKrw: 800 },
  PLN: { mentalUnit: 1, mentalKrw: 400 },
  SEK: { mentalUnit: 1, mentalKrw: 100 },
  SGD: { mentalUnit: 1, mentalKrw: 1100 },
  THB: { mentalUnit: 10, mentalKrw: 400 },
  TRY: { mentalUnit: 10, mentalKrw: 300 },
  USD: { mentalUnit: 1, mentalKrw: 1400 },
  RUB: { mentalUnit: 10, mentalKrw: 200 },
  TWD: { mentalUnit: 10, mentalKrw: 400 },
  VND: { mentalUnit: 10000, mentalKrw: 500 }
};

/** amountLocal(현지 통화 금액)을 암산 환율로 원화 근사값으로 바꾼다. 통화가 표에 없으면 null. */
function mentalToKrw(amountLocal, currency) {
  const rate = MENTAL_FX_RATES[currency];
  if (!rate || typeof amountLocal !== 'number') return null;
  return amountLocal * rate.mentalKrw / rate.mentalUnit;
}
