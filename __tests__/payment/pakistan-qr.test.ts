import { describe, it, expect } from 'vitest'
import {
  generateRaastEMVCoQR,
  buildPakistanQRString,
  crc16Ccitt,
  emvTag,
  generatePaymentQRCode,
} from '@/lib/payment/pakistan-qr'

describe('Pakistan QR & Raast EMVCo Generator', () => {
  it('correctly calculates CRC16 CCITT checksum', () => {
    // Standard CCITT 16 test vector
    const checksum = crc16Ccitt('123456789')
    expect(checksum).toBe('29B1')
  })

  it('formats EMV TLV tags correctly', () => {
    expect(emvTag('00', '01')).toBe('000201')
    expect(emvTag('53', '586')).toBe('5303586')
  })

  it('generates a valid Raast EMVCo QR code string with SBP standard tags', () => {
    const qrString = generateRaastEMVCoQR({
      raastId: '03001234567',
      merchantName: 'GymFlow Pakistan',
      amount: 6000,
      city: 'Karachi',
      reference: 'GF0001',
    })

    // Verify Payload Format Indicator (000201)
    expect(qrString).toContain('000201')

    // Verify Point of Initiation (010212 dynamic QR with amount)
    expect(qrString).toContain('010212')

    // Verify Raast GUI
    expect(qrString).toContain('pk.gov.sbp.raast')

    // Verify Raast ID internationalized
    expect(qrString).toContain('923001234567')

    // Verify Currency PKR (586)
    expect(qrString).toContain('5303586')

    // Verify Amount
    expect(qrString).toContain('54076000.00')

    // Verify Country PK
    expect(qrString).toContain('5802PK')

    // Verify Merchant Name
    expect(qrString).toContain('GymFlow Pakistan')

    // Verify City
    expect(qrString).toContain('Karachi')

    // Verify ends with 4-character hex CRC
    expect(qrString).toMatch(/6304[0-9A-F]{4}$/)
  })

  it('builds Pakistan QR string for JazzCash and EasyPaisa accounts', () => {
    const jcQr = buildPakistanQRString({
      provider: 'jazzcash',
      accountNumber: '03001234567',
      accountTitle: 'Ali Fitness',
      amount: 4500,
    })
    expect(jcQr).toContain('pk.gov.sbp.raast')
    expect(jcQr).toContain('54074500.00')

    const epQr = buildPakistanQRString({
      provider: 'easypaisa',
      accountNumber: '03451234567',
      accountTitle: 'Iron Gym',
      amount: 3000,
    })
    expect(epQr).toContain('pk.gov.sbp.raast')
    expect(epQr).toContain('54073000.00')
  })

  it('generates a valid QR code base64 Data URL', async () => {
    const dataUrl = await generatePaymentQRCode('00020101021226...', 200)
    expect(dataUrl).toMatch(/^data:image\/png;base64,/)
  })
})
