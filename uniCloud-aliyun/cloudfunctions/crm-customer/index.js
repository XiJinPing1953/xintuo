'use strict'

// ====== 数据库 & 工具 ======
const db = uniCloud.database()
const dbCmd = db.command

const usersCol = db.collection('crm_users')
const customersCol = db.collection('crm_customers')
const logsCol = db.collection('crm_operation_logs')

async function getUserByToken (token) {
  if (!token) return null
  const res = await usersCol.where({ token }).limit(1).get()
  return res.data[0] || null
}

async function recordLog (user, action, detail = {}) {
  try {
    await logsCol.add({
      user_id: user?._id || null,
      username: user?.username || '',
      role: user?.role || '',
      action,
      detail,
      created_at: Date.now()
    })
  } catch (err) {
    console.error('[crm-customer] recordLog failed', action, err)
  }
}

function toNumber (v, def = null) {
  if (v === '' || v === null || typeof v === 'undefined') return def
  const n = Number(v)
  return Number.isNaN(n) ? def : n
}

exports.main = async (event, context) => {
  const { action, data = {}, token } = event

  // ===== 鉴权 =====
  const user = await getUserByToken(token)
  if (!user) {
    return { code: 401, msg: '未登录或登录已过期' }
  }

  // =========================
  // 1. 列表（管理页 + 其它页面公用）
  // =========================
  if (action === 'list') {
    const {
      keyword = '',
      is_active,         // true / false / undefined
      page = 1,
      pageSize = 50
    } = data

    const where = {}

    const kw = (keyword || '').trim()
    if (kw) {
      // 简单模糊：按名称 / 联系人 / 电话 搜索
      where.$or = [
        { name: new RegExp(kw) },
        { short_name: new RegExp(kw) },
        { contact: new RegExp(kw) },
        { phone: new RegExp(kw) }
      ]
    }

    if (typeof is_active === 'boolean') {
      where.is_active = is_active
    }

    const skip = (page - 1) * pageSize

    const query = customersCol.where(where).orderBy('created_at', 'desc')

    const [listRes, countRes] = await Promise.all([
      query.skip(skip).limit(pageSize).get(),
      customersCol.where(where).count()
    ])

    return {
      code: 0,
      data: listRes.data || [],
      total: countRes.total,
      page,
      pageSize
    }
  }

  // =========================
  // 2. 获取单条
  // =========================
  if (action === 'get') {
    const { id } = data
    if (!id) return { code: 400, msg: '缺少 id' }

    const res = await customersCol.doc(id).get()
    return { code: 0, data: res.data[0] || null }
  }

  // =========================
  // 3. 创建（管理页用）
  // =========================
  if (action === 'create') {
    const {
      name,
      short_name,
      contact,
      phone,
      address,
      default_unit_price,
      default_price_unit,
      remark
    } = data

    const nm = (name || '').trim()
    if (!nm) return { code: 400, msg: '客户名称不能为空' }

    // 简单防重复
    const existRes = await customersCol.where({ name: nm }).limit(1).get()
    if (existRes.data && existRes.data.length > 0) {
      return { code: 409, msg: '已存在同名客户，如需修改请编辑' }
    }

    const now = Date.now()
    const doc = {
      name: nm,
      short_name: (short_name || '').trim(),
      contact: (contact || '').trim(),
      phone: (phone || '').trim(),
      address: (address || '').trim(),
      default_unit_price: toNumber(default_unit_price, null),
      default_price_unit: default_price_unit || 'kg', // kg / bottle
      remark: (remark || '').trim(),
      is_active: true,
      created_at: now,
      updated_at: now,
      created_by: user._id,
      updated_by: user._id
    }

    const addRes = await customersCol.add(doc)
    await recordLog(user, 'customer_create', { id: addRes.id, name: nm })
    return { code: 0, msg: 'created', id: addRes.id }
  }

  // =========================
  // 4. 更新
  // =========================
  if (action === 'update') {
    const { id, ...rest } = data
    if (!id) return { code: 400, msg: '缺少 id' }

    const payload = {}

    if (typeof rest.name !== 'undefined') {
      const nm = (rest.name || '').trim()
      if (!nm) return { code: 400, msg: '客户名称不能为空' }
      payload.name = nm
    }

    if (typeof rest.short_name !== 'undefined') {
      payload.short_name = (rest.short_name || '').trim()
    }

    if (typeof rest.contact !== 'undefined') {
      payload.contact = (rest.contact || '').trim()
    }

    if (typeof rest.phone !== 'undefined') {
      payload.phone = (rest.phone || '').trim()
    }

    if (typeof rest.address !== 'undefined') {
      payload.address = (rest.address || '').trim()
    }

    if (typeof rest.default_unit_price !== 'undefined') {
      payload.default_unit_price = toNumber(rest.default_unit_price, null)
    }

    if (typeof rest.default_price_unit !== 'undefined') {
      payload.default_price_unit = rest.default_price_unit || 'kg'
    }

    if (typeof rest.remark !== 'undefined') {
      payload.remark = (rest.remark || '').trim()
    }

    if (typeof rest.is_active !== 'undefined') {
      payload.is_active = !!rest.is_active
    }

    payload.updated_at = Date.now()
    payload.updated_by = user._id

    await customersCol.doc(id).update(payload)
    await recordLog(user, 'customer_update', { id, name: payload.name })
    return { code: 0, msg: 'updated' }
  }

  // =========================
  // 5. 删除
  // =========================
  if (action === 'remove') {
    const { id } = data
    if (!id) return { code: 400, msg: '缺少 id' }

    await customersCol.doc(id).remove()
    await recordLog(user, 'customer_remove', { id })
    return { code: 0, msg: 'removed' }
  }

  // 未知 action
  return { code: 400, msg: '未知 action' }
}