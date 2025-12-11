export function cleanPlateInput(value = '', maxLength = 10) {
  const cleaned = (value || '')
    .toString()
    .replace(/\s+/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\u4E00-\u9FA5-]/g, '')
  return cleaned.slice(0, maxLength)
}

export function normalizePlate(value = '') {
  const plate = (value || '').toString().trim().toUpperCase()
  if (!plate) return ''
  const pattern = /^[A-Z0-9\u4E00-\u9FA5-]{5,10}$/
  if (!pattern.test(plate)) return null
  return plate.slice(0, 10)
}
