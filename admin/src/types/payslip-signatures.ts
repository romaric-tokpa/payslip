export type PayslipSignatureRecentRow = {
  id: string
  signedAt: string
  verificationCode: string
  user: {
    firstName: string
    lastName: string
    employeeId: string | null
  }
}

export type PayslipSignatureStatsResponse = {
  total: number
  signed: number
  unsigned: number
  signatureRate: number
  recentSignatures: PayslipSignatureRecentRow[]
}

export type PayslipUnsignedRow = {
  id: string
  userId: string
  periodMonth: number
  periodYear: number
  uploadedAt: string
  user: {
    id: string
    firstName: string
    lastName: string
    employeeId: string | null
    orgDepartment: { name: string } | null
  }
}

export type VerifySignatureResponse =
  | { valid: false }
  | {
      valid: true
      details: {
        employeeName: string
        employeeId: string
        companyName: string
        period: string
        signedAt: string
        fileHash: string
      }
    }
