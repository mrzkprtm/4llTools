/**
 * Indonesian national holidays (libur nasional) and collective leave (cuti bersama)
 * from the joint ministerial decrees (SKB 3 Menteri). Islamic holiday dates follow
 * the government decree and can be moved after the sighting session (sidang isbat),
 * so always check the latest announcement.
 */

export type HolidayKind = 'holiday' | 'cuti'

export interface Holiday {
  date: string
  name: string
  kind: HolidayKind
}

/** How firm each year's data is. */
export const DATA_STATUS: Record<number, string> = {
  2025: 'SKB 3 Menteri 2025, including the extra cuti bersama on 18 August 2025.',
  2026: 'SKB 3 Menteri for 2026 (signed September 2025).',
  2027: 'Estimate: the 2027 SKB was not yet published when this tool was built, so dates and cuti bersama may change.',
}

const h = (date: string, name: string): Holiday => ({ date, name, kind: 'holiday' })
const c = (date: string, name: string): Holiday => ({ date, name, kind: 'cuti' })

export const HOLIDAYS: Holiday[] = [
  // 2025
  h('2025-01-01', 'New Year’s Day'),
  h('2025-01-27', 'Isra Mikraj of the Prophet Muhammad'),
  c('2025-01-28', 'Cuti bersama: Chinese New Year'),
  h('2025-01-29', 'Chinese New Year 2576'),
  c('2025-03-28', 'Cuti bersama: Nyepi'),
  h('2025-03-29', 'Nyepi (Saka New Year 1947)'),
  h('2025-03-31', 'Idul Fitri 1446 H'),
  h('2025-04-01', 'Idul Fitri 1446 H (day 2)'),
  c('2025-04-02', 'Cuti bersama: Idul Fitri'),
  c('2025-04-03', 'Cuti bersama: Idul Fitri'),
  c('2025-04-04', 'Cuti bersama: Idul Fitri'),
  c('2025-04-07', 'Cuti bersama: Idul Fitri'),
  h('2025-04-18', 'Good Friday'),
  h('2025-04-20', 'Easter Sunday'),
  h('2025-05-01', 'Labor Day'),
  h('2025-05-12', 'Waisak 2569 BE'),
  c('2025-05-13', 'Cuti bersama: Waisak'),
  h('2025-05-29', 'Ascension of Jesus Christ'),
  c('2025-05-30', 'Cuti bersama: Ascension Day'),
  h('2025-06-01', 'Pancasila Day'),
  h('2025-06-06', 'Idul Adha 1446 H'),
  c('2025-06-09', 'Cuti bersama: Idul Adha'),
  h('2025-06-27', 'Islamic New Year 1447 H'),
  h('2025-08-17', 'Independence Day'),
  c('2025-08-18', 'Cuti bersama: Independence Day'),
  h('2025-09-05', 'Maulid of the Prophet Muhammad'),
  h('2025-12-25', 'Christmas Day'),
  c('2025-12-26', 'Cuti bersama: Christmas'),
  // 2026
  h('2026-01-01', 'New Year’s Day'),
  h('2026-01-16', 'Isra Mikraj of the Prophet Muhammad'),
  c('2026-02-16', 'Cuti bersama: Chinese New Year'),
  h('2026-02-17', 'Chinese New Year 2577'),
  c('2026-03-18', 'Cuti bersama: Nyepi'),
  h('2026-03-19', 'Nyepi (Saka New Year 1948)'),
  c('2026-03-20', 'Cuti bersama: Idul Fitri'),
  h('2026-03-21', 'Idul Fitri 1447 H'),
  h('2026-03-22', 'Idul Fitri 1447 H (day 2)'),
  c('2026-03-23', 'Cuti bersama: Idul Fitri'),
  c('2026-03-24', 'Cuti bersama: Idul Fitri'),
  h('2026-04-03', 'Good Friday'),
  h('2026-04-05', 'Easter Sunday'),
  h('2026-05-01', 'Labor Day'),
  h('2026-05-14', 'Ascension of Jesus Christ'),
  c('2026-05-15', 'Cuti bersama: Ascension Day'),
  h('2026-05-27', 'Idul Adha 1447 H'),
  c('2026-05-28', 'Cuti bersama: Idul Adha'),
  h('2026-05-31', 'Waisak 2570 BE'),
  h('2026-06-01', 'Pancasila Day'),
  h('2026-06-16', 'Islamic New Year 1448 H'),
  h('2026-08-17', 'Independence Day'),
  h('2026-08-25', 'Maulid of the Prophet Muhammad'),
  c('2026-12-24', 'Cuti bersama: Christmas'),
  h('2026-12-25', 'Christmas Day'),
  // 2027 (estimate until the SKB is published)
  h('2027-01-01', 'New Year’s Day'),
  h('2027-01-05', 'Isra Mikraj of the Prophet Muhammad (est.)'),
  h('2027-02-06', 'Chinese New Year 2578'),
  h('2027-03-08', 'Nyepi (Saka New Year 1949, est.)'),
  c('2027-03-09', 'Cuti bersama: Idul Fitri (est.)'),
  h('2027-03-10', 'Idul Fitri 1448 H (est.)'),
  h('2027-03-11', 'Idul Fitri 1448 H, day 2 (est.)'),
  c('2027-03-12', 'Cuti bersama: Idul Fitri (est.)'),
  c('2027-03-15', 'Cuti bersama: Idul Fitri (est.)'),
  h('2027-03-26', 'Good Friday'),
  h('2027-03-28', 'Easter Sunday'),
  h('2027-05-01', 'Labor Day'),
  h('2027-05-06', 'Ascension of Jesus Christ'),
  c('2027-05-07', 'Cuti bersama: Ascension Day (est.)'),
  h('2027-05-17', 'Idul Adha 1448 H (est.)'),
  h('2027-05-20', 'Waisak 2571 BE (est.)'),
  h('2027-06-01', 'Pancasila Day'),
  h('2027-06-06', 'Islamic New Year 1449 H (est.)'),
  h('2027-08-15', 'Maulid of the Prophet Muhammad (est.)'),
  h('2027-08-17', 'Independence Day'),
  c('2027-12-24', 'Cuti bersama: Christmas (est.)'),
  h('2027-12-25', 'Christmas Day'),
]
