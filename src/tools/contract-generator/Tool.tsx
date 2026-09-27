import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

const TEMPLATES = {
  nda: {
    name: 'Non-Disclosure Agreement (NDA)',
    fields: [
      { key: 'disclosingParty', label: 'Disclosing Party', type: 'text' },
      { key: 'receivingParty', label: 'Receiving Party', type: 'text' },
      { key: 'purpose', label: 'Purpose of Disclosure', type: 'textarea' },
      { key: 'duration', label: 'Confidentiality Duration (years)', type: 'number' },
      { key: 'jurisdiction', label: 'Governing Law/Jurisdiction', type: 'text' },
      { key: 'effectiveDate', label: 'Effective Date', type: 'date' },
    ],
    template: `
NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into on {{effectiveDate}} between:

1. {{disclosingParty}} ("Disclosing Party")
2. {{receivingParty}} ("Receiving Party")

Collectively referred to as the "Parties."

WHEREAS, the Disclosing Party possesses certain confidential information; and
WHEREAS, the Disclosing Party wishes to disclose such information to the Receiving Party for the purpose of {{purpose}};

NOW, THEREFORE, the Parties agree as follows:

1. DEFINITION OF CONFIDENTIAL INFORMATION
"Confidential Information" means any information disclosed by the Disclosing Party to the Receiving Party, whether oral, written, or electronic, that is marked as confidential or that reasonably should be understood to be confidential given the nature of the information and the circumstances of disclosure.

2. OBLIGATIONS OF RECEIVING PARTY
The Receiving Party shall:
(a) Hold all Confidential Information in strict confidence;
(b) Not disclose Confidential Information to any third party without prior written consent;
(c) Use Confidential Information solely for the Purpose stated above;
(d) Limit access to Confidential Information to employees/agents with a need to know.

3. EXCLUSIONS
This Agreement does not apply to information that:
(a) Is or becomes publicly available through no fault of Receiving Party;
(b) Was known to Receiving Party prior to disclosure;
(c) Is independently developed by Receiving Party;
(d) Is rightfully received from a third party without restriction.

4. TERM
This Agreement remains in effect for {{duration}} years from the Effective Date.

5. RETURN OF MATERIALS
Upon termination or written request, Receiving Party shall return or destroy all Confidential Information.

6. GOVERNING LAW
This Agreement shall be governed by the laws of {{jurisdiction}}.

7. GENERAL PROVISIONS
This Agreement constitutes the entire understanding between the Parties. Amendments must be in writing.

IN WITNESS WHEREOF, the Parties have executed this Agreement as of the Effective Date.

_________________________                    _________________________
{{disclosingParty}}                          {{receivingParty}}
Date: _______________                        Date: _______________
    `,
  },
  service: {
    name: 'Service Agreement',
    fields: [
      { key: 'provider', label: 'Service Provider', type: 'text' },
      { key: 'client', label: 'Client', type: 'text' },
      { key: 'services', label: 'Description of Services', type: 'textarea' },
      { key: 'compensation', label: 'Compensation', type: 'text' },
      { key: 'paymentTerms', label: 'Payment Terms', type: 'text' },
      { key: 'startDate', label: 'Start Date', type: 'date' },
      { key: 'endDate', label: 'End Date', type: 'date' },
      { key: 'terminationNotice', label: 'Termination Notice (days)', type: 'number' },
      { key: 'jurisdiction', label: 'Governing Law', type: 'text' },
    ],
    template: `
SERVICE AGREEMENT

This Service Agreement ("Agreement") is entered into on {{startDate}} between:

Service Provider: {{provider}}
Client: {{client}}

1. SERVICES
The Provider shall perform the following services: {{services}}

2. COMPENSATION
The Client shall pay the Provider: {{compensation}}
Payment terms: {{paymentTerms}}

3. TERM
This Agreement commences on {{startDate}} and ends on {{endDate}}, unless terminated earlier per Section 6.

6. TERMINATION
Either party may terminate with {{terminationNotice}} days written notice.

7. GOVERNING LAW
This Agreement shall be governed by the laws of {{jurisdiction}}.

IN WITNESS WHEREOF, the Parties have executed this Agreement.

_________________________                    _________________________
{{provider}}                                 {{client}}
Date: _______________                        Date: _______________
    `,
  },
  employment: {
    name: 'Employment Contract',
    fields: [
      { key: 'employer', label: 'Employer', type: 'text' },
      { key: 'employee', label: 'Employee', type: 'text' },
      { key: 'position', label: 'Position/Title', type: 'text' },
      { key: 'startDate', label: 'Start Date', type: 'date' },
      { key: 'salary', label: 'Annual Salary', type: 'text' },
      { key: 'payFrequency', label: 'Pay Frequency', type: 'text' },
      { key: 'benefits', label: 'Benefits', type: 'textarea' },
      { key: 'workHours', label: 'Work Hours/Week', type: 'text' },
      { key: 'probationPeriod', label: 'Probation Period (months)', type: 'number' },
      { key: 'terminationNotice', label: 'Termination Notice (days)', type: 'number' },
      { key: 'jurisdiction', label: 'Governing Law', type: 'text' },
    ],
    template: `
EMPLOYMENT CONTRACT

This Employment Contract ("Contract") is entered into on {{startDate}} between:

Employer: {{employer}}
Employee: {{employee}}

1. POSITION
The Employee is hired as: {{position}}

2. COMPENSATION
Annual Salary: {{salary}}
Pay Frequency: {{payFrequency}}

3. BENEFITS
{{benefits}}

4. WORK HOURS
Standard work week: {{workHours}} hours

5. PROBATION
Probation period: {{probationPeriod}} months

6. TERMINATION
Notice period: {{terminationNotice}} days

7. GOVERNING LAW
Governing law: {{jurisdiction}}

IN WITNESS WHEREOF, the Parties have executed this Contract.

_________________________                    _________________________
{{employer}}                                 {{employee}}
Date: _______________                        Date: _______________
    `,
  },
  freelance: {
    name: 'Freelance Contract',
    fields: [
      { key: 'freelancer', label: 'Freelancer', type: 'text' },
      { key: 'client', label: 'Client', type: 'text' },
      { key: 'project', label: 'Project Description', type: 'textarea' },
      { key: 'deliverables', label: 'Deliverables', type: 'textarea' },
      { key: 'rate', label: 'Rate (hourly/project)', type: 'text' },
      { key: 'paymentSchedule', label: 'Payment Schedule', type: 'textarea' },
      { key: 'startDate', label: 'Start Date', type: 'date' },
      { key: 'deadline', label: 'Deadline', type: 'date' },
      { key: 'revisions', label: 'Included Revisions', type: 'number' },
      { key: 'ipOwnership', label: 'IP Ownership', type: 'text' },
      { key: 'jurisdiction', label: 'Governing Law', type: 'text' },
    ],
    template: `
FREELANCE CONTRACT

This Freelance Contract ("Contract") is entered into on {{startDate}} between:

Freelancer: {{freelancer}}
Client: {{client}}

1. PROJECT
{{project}}

2. DELIVERABLES
{{deliverables}}

3. COMPENSATION
Rate: {{rate}}
Payment Schedule: {{paymentSchedule}}

4. TIMELINE
Start Date: {{startDate}}
Deadline: {{deadline}}

5. REVISIONS
Included revisions: {{revisions}} rounds

6. INTELLECTUAL PROPERTY
{{ipOwnership}}

7. GOVERNING LAW
{{jurisdiction}}

IN WITNESS WHEREOF, the Parties have executed this Contract.

_________________________                    _________________________
{{freelancer}}                               {{client}}
Date: _______________                        Date: _______________
    `,
  },
  partnership: {
    name: 'Partnership Agreement',
    fields: [
      { key: 'partner1', label: 'Partner 1', type: 'text' },
      { key: 'partner2', label: 'Partner 2', type: 'text' },
      { key: 'businessName', label: 'Business Name', type: 'text' },
      { key: 'businessPurpose', label: 'Business Purpose', type: 'textarea' },
      { key: 'capital1', label: 'Partner 1 Capital Contribution', type: 'text' },
      { key: 'capital2', label: 'Partner 2 Capital Contribution', type: 'text' },
      { key: 'profitShare1', label: 'Partner 1 Profit Share %', type: 'number' },
      { key: 'profitShare2', label: 'Partner 2 Profit Share %', type: 'number' },
      { key: 'management', label: 'Management Structure', type: 'textarea' },
      { key: 'startDate', label: 'Start Date', type: 'date' },
      { key: 'jurisdiction', label: 'Governing Law', type: 'text' },
    ],
    template: `
PARTNERSHIP AGREEMENT

This Partnership Agreement ("Agreement") is entered into on {{startDate}} between:

Partner 1: {{partner1}}
Partner 2: {{partner2}}

Business Name: {{businessName}}
Business Purpose: {{businessPurpose}}

1. CAPITAL CONTRIBUTIONS
Partner 1: {{capital1}}
Partner 2: {{capital2}}

2. PROFIT & LOSS SHARING
Partner 1: {{profitShare1}}%
Partner 2: {{profitShare2}}%

3. MANAGEMENT
{{management}}

4. GOVERNING LAW
{{jurisdiction}}

IN WITNESS WHEREOF, the Partners have executed this Agreement.

_________________________                    _________________________
{{partner1}}                                 {{partner2}}
Date: _______________                        Date: _______________
    `,
  },
}

export default function ContractGenerator() {
  const [templateKey, setTemplateKey] = useState<keyof typeof TEMPLATES>('nda')
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [generated, setGenerated] = useState(false)

  useEffect(() => {
    const template = TEMPLATES[templateKey]
    const defaults: Record<string, string> = {}
    template.fields.forEach(f => {
      defaults[f.key] = f.type === 'number' ? '0' : f.type === 'date' ? new Date().toISOString().split('T')[0] : ''
    })
    setFormData(defaults)
    setGenerated(false)
  }, [templateKey])

  const handleChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const generate = () => {
    setGenerated(true)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const template = TEMPLATES[templateKey]
  const document = useMemo(() => {
    let doc = template.template
    Object.entries(formData).forEach(([key, value]) => {
      doc = doc.replace(new RegExp(`{{${key}}}`, 'g'), value || `[${key}]`)
    })
    return doc
  }, [formData])

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>Contract Generator</h3>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 250 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Contract Template</span>
            <select value={templateKey} onChange={e => setTemplateKey(e.target.value as any)}>
              {Object.entries(TEMPLATES).map(([key, t]) => <option key={key} value={key}>{t.name}</option>)}
            </select>
          </label>
        </div>
        <button className="btn" onClick={generate} disabled={generated} style={{ padding: '10px 20px', alignSelf: 'flex-end' }}>
          {generated ? 'Generated ✓' : 'Generate Contract'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <h4 style={{ margin: '0 0 16px' }}>Fill in Details</h4>
          <div style={{ display: 'grid', gap: 12 }}>
            {template.fields.map(field => (
              <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label>{field.label}</label>
                {field.type === 'textarea' ? (
                  <textarea
                    value={formData[field.key] || ''}
                    onChange={e => handleChange(field.key, e.target.value)}
                    rows={3}
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: 8, fontFamily: 'inherit', resize: 'vertical', width: '100%' }}
                  />
                ) : field.type === 'date' ? (
                  <input
                    type="date"
                    value={formData[field.key] || ''}
                    onChange={e => handleChange(field.key, e.target.value)}
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: 8, width: '100%' }}
                  />
                ) : field.type === 'number' ? (
                  <input
                    type="number"
                    value={formData[field.key] || ''}
                    onChange={e => handleChange(field.key, e.target.value)}
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: 8, width: '100%' }}
                  />
                ) : (
                  <input
                    type="text"
                    value={formData[field.key] || ''}
                    onChange={e => handleChange(field.key, e.target.value)}
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: 8, width: '100%' }}
                  />
                )}
              </div>
            ))}
          </div>
          <button className="btn" onClick={() => setGenerated(true)} style={{ marginTop: 16 }}>Generate Contract</button>
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ margin: 0 }}>Generated Contract</h4>
            <button className="btn" onClick={() => copyToClipboard(document)}>Copy to Clipboard</button>
          </div>
          <div style={{
            background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4,
            padding: 16, maxHeight: 500, overflowY: 'auto',
            fontFamily: 'var(--mono)', fontSize: '0.85rem', lineHeight: 1.6, whiteSpace: 'pre-wrap'
          }}>
            {document}
          </div>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Select a template, fill in the variables, and generate. Review carefully before use. Not legal advice — consult an attorney.
      </p>
    </div>
  )
}