export const PROJECT_OPTIONS = {
  fuel: ['汽油加注', '柴油加注', '天然气加注', '尿素', '加氟'],
  service: ['保养', '维修', '年检', '更换轮胎', '保险']
}

export function createEmptyMaintainForm(mode = 'fuel') {
  const options = PROJECT_OPTIONS[mode] || []
  return {
    mode,
    date: '',
    project: options[0] || '',
    part: '',
    unitPrice: '',
    quantity: '',
    amount: '',
    mileage: '',
    staff: '',
    remark: ''
  }
}

export function calcAmount({ unitPrice, quantity, amountInput }) {
  const priceNum = Number(unitPrice)
  const qtyNum = Number(quantity)
  const qty = Number.isNaN(qtyNum) || qtyNum <= 0 ? 1 : qtyNum
  const normalizedAmount =
    typeof amountInput === 'string' ? amountInput.trim() : amountInput
  const amountNum = normalizedAmount === '' || normalizedAmount === null || typeof normalizedAmount === 'undefined'
    ? NaN
    : Number(normalizedAmount)
  const fallback = Number.isNaN(priceNum) ? 0 : priceNum * qty
  return Number.isNaN(amountNum) ? fallback : amountNum
}

export function normalizeMaintainEntry(form) {
  const date = (form.date || '').trim()
  const project = (form.project || '').trim()
  if (!date || !project) return null

  const unitPrice = Number(form.unitPrice)
  const qtyNum = Number(form.quantity)
  const quantity = Number.isNaN(qtyNum) || qtyNum <= 0 ? 1 : qtyNum
  const amount = calcAmount({ unitPrice, quantity, amountInput: form.amount })

  return {
    local_id: `maintain-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    date,
    project,
    part: (form.part || '').trim(),
    unit_price: Number.isNaN(unitPrice) ? 0 : Number(unitPrice.toFixed(2)),
    quantity,
    amount: Number(amount.toFixed(2)),
    mileage: (form.mileage || '').trim(),
    staff: (form.staff || '').trim(),
    remark: (form.remark || '').trim()
  }
}

export function formatMaintainMoney(value) {
  const num = Number(value)
  return Number.isNaN(num) ? '0.00' : num.toFixed(2)
}
