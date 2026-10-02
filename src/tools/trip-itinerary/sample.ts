import type { Activity } from './logic'

const h = (hh: number, mm = 0) => hh * 60 + mm
let n = 0
const act = (name: string, place: string, type: Activity['type'], day: number | null, start: number, dur: number): Activity => ({ id: `s${++n}`, name, place, type, day, start, dur })

/** A three-day Bali trip to start from. */
export const SAMPLE = {
  title: 'Bali long weekend',
  startDate: '',
  days: 3,
  acts: [
    act('Land at Ngurah Rai', 'DPS airport', 'transport', 0, h(9), 60),
    act('Check in', 'Seminyak', 'stay', 0, h(11), 30),
    act('Lunch: nasi campur', 'Warung Made', 'food', 0, h(12), 60),
    act('Tanah Lot sunset', 'Tabanan', 'sight', 0, h(17), 120),
    act('Seafood dinner', 'Jimbaran', 'food', 0, h(19, 30), 90),
    act('Tegallalang rice terraces', 'Ubud', 'sight', 1, h(8), 120),
    act('Monkey Forest', 'Ubud', 'sight', 1, h(10, 30), 90),
    act('Lunch: bebek goreng', 'Ubud', 'food', 1, h(13), 60),
    act('Ubud Art Market', 'Ubud', 'shopping', 1, h(14, 30), 90),
    act('Kecak fire dance', 'Uluwatu', 'activity', 1, h(18), 60),
    act('Surf lesson', 'Kuta Beach', 'activity', 2, h(7, 30), 120),
    act('Brunch', 'Canggu', 'food', 2, h(9, 15), 75),
    act('Check out', 'Seminyak', 'stay', 2, h(12), 30),
    act('Airport transfer', 'DPS airport', 'transport', 2, h(14), 60),
    act('Nusa Penida day trip', 'Sanur harbor', 'activity', null, h(9), 480),
    act('Balinese massage', 'Seminyak', 'activity', null, h(9), 90),
    act('Beach club', 'Canggu', 'food', null, h(9), 180),
    act('Oleh-oleh shopping', 'Krisna', 'shopping', null, h(9), 60),
  ],
}
