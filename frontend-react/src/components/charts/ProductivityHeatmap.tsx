export interface HeatmapValue {
  date: string
  count: number
}

export interface ProductivityHeatmapProps {
  data: HeatmapValue[]
  /**
   * Number of weeks to display — more weeks = wider aspect ratio = shorter rendered height.
   * Default 26 (6 months). Use 52 for a full year.
   */
  weeks?: number
}

// CSS class per intensity level — colours are in globals.css (.color-empty etc.)
// Using className (not inline fill) so light/dark theme is honoured.
function classForCount(count: number): string {
  if (count === 0) return 'color-empty'
  if (count < 2)  return 'color-scale-1'
  if (count < 4)  return 'color-scale-2'
  if (count < 6)  return 'color-scale-3'
  return 'color-scale-4'
}

// Work days only: Mon (1) → Fri (5) — skip Sat/Sun
const WORK_ROWS = [1, 2, 3, 4, 5]
const DAY_LABEL: Record<number, string> = { 1: 'M', 3: 'W', 5: 'F' }

/**
 * Compact Mon–Fri activity heatmap.
 * – Responsive: fills container width (width:100%; height:auto).
 * – Short: only 5 rows (no weekends). More weeks → better aspect ratio → shorter height.
 * – Theme-aware: uses CSS classes from globals.css for light/dark colours.
 */
export function ProductivityHeatmap({ data, weeks = 26 }: ProductivityHeatmapProps) {
  const CELL   = 11   // SVG units per cell
  const GAP    = 3
  const STEP   = CELL + GAP  // 14
  const LBL_W  = 12   // left gutter for M/W/F labels
  const LBL_H  = 13   // top gutter for month labels

  const countMap = new Map(data.map(d => [d.date, d.count]))

  // Align grid to the Monday `weeks` weeks before today
  const today    = new Date()
  // Find last Monday
  const todayDay = today.getDay() === 0 ? 7 : today.getDay() // 1=Mon … 7=Sun
  const gridStart = new Date(today)
  gridStart.setDate(today.getDate() - (todayDay - 1) - (weeks - 1) * 7)

  type Cell = { date: string; count: number; x: number; y: number }
  const cells: Cell[] = []
  const monthLabels: { label: string; x: number }[] = []
  let lastMonth = -1

  for (let col = 0; col < weeks; col++) {
    // Each column = one Mon-Fri work week
    for (let ri = 0; ri < WORK_ROWS.length; ri++) {
      const dayOffset = WORK_ROWS[ri] - 1  // Mon=0, Tue=1 … Fri=4
      const d = new Date(gridStart)
      d.setDate(gridStart.getDate() + col * 7 + dayOffset)
      if (d > today) continue

      const dateStr = d.toISOString().split('T')[0]
      const x = LBL_W + col * STEP
      const y = LBL_H + ri  * STEP
      cells.push({ date: dateStr, count: countMap.get(dateStr) ?? 0, x, y })

      // Month label at first cell of each new month (Mon row)
      if (ri === 0 && d.getMonth() !== lastMonth) {
        lastMonth = d.getMonth()
        monthLabels.push({
          label: d.toLocaleString('default', { month: 'short' }),
          x,
        })
      }
    }
  }

  // ViewBox: wider aspect ratio keeps rendered height compact at full container width.
  // 26 weeks → aspect ≈ 4.4 → at 900px container: height ≈ 205px (not ideal)
  // 52 weeks → aspect ≈ 8.8 → at 900px container: height ≈ 102px ✓
  const svgW = LBL_W + weeks * STEP - GAP
  const svgH = LBL_H + WORK_ROWS.length * STEP - GAP   // 5 rows

  return (
    <div aria-label="Activity heatmap — Mon–Fri daily hours logged" style={{ width: '100%' }}>
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        aria-hidden="true"
      >
        {/* Month labels */}
        {monthLabels.map(({ label, x }) => (
          <text key={`m-${x}`} x={x} y={LBL_H - 2}
            fontSize={7} fill="#6B7280" fontFamily="sans-serif">
            {label}
          </text>
        ))}

        {/* Day labels: M / W / F */}
        {WORK_ROWS.map((wd, ri) => DAY_LABEL[wd] && (
          <text key={wd}
            x={LBL_W - 2}
            y={LBL_H + ri * STEP + CELL / 2}
            fontSize={6} fill="#6B7280"
            textAnchor="end" dominantBaseline="middle"
            fontFamily="sans-serif">
            {DAY_LABEL[wd]}
          </text>
        ))}

        {/* Activity cells — className drives fill via globals.css (light/dark aware) */}
        {cells.map(({ date, count, x, y }) => (
          <rect
            key={date}
            className={classForCount(count)}
            x={x} y={y}
            width={CELL} height={CELL}
            rx={2}
          >
            <title>{date}: {count > 0 ? `${count}h` : 'No activity'}</title>
          </rect>
        ))}
      </svg>
    </div>
  )
}
