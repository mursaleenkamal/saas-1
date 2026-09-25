/**
 * lib/payment/pakistan-qr.ts
 *
 * Generates payment QR codes and payloads for Pakistan:
 * - Raast (State Bank of Pakistan EMVCo QR Standard)
 * - JazzCash (Mobile Account / Merchant)
 * - EasyPaisa (Mobile Account / Merchant)
 *
 * Scannable by all Pakistani bank apps (Meezan, HBL, Alfalah, UBL, etc.)
 * and wallet apps (JazzCash, EasyPaisa, NayaPay, SadaPay).
 */

export type PakistanPaymentProvider = 'jazzcash' | 'easypaisa' | 'raast' | 'bank'

export interface PakistanPaymentDetails {
  provider: PakistanPaymentProvider
  accountNumber: string // Mobile number or IBAN or Raast ID
  accountTitle: string  // Merchant / Gym name
  amount: number        // PKR
  city?: string         // City name
  reference?: string    // Member ID or Name e.g. "GF0001 - Ali"
}

/**
 * Calculates standard CRC-16/CCITT (polynomial 0x1021, init 0xFFFF).
 * Required by EMVCo / SBP Raast QR specification.
 */
export function crc16Ccitt(str: string): string {
  let crc = 0xffff
  for (let c = 0; c < str.length; c++) {
    crc ^= str.charCodeAt(c) << 8
    for (let i = 0; i < 8; i++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff
      } else {
        crc = (crc << 1) & 0xffff
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/**
 * Formats an EMVCo TLV (Tag-Length-Value) field.
 */
export function emvTag(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0')
  return `${id}${len}${value}`
}

/**
 * Generates an official EMVCo QR payload compliant with State Bank of Pakistan (SBP) Raast.
 *
 * When scanned by any Pakistani banking app (HBL, Meezan, Alfalah, etc.)
 * or digital wallet (JazzCash, EasyPaisa, SadaPay, NayaPay) Raast scanner:
 * - Auto-fetches the account title
 * - Auto-fills the Raast ID / account number
 * - Auto-fills the exact payment amount in PKR
 */
export function generateRaastEMVCoQR(params: {
  raastId: string
  merchantName: string
  amount: number
  city?: string
  reference?: string
}): string {
  // Normalize phone / Raast ID (digits only or IBAN)
  let cleanId = params.raastId.trim().replace(/\s+/g, '')
  if (/^03\d{9}$/.test(cleanId)) {
    // Internationalize 03001234567 to 923001234567 for Raast standard compatibility
    cleanId = '92' + cleanId.slice(1)
  }

  const name = (params.merchantName || 'GymFlow Merchant').trim().slice(0, 25)
  const city = (params.city || 'Karachi').trim().slice(0, 15)
  const amtStr = params.amount > 0 ? params.amount.toFixed(2) : '0.00'
  const ref = (params.reference || 'GymFlow').trim().slice(0, 25)

  // Tag 26: Raast Merchant Account Information (GUI: pk.gov.sbp.raast)
  const tag26Sub = emvTag('00', 'pk.gov.sbp.raast') + emvTag('01', cleanId)
  const tag26 = emvTag('26', tag26Sub)

  // Tag 62: Additional Data (Bill/Reference)
  const tag62Sub = emvTag('01', ref) + emvTag('05', ref)
  const tag62 = emvTag('62', tag62Sub)

  const payloadWithoutCrc =
    emvTag('00', '01') + // Payload Format Indicator (01)
    emvTag('01', '12') + // Point of Initiation: Dynamic QR with amount (12)
    tag26 +              // Raast Merchant Info
    emvTag('52', '7997') + // MCC: Clubs / Gyms
    emvTag('53', '586') +  // Currency: PKR (ISO 586)
    (params.amount > 0 ? emvTag('54', amtStr) : '') + // Amount
    emvTag('58', 'PK') +   // Country Code: Pakistan
    emvTag('59', name) +   // Payee / Merchant Name
    emvTag('60', city) +   // City
    tag62 +                // Additional Data
    '6304'                 // CRC tag + length

  const checksum = crc16Ccitt(payloadWithoutCrc)
  return payloadWithoutCrc + checksum
}

/**
 * Builds the optimal QR code string for the given provider:
 * - Raast / Bank / JazzCash / EasyPaisa (Raast EMVCo standard payload)
 * All Pakistani banks and wallets scan Raast EMVCo QR codes natively.
 */
export function buildPakistanQRString(details: PakistanPaymentDetails): string {
  return generateRaastEMVCoQR({
    raastId: details.accountNumber,
    merchantName: details.accountTitle,
    amount: details.amount,
    city: details.city,
    reference: details.reference,
  })
}

/**
 * Renders any payment string to a high-resolution PNG Data URL.
 */
export async function generatePaymentQRCode(text: string, size = 280): Promise<string> {
  const QRCode = (await import('qrcode')).default
  return await QRCode.toDataURL(text, {
    width: size,
    margin: 2,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'M',
  })
}
