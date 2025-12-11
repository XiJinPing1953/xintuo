'use strict'

const db = uniCloud.database()
const dbCmd = db.command
const users = db.collection('crm_users')
const vehicles = db.collection('crm_vehicles')
const logs = db.collection('crm_operation_logs')

async function getUserByToken (token) {
  if (!token) return null
  const res = await users.where({ token }).limit(1).get()
  return res.data[0] || null
}

function isAdminUser (user) {
  // 兼容历史数据：未设置 role 的老账号默认视为管理员
  if (!user || typeof user.role === 'undefined' || user.role === null) return true
  return user.role === 'admin' || user.role === 'superadmin'
}

async function recordLog (user, action, detail = {}) {
  try {
    await logs.add({
      user_id: user?._id || null,
      username: user?.username || '',
      role: user?.role || '',
      action,
      detail,
      created_at: Date.now()
    })
  } catch (err) {
    console.error('[crm-vehicle] recordLog failed', action, err)
  }
}

function normalizePlate (plate) {
  if (typeof plate === 'undefined' || plate === null) return undefined
  const cleaned = plate.toString().trim().toUpperCase()
  if (!cleaned) return undefined
  const pattern = /^[A-Z0-9\u4E00-\u9FA5-]{5,10}$/
  if (!pattern.test(cleaned)) return null
  return cleaned.slice(0, 10)
}

function normalizeText (val) {
  if (typeof val === 'undefined' || val === null) return undefined
  return val.toString().trim()
}

function normalizeDateText (val) {
  if (typeof val === 'undefined' || val === null) return undefined
  const text = val.toString().trim()
  if (!text) return undefined
  return text.slice(0, 32)
}

function normalizeMaintainLogs (logs = []) {
  if (!Array.isArray(logs)) return { list: [], total: 0 }

  const normalized = []
  let total = 0

  logs.slice(0, 300).forEach((row) => {
    const date = normalizeText(row.date) || ''
    const project = normalizeText(row.project) || ''
    if (!date || !project) return

    const part = normalizeText(row.part) || ''
    const staff = normalizeText(row.staff) || ''
    const remark = normalizeText(row.remark) || ''

    const unitPrice = Number(row.unit_price)
    const qtyRaw = Number(row.quantity)
    const quantity = Number.isNaN(qtyRaw) || qtyRaw <= 0 ? 1 : qtyRaw

    const amountRaw = Number(row.amount)
    const fallbackAmount = Number.isNaN(unitPrice) ? 0 : unitPrice * quantity
    const amount = Number.isNaN(amountRaw) ? fallbackAmount : amountRaw

    const mileage = normalizeText(row.mileage) || ''

    const doc = {
      date,
      project,
      part,
      unit_price: Number.isNaN(unitPrice) ? 0 : Number(unitPrice.toFixed(2)),
      quantity,
      amount: Number(amount.toFixed(2)),
      mileage,
      staff,
      remark
    }

    total += doc.amount
    normalized.push(doc)
  })

  return { list: normalized, total: Number(total.toFixed(2)) }
}

exports.main = async (event, context) => {
  const { action, data = {}, token } = event

  // =====================================
  // 1. 列表 + 搜索（支持关键字 / 站点筛选）
  // =====================================

  if (action === 'list') {
    const user = await getUserByToken(token)
    if (!user) {
      return { code: 401, msg: '未登录或登录已过期' }
    }

    const keyword = normalizeText(data.keyword) || ''
    const stationId = normalizeText(data.station_id) || ''
    const page = Number(data.page) > 0 ? Number(data.page) : 1
    const rawPageSize = Number(data.pageSize)
    const pageSize = rawPageSize > 0 && rawPageSize <= 200 ? rawPageSize : 200

    const where = {}
    if (stationId) where.station_id = stationId

    if (keyword) {
      const reg = new RegExp(keyword, 'i')
      where.$or = [
        { plate_no: reg },
        { name: reg }
      ]
    }

    const skip = (page - 1) * pageSize
    const query = vehicles.where(where).orderBy('created_at', 'asc')

    const [listRes, countRes] = await Promise.all([
      query.skip(skip).limit(pageSize).get(),
      vehicles.where(where).count()
    ])

    const dataList = (listRes.data || []).map((doc) => {
      const { list, total } = normalizeMaintainLogs(doc.maintain_logs || [])
      return {
        ...doc,
        maintain_logs: list,
        maintain_total_amount: total,
        maintain_times: list.length
      }
    })

    return {
      code: 0,
      data: dataList,
      total: countRes.total,
      page,
      pageSize
    }
  }

  if (action === 'detail') {
    const user = await getUserByToken(token)
    if (!user) {
      return { code: 401, msg: '未登录或登录已过期' }
    }

    if (!data.id) return { code: 400, msg: '缺少 id' }

    const res = await vehicles.doc(data.id).get()
    const doc = res.data[0]
    if (!doc) return { code: 404, msg: '车辆不存在或已删除' }

    const { list, total } = normalizeMaintainLogs(doc.maintain_logs || [])
    await recordLog(user, 'vehicle_detail', { id: data.id })

    return {
      code: 0,
      data: {
        ...doc,
        maintain_logs: list,
        maintain_total_amount: total,
        maintain_times: list.length
      }
    }
  }

  // =====================================
  // 2. 下面这些需要登录：create / update / remove
  // =====================================
  const user = await getUserByToken(token)
  if (!user) {
    return { code: 401, msg: '未登录或登录已过期' }
  }

  if (['create', 'update', 'remove'].includes(action) && !isAdminUser(user)) {
    return { code: 403, msg: '无权限操作' }
  }

  if (action === 'create') {
    const plate = normalizePlate(data.plate_no)
    if (!plate) return { code: 400, msg: '车牌号必填或格式不正确' }

    const now = Date.now()
    const doc = {
      plate_no: plate,
      name: normalizeText(data.name) || '',
      type: normalizeText(data.type) || '',
      station_id: normalizeText(data.station_id) || '',
      status: data.status || '在用',
      insurance_due_date: normalizeDateText(data.insurance_due_date) || '',
      inspection_due_date: normalizeDateText(data.inspection_due_date) || '',
      remark: normalizeText(data.remark) || '',
      maintain_logs: [],
      maintain_times: 0,
      maintain_total_amount: 0,
      created_at: now,
      updated_at: now,
      created_by: user._id,
      updated_by: user._id
    }

    const res = await vehicles.add(doc)
    await recordLog(user, 'vehicle_create', { id: res.id, plate_no: plate })

    return { code: 0, msg: 'created', id: res.id }
  }

  if (action === 'update') {
    const { id, ...rest } = data
    if (!id) return { code: 400, msg: '缺少 id' }

    const payload = {}

    if (typeof rest.plate_no !== 'undefined') {
      const plate = normalizePlate(rest.plate_no)
      if (!plate) return { code: 400, msg: '车牌号必填或格式不正确' }
      payload.plate_no = plate
    }

    if (typeof rest.name !== 'undefined') {
      payload.name = normalizeText(rest.name) || ''
    }

    if (typeof rest.type !== 'undefined') {
      payload.type = normalizeText(rest.type) || ''
    }

    if (typeof rest.station_id !== 'undefined') {
      payload.station_id = normalizeText(rest.station_id) || ''
    }

    if (typeof rest.status !== 'undefined') {
      payload.status = rest.status || '在用'
    }

    if (typeof rest.insurance_due_date !== 'undefined') {
      payload.insurance_due_date = normalizeDateText(rest.insurance_due_date) || ''
    }

    if (typeof rest.inspection_due_date !== 'undefined') {
      payload.inspection_due_date = normalizeDateText(rest.inspection_due_date) || ''
    }

    if (typeof rest.remark !== 'undefined') {
      payload.remark = normalizeText(rest.remark) || ''
    }

    if (typeof rest.maintain_logs !== 'undefined') {
      const { list, total } = normalizeMaintainLogs(rest.maintain_logs)
      payload.maintain_logs = list
      payload.maintain_total_amount = total
      payload.maintain_times = list.length
    }

    payload.updated_at = Date.now()
    payload.updated_by = user._id

    await vehicles.doc(id).update(payload)
    await recordLog(user, 'vehicle_update', { id, plate_no: payload.plate_no || undefined })

    return { code: 0, msg: 'updated' }
  }

  if (action === 'remove') {
    if (!data.id) return { code: 400, msg: '缺少 id' }

    await vehicles.doc(data.id).remove()
    await recordLog(user, 'vehicle_remove', { id: data.id })

    return { code: 0, msg: 'removed' }
  }

  return { code: 400, msg: '未知 action' }
}