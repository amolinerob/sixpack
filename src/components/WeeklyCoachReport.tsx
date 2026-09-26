import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { buildWeeklyCoachReportData, formatWeeklyCoachReport } from '../weeklyCoachReport'

export function WeeklyCoachReport(props: Parameters<typeof buildWeeklyCoachReportData>[0]) {
  const [expanded, setExpanded] = useState(false)
  const [feedback, setFeedback] = useState('')
  const field = useRef<HTMLTextAreaElement>(null)
  const id = useId()
  const report = useMemo(() => expanded ? formatWeeklyCoachReport(buildWeeklyCoachReportData(props)) : '', [expanded, props])
  const latestReport = useRef(report)
  useEffect(() => {
    latestReport.current = report
    return () => { latestReport.current = '' }
  }, [report])
  useEffect(() => {
    if (!feedback) return
    const timeout = window.setTimeout(() => setFeedback(''), 4000)
    return () => window.clearTimeout(timeout)
  }, [feedback])
  async function copy() {
    const text = report
    try {
      await navigator.clipboard.writeText(text)
      if (latestReport.current === text) setFeedback('Informe copiado')
    } catch {
      if (latestReport.current !== text) return
      field.current?.focus()
      field.current?.select()
      field.current?.setSelectionRange(0, field.current.value.length)
      setFeedback('Selecciona y copia el texto manualmente.')
    }
  }
  return <div className="weekly-coach-report">
    <span className="weekly-card__title">Informe para coach</span>
    <button type="button" className="primary-button weekly-coach-report__generate" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(!expanded)}>{expanded ? 'Ocultar informe' : 'Generar informe'}</button>
    {expanded && <>
      <textarea id={id} ref={field} readOnly value={report} aria-label="Informe semanal para coach" rows={12} />
      <button type="button" className="secondary-button" onClick={copy}>Copiar informe</button>
      <span role="status">{feedback}</span>
    </>}
  </div>
}
