'use strict'

// ====== 数据库 & 工具 ======
const db = uniCloud.database()
const users = db.collection('crm_users')
const delivery = db.collection('crm_delivery_men')
const logs = db.collection('crm_operation_logs')

/**
 * 根据 token 获取用户
 */
async function getUserByToken(token) {
  if (!token) return null
  const res = await users.where({ token }).limit(1).get()
  return res.data[0] || null
}

async function recordLog(user, action, detail = {}) {
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
    console.error('[crm-delivery] recordLog failed', action, err)
  }
}

exports.main = async (event, context) => {
  const { action, data = {}, token } = event

  // =========================
  // 1. 列表查询（不强制登录）
  //    用于下拉框、管理页读取
  // =========================
  if (action === 'list') {
    const res = await delivery
      .orderBy('created_at', 'asc')
      .get()

    return {
      code: 0,
      data: res.data || []
    }
  }

  // =========================
  // 2. 下面这些操作需要登录
  // =========================
  const user = await getUserByToken(token)
  if (!user) {
    return { code: 401, msg: '未登录或登录已过期' }
  }

  // =========================
  // 3. 获取单个配送员详情（编辑时用）
  // =========================
  if (action === 'get') {
    const { id } = data
    if (!id) {
      return { code: 400, msg: '缺少 id' }
    }

    const res = await delivery.doc(id).get()
    return {
      code: 0,
      data: (res.data && res.data[0]) || null
    }
  }

  // =========================
  // 4. 创建配送员
  // =========================
  if (action === 'create') {
    if (!data.name) {
      return { code: 400, msg: '姓名必填' }
    }

    const phone = data.phone || data.mobile || ''

    const now = Date.now()
    const doc = {
      name: data.name,
      phone,
      mobile: phone,
      status: data.status || '在职', // 在职 / 离职 / 其他
      remark: data.remark || '',
      created_at: now,
      created_by: user._id,
      updated_at: now,
      updated_by: user._id
    }

    const res = await delivery.add(doc)
    await recordLog(user, 'delivery_create', { id: res.id, name: data.name, phone })
    return {
      code: 0,
      msg: 'created',
      id: res.id
    }
  }

  // =========================
  // 5. 更新配送员
  // =========================
  if (action === 'update') {
    const { id, ...rest } = data
    if (!id) {
      return { code: 400, msg: '缺少 id' }
    }

    const payload = {}

    if (typeof rest.name !== 'undefined') {
      if (!rest.name) {
        return { code: 400, msg: '姓名不能为空' }
      }
      payload.name = rest.name
    }

    if (typeof rest.phone !== 'undefined' || typeof rest.mobile !== 'undefined') {
      const phone = rest.phone || rest.mobile || ''
      payload.phone = phone
      payload.mobile = phone
    }

    if (typeof rest.status !== 'undefined') {
      payload.status = rest.status || '在职'
    }

    if (typeof rest.remark !== 'undefined') {
      payload.remark = rest.remark || ''
    }

    payload.updated_at = Date.now()
    payload.updated_by = user._id

    await delivery.doc(id).update(payload)
    await recordLog(user, 'delivery_update', { id, name: payload.name, phone: payload.phone })

    return {
      code: 0,
      msg: 'updated'
    }
  }

  // =========================
  // 6. 删除配送员
  // =========================
  if (action === 'remove') {
    const { id } = data
    if (!id) {
      return { code: 400, msg: '缺少 id' }
    }

    await delivery.doc(id).remove()
    await recordLog(user, 'delivery_remove', { id })

    return {
      code: 0,
      msg: 'removed'
    }
  }

  // =========================
  // 7. 未知 action
  // =========================
  return { code: 400, msg: '未知 action' }
}