import { useRef, useState } from 'react'
import PillRow from '../../motion/PillRow'
import Roll from '../../motion/Roll'
import { useReplay } from '../../motion/useReplay'
import { useSettled } from '../../motion/useSettled'
import { FITRAH_RICE_KG, FITRAH_RICE_L, GOLD_NISAB_G, parseRupiah, rupiah, SILVER_NISAB_G, zakatFitrah, zakatIncome, zakatMal, type Basis } from './zakat'
import './tool.css'

type Tab = 'mal' | 'income' | 'fitrah'

/** A rupiah field: plain digits while typing, "1.500.000" once you leave it. */
function Money({ id, label, sub, value, onChange }: { id: string; label: string; sub?: string; value: number; onChange: (n: number) => void }) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label htmlFor={id}>{label}{sub && <> <span className="zk-sub">{sub}</span></>}</label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="0"
        value={focused ? (value ? String(value) : '') : value ? value.toLocaleString('id-ID') : ''}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(parseRupiah(e.target.value))}
      />
    </div>
  )
}

function Line({ k, v }: { k: string; v: string }) {
  return <div className="zk-line"><span>{k}</span><span>{v}</span></div>
}

function Meter({ value, nisab }: { value: number; nisab: number }) {
  const f = nisab > 0 ? Math.min(1, value / nisab) : 0
  return (
    <div className={`zk-meter ${f >= 1 ? 'reached' : ''}`}>
      <div className="bar" role="progressbar" aria-label="Harta dibanding nisab" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(f * 100)}>
        <i style={{ transform: `scaleX(${Math.max(0.02, f)})` }} />
      </div>
      <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.8rem' }}>{f >= 1 ? 'Sudah mencapai nisab · Nisab reached' : `${Math.round(f * 100)}% dari nisab · of nisab`}</p>
    </div>
  )
}

export default function ZakatCalculator() {
  const [tab, setTab] = useState<Tab>('mal')
  const [goldPrice, setGoldPrice] = useState(2_000_000)
  const [silverPrice, setSilverPrice] = useState(25_000)
  const [confirmed, setConfirmed] = useState(false)
  const [basis, setBasis] = useState<Basis>('gold')
  const [haul, setHaul] = useState(true)
  const [assets, setAssets] = useState({ cash: 15_000_000, savings: 120_000_000, gold: 40_000_000, silver: 0, stocks: 25_000_000, receivables: 0, inventory: 0, debts: 10_000_000 })
  const [income, setIncome] = useState(15_000_000)
  const [other, setOther] = useState(0)
  const [useNet, setUseNet] = useState(false)
  const [deduct, setDeduct] = useState(0)
  const [people, setPeople] = useState(4)
  const [perPerson, setPerPerson] = useState(50_000)
  const box = useRef<HTMLDivElement>(null)

  const mal = zakatMal({ ...assets, basis, goldPrice, silverPrice })
  const inc = zakatIncome(income, other, goldPrice, useNet ? deduct : 0)
  const fit = zakatFitrah(people, perPerson)
  const settled = useSettled(`${tab}|${mal.zakat}|${inc.zakat}|${fit.money}`, 300)
  useReplay(box, settled)
  const set = (k: keyof typeof assets) => (n: number) => setAssets({ ...assets, [k]: n })
  const malDue = mal.due && haul

  return (
    <div>
      <PillRow role="tablist" label="Jenis zakat">
        <button type="button" role="tab" aria-selected={tab === 'mal'} className={`btn ${tab === 'mal' ? 'primary' : ''}`} onClick={() => setTab('mal')}>Zakat Mal</button>
        <button type="button" role="tab" aria-selected={tab === 'income'} className={`btn ${tab === 'income' ? 'primary' : ''}`} onClick={() => setTab('income')}>Zakat Penghasilan</button>
        <button type="button" role="tab" aria-selected={tab === 'fitrah'} className={`btn ${tab === 'fitrah' ? 'primary' : ''}`} onClick={() => setTab('fitrah')}>Zakat Fitrah</button>
      </PillRow>

      {tab !== 'fitrah' && (
        <div className={`zk-price ${confirmed ? 'ok' : ''}`}>
          <div className="zk-grid">
            <Money id="zk-gold-price" label="Harga emas per gram (Rp)" sub="Gold price per gram" value={goldPrice} onChange={(n) => { setGoldPrice(n); setConfirmed(true) }} />
            {tab === 'mal' && basis === 'silver' && <Money id="zk-silver-price" label="Harga perak per gram (Rp)" sub="Silver price per gram" value={silverPrice} onChange={(n) => { setSilverPrice(n); setConfirmed(true) }} />}
          </div>
          <label className="zk-check">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            <span>Saya sudah cek harga hari ini · I have checked today&apos;s price (e.g. Antam/Pegadaian buyback or BAZNAS&apos;s published nisab)</span>
          </label>
          {!confirmed && <span className="chip bad calm zk-warn">Harga contoh, belum dicek · Example price, please confirm</span>}
        </div>
      )}

      {tab === 'mal' && (
        <div>
          <div className="row">
            <span className="muted" style={{ fontSize: '0.9rem' }}>Nisab:</span>
            <PillRow label="Nisab basis" style={{ margin: 0 }}>
              <button type="button" className={`btn ${basis === 'gold' ? 'primary' : ''}`} aria-pressed={basis === 'gold'} onClick={() => setBasis('gold')}>Emas {GOLD_NISAB_G} g</button>
              <button type="button" className={`btn ${basis === 'silver' ? 'primary' : ''}`} aria-pressed={basis === 'silver'} onClick={() => setBasis('silver')}>Perak {SILVER_NISAB_G} g</button>
            </PillRow>
          </div>
          <div className="zk-grid">
            <Money id="zk-cash" label="Uang tunai" sub="Cash" value={assets.cash} onChange={set('cash')} />
            <Money id="zk-savings" label="Tabungan & deposito" sub="Savings" value={assets.savings} onChange={set('savings')} />
            <Money id="zk-gold" label="Nilai emas" sub="Gold (value, not worn jewellery)" value={assets.gold} onChange={set('gold')} />
            <Money id="zk-silver" label="Nilai perak" sub="Silver" value={assets.silver} onChange={set('silver')} />
            <Money id="zk-stocks" label="Saham, reksa dana, investasi" sub="Stocks & funds" value={assets.stocks} onChange={set('stocks')} />
            <Money id="zk-recv" label="Piutang lancar" sub="Receivables likely to be repaid" value={assets.receivables} onChange={set('receivables')} />
            <Money id="zk-inv" label="Aset dagang / persediaan" sub="Business inventory" value={assets.inventory} onChange={set('inventory')} />
            <Money id="zk-debts" label="Utang jatuh tempo" sub="Debts due now (subtracted)" value={assets.debts} onChange={set('debts')} />
          </div>
          <label className="zk-check">
            <input type="checkbox" checked={haul} onChange={(e) => setHaul(e.target.checked)} />
            <span>Harta sudah dimiliki selama 1 tahun hijriah (haul) · Held for one lunar year</span>
          </label>
          <div ref={box} className={`zk-result ${malDue ? 'due' : ''}`} aria-live="polite">
            <span className={`chip ${malDue ? 'good' : ''}`} key={`${malDue}-${mal.due}`}>{malDue ? 'Wajib zakat · Zakat is due' : mal.due ? 'Belum haul · Not due until one lunar year passes' : 'Belum mencapai nisab · Below nisab'}</span>
            <div className="zk-big"><Roll>{rupiah(malDue ? mal.zakat : 0)}</Roll></div>
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>Zakat mal 2,5% dari harta bersih · 2.5% of net wealth{!haul && mal.due ? `; when haul is complete it will be ${rupiah(mal.zakat)}` : ''}</p>
            <Meter value={mal.net} nisab={mal.nisab} />
            <Line k="Total harta · Total assets" v={rupiah(mal.total)} />
            <Line k="Harta bersih · Net after debts" v={rupiah(mal.net)} />
            <Line k={`Nisab (${basis === 'gold' ? `${GOLD_NISAB_G} g emas` : `${SILVER_NISAB_G} g perak`})`} v={rupiah(mal.nisab)} />
          </div>
          <p className="muted" style={{ fontSize: '0.85rem' }}>Most Indonesian institutions (BAZNAS, MUI) use the gold nisab. The silver nisab is much lower, so more people reach it; some scholars prefer it because it benefits the poor. Gold jewellery worn normally is exempt in many opinions.</p>
        </div>
      )}

      {tab === 'income' && (
        <div>
          <div className="zk-grid">
            <Money id="zk-income" label="Penghasilan per bulan" sub="Monthly income (salary, fees)" value={income} onChange={setIncome} />
            <Money id="zk-other" label="Penghasilan lain bulan ini" sub="Bonus, THR, side income" value={other} onChange={setOther} />
          </div>
          <label className="zk-check">
            <input type="checkbox" checked={useNet} onChange={(e) => setUseNet(e.target.checked)} />
            <span>Kurangi kebutuhan pokok / cicilan (pendapat netto) · Deduct basic needs and installments (net-income opinion)</span>
          </label>
          {useNet && <div className="zk-grid settle-in"><Money id="zk-deduct" label="Kebutuhan pokok & cicilan per bulan" sub="Monthly deductions" value={deduct} onChange={setDeduct} /></div>}
          <div ref={box} className={`zk-result ${inc.due ? 'due' : ''}`} aria-live="polite">
            <span className={`chip ${inc.due ? 'good' : ''}`} key={String(inc.due)}>{inc.due ? 'Wajib zakat · Zakat is due' : 'Belum mencapai nisab · Below nisab'}</span>
            <div className="zk-big"><Roll>{rupiah(inc.zakat)}</Roll></div>
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>per bulan · per month ({rupiah(inc.zakat * 12)} per tahun · per year)</p>
            <Meter value={inc.income} nisab={inc.nisab} />
            <Line k={useNet ? 'Penghasilan bersih · Net income' : 'Penghasilan bruto · Gross income'} v={rupiah(inc.income)} />
            <Line k={`Nisab per bulan (${GOLD_NISAB_G} g emas ÷ 12)`} v={rupiah(inc.nisab)} />
          </div>
          <p className="muted" style={{ fontSize: '0.85rem' }}>Following BAZNAS guidance, zakat penghasilan (profesi) is 2.5% of monthly income once it reaches the nisab of {GOLD_NISAB_G} g of gold per year divided by 12, and can be paid every month when you are paid.</p>
        </div>
      )}

      {tab === 'fitrah' && (
        <div>
          <div className="zk-grid">
            <div>
              <label htmlFor="zk-people">Jumlah jiwa <span className="zk-sub">People in the household</span></label>
              <div className="zk-stepper">
                <button type="button" className="btn" aria-label="Kurangi satu orang" onClick={() => setPeople(Math.max(1, people - 1))}>−</button>
                <input id="zk-people" type="number" inputMode="numeric" min={1} max={999} value={people} onChange={(e) => setPeople(Math.max(0, Math.min(999, Number(e.target.value) || 0)))} />
                <button type="button" className="btn" aria-label="Tambah satu orang" onClick={() => setPeople(Math.min(999, people + 1))}>+</button>
              </div>
            </div>
            <Money id="zk-per" label="Nilai per jiwa (Rp)" sub="Money amount per person set by your amil" value={perPerson} onChange={setPerPerson} />
          </div>
          <div ref={box} className="zk-result due" aria-live="polite">
            <div className="stats" style={{ marginTop: 0, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 150px), 1fr))' }}>
              <div className="stat"><b><Roll>{`${fit.riceKg.toLocaleString('id-ID')} kg`}</Roll></b>Beras · rice ({FITRAH_RICE_KG} kg/jiwa)</div>
              <div className="stat"><b><Roll>{`${fit.riceL.toLocaleString('id-ID')} L`}</Roll></b>Beras · rice ({FITRAH_RICE_L} liter/jiwa)</div>
              <div className="stat"><b><Roll>{rupiah(fit.money)}</Roll></b>Uang · money</div>
            </div>
          </div>
          <p className="muted" style={{ fontSize: '0.85rem' }}>Zakat fitrah is one sha&apos; of staple food per person, commonly set in Indonesia as {FITRAH_RICE_KG} kg or {FITRAH_RICE_L} liters of rice, paid before the Eid prayer. The money amount per person is set each year by BAZNAS or your local amil based on rice prices, so enter the figure your area announces.</p>
        </div>
      )}

      <p className="muted" style={{ fontSize: '0.85rem' }}>
        Perhitungan ini hanya perkiraan. Untuk kepastian, konsultasikan dengan amil zakat resmi (BAZNAS/LAZ) atau ustadz setempat. · This is an estimate only; consult an official amil or a local ustadz for rulings that fit your situation. Nothing you enter leaves your browser.
      </p>
    </div>
  )
}
