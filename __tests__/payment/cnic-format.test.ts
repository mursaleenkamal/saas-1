import { describe, it, expect } from 'vitest'
import { formatCNIC, isValidCNIC } from '@/lib/utils'

describe('Pakistani CNIC Auto Formatting', () => {
  it('formats raw 13 digits without dashes automatically', () => {
    expect(formatCNIC('4210112345671')).toBe('42101-1234567-1')
  })

  it('formats partial input as user types', () => {
    expect(formatCNIC('42101')).toBe('42101')
    expect(formatCNIC('421011')).toBe('42101-1')
    expect(formatCNIC('421011234567')).toBe('42101-1234567')
    expect(formatCNIC('4210112345671')).toBe('42101-1234567-1')
  })

  it('strips non-numeric characters and limits to 13 digits', () => {
    expect(formatCNIC('42101-1234567-1')).toBe('42101-1234567-1')
    expect(formatCNIC('42101-ABC-1234567-1')).toBe('42101-1234567-1')
    expect(formatCNIC('421011234567199999')).toBe('42101-1234567-1')
  })

  it('handles empty input', () => {
    expect(formatCNIC('')).toBe('')
  })

  it('validates Pakistani CNIC format correctly', () => {
    expect(isValidCNIC('42101-1234567-1')).toBe(true)
    expect(isValidCNIC('4210112345671')).toBe(false)
    expect(isValidCNIC('42101-123456-1')).toBe(false)
  })
})
