'use strict'

// ====== 数据库 & 工具 ======
const db = uniCloud.database()
const dbCmd = db.command

const usersCol = db.collection('crm_users')
const bottlesCol = db.collection('crm_bottles')
const logsCol = db.collection('crm_operation_logs')

async function getUserByToken(token) {
  if (!token) return null
  const res = await usersCol.where({ token }).limit(1).get()
  return res.data[0] || null
}

async function recordLog(user, action, detail = {}) {
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
    console.error('[crm-bottle] recordLog failed', action, err)
  }
}

function toNumber(v, def = null) {
  if (v === '' || v === null || typeof v === 'undefined') return def
  const n = Number(v)
  return Number.isNaN(n) ? def : n
}

function escapeRegExp(str = '') {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 统一状态枚举
const BOTTLE_STATUS = {
  IN_STATION: 'in_station',
  AT_CUSTOMER: 'at_customer',
  REPAIRING: 'repairing',
  SCRAPPED: 'scrapped',
  LOST: 'lost',
  UNKNOWN: 'unknown'
}

/**
 * 瓶号前缀匹配：例如 keyword="20"
 * 则匹配 [20, 20\uffff) 区间
 */
function buildNumberPrefixCondition(keyword) {
  const start = keyword
  const end = keyword + '\uffff'
  return dbCmd.gte(start).lt(end)
}

exports.main = async (event, context) => {
  const {
    action,
    data = {},
    token
  } = event

  // ===== 鉴权 =====
  const user = await getUserByToken(token)
  if (!user) {
    return {
      code: 401,
      msg: '未登录或登录已过期'
    }
  }

  // =========================
  // 0️⃣ 灌装页面专用接口
  // action: listForFilling
  // =========================
  if (action === 'listForFilling') {
    // 灌装页需要：瓶号、铭牌皮重、上次客户、上次回瓶净重、最近灌装信息等
    const res = await bottlesCol
      .field({
        number: 1,
        tare_weight: 1,
        status: 1,
        kind: 1,

        last_customer_name: 1,
        last_out_date: 1,
        last_back_date: 1,

        // 标准字段：上次回瓶净重（kg）
        last_back_net_weight: 1,

        // 最近一次灌装（kg）
        last_fill_date: 1,
        last_fill_tare: 1,
        last_fill_gross: 1,
        last_fill_net: 1,

        // 旧字段：仅为兼容旧页面使用（可以慢慢废弃）
        last_gross_weight: 1,
        last_net_weight: 1,
        next_out_gross: 1,
        next_out_net: 1,
        filling_gross_weight: 1,
        filling_net_weight: 1
      })
      .orderBy('number', 'asc')
      .limit(2000)
      .get()

    return {
      code: 0,
      data: res.data || []
    }
  }

  // =========================
  // 1. 模糊搜索（联想） action: search
  // =========================
  if (action === 'search') {
    const {
      keyword = '',
      status,
      limit = 10,
      include_truck = false
    } = data

    const kw = (keyword || '').trim()
    if (!kw) {
      return {
        code: 0,
        data: []
      }
    }

    const kwUpper = kw.toUpperCase()
    const wantTruck = include_truck === true || kwUpper.startsWith('TRUCK-')

    const kindCond = wantTruck
      ? dbCmd.or(dbCmd.eq('bottle'), dbCmd.eq('truck'), dbCmd.exists(false))
      : dbCmd.or(dbCmd.eq('bottle'), dbCmd.exists(false))

    const where = {
      number: new RegExp(escapeRegExp(kw), 'i'),
      kind: kindCond
    }

    if (status) where.status = status

    const res = await bottlesCol
      .where(where)
      .field({
        number: 1,
        tare_weight: 1,
        status: 1,
        kind: 1
      })
      .orderBy('number', 'asc')
      .limit(limit)
      .get()

    return {
      code: 0,
      data: res.data || []
    }
  }

  // =========================
  // 1.5 模糊搜索（联想版） action: suggest
  // =========================
  if (action === 'suggest') {
    const { keyword = '', limit = 20, include_truck = false } = data
    const kw = (keyword || '').trim()
    if (!kw) {
      return { code: 0, data: [] }
    }

    const pageSize = Math.min(Math.max(Number(limit) || 20, 1), 100)
    const regCond = { $regex: escapeRegExp(kw), $options: 'i' }
    const wantTruck = include_truck === true || kw.toUpperCase().startsWith('TRUCK-')
    const kindCond = wantTruck
      ? dbCmd.or(dbCmd.eq('bottle'), dbCmd.eq('truck'), dbCmd.exists(false))
      : dbCmd.or(dbCmd.eq('bottle'), dbCmd.exists(false))
    const where = { number: regCond, kind: kindCond }

    const res = await bottlesCol
      .where(where)
      .field({ number: 1, status: 1, customer_id: 1, kind: 1 })
      .orderBy('number', 'asc')
      .limit(pageSize)
      .get()

    return { code: 0, data: res.data || [] }
  }

  // =========================
  // 2. 精确按瓶号获取 action: getByNumber
  // =========================
  if (action === 'getByNumber') {
    const { number } = data
    const no = (number || '').trim()
    if (!no) {
      return {
        code: 400,
        msg: 'number 必填'
      }
    }

    const res = await bottlesCol.where({ number: no }).limit(1).get()
    return {
      code: 0,
      data: res.data[0] || null
    }
  }

  // =========================
  // 3. quickCreate（从灌装 / 销售自动建档）
  // =========================
  if (action === 'quickCreate') {
    const {
      number,
      tare_weight,
      status,
      kind
    } = data
    const no = (number || '').trim()
    if (!no) {
      return {
        code: 400,
        msg: 'number 必填'
      }
    }

    // 已存在？直接返回
    const exist = await bottlesCol.where({ number: no }).limit(1).get()
    if (exist.data && exist.data.length) {
      const existed = exist.data[0]
      const shouldTruck = no.toUpperCase().startsWith('TRUCK-')
      if (shouldTruck && existed.kind !== 'truck') {
        await bottlesCol.doc(existed._id).update({
          kind: 'truck',
          updated_at: Date.now(),
          updated_by: user._id
        })
        existed.kind = 'truck'
      }
      return {
        code: 0,
        msg: 'exists',
        id: existed._id,
        data: existed
      }
    }

    const isTruck = no.toUpperCase().startsWith('TRUCK-')
    const finalKind = isTruck ? 'truck' : (kind || 'bottle')

    const now = Date.now()
    const doc = {
      number: no,
      tare_weight: toNumber(tare_weight, null),
      status: status || BOTTLE_STATUS.IN_STATION,
      kind: finalKind,
      remark: '',

      // 旧字段（逐步废弃，但保留以兼容旧逻辑）
      last_gross_weight: null,
      last_net_weight: null,
      filling_gross_weight: null,
      filling_net_weight: null,
      last_return_diff: null,
      next_out_gross: null,
      next_out_net: null,

      // 新字段：标准回瓶净重
      last_back_net_weight: null,

      // 灌装信息
      last_fill_date: null,
      last_fill_tare: null,
      last_fill_gross: null,
      last_fill_net: null,

      // 客户 & 出回瓶日期
      last_customer_id: null,
      last_customer_name: null,
      last_out_date: null,
      last_back_date: null,

      created_at: now,
      updated_at: now,
      created_by: user._id,
      updated_by: user._id
    }

    const addRes = await bottlesCol.add(doc)
    await recordLog(user, 'bottle_quick_create', { id: addRes.id, number: no })

    return {
      code: 0,
      msg: 'created',
      id: addRes.id,
      data: {
        _id: addRes.id,
        ...doc
      }
    }
  }

  // =========================
  // 3.1 一次性迁移：补全 kind
  // =========================
  if (action === 'migrateKind') {
    if (user.role !== 'admin') {
      return { code: 403, msg: '仅管理员可执行迁移' }
    }

    const now = Date.now()
    // 1) 缺失 kind 的补齐为 bottle
    const missingKindRes = await bottlesCol.where({ kind: dbCmd.exists(false) }).count()
    let filled = 0
    if (missingKindRes.total > 0) {
      await bottlesCol
        .where({ kind: dbCmd.exists(false) })
        .update({ kind: 'bottle', updated_at: now, updated_by: user._id })
      filled = missingKindRes.total
    }

    // 2) TRUCK-* 强制改为 truck
    const truckCond = {
      number: new RegExp('^TRUCK-', 'i'),
      kind: dbCmd.neq('truck')
    }
    const truckFixRes = await bottlesCol.where(truckCond).count()
    let truckFixed = 0
    if (truckFixRes.total > 0) {
      await bottlesCol
        .where(truckCond)
        .update({ kind: 'truck', updated_at: now, updated_by: user._id })
      truckFixed = truckFixRes.total
    }

    await recordLog(user, 'bottle_migrate_kind', {
      filled_missing: filled,
      truck_fixed: truckFixed
    })

    return {
      code: 0,
      msg: 'ok',
      filled_missing: filled,
      truck_fixed: truckFixed
    }
  }

  // =========================
  // 4. 手动创建（管理用） action: create
  // =========================
  if (action === 'create') {
    const {
      number,
      tare_weight,
      status,
      kind,
      remark
    } = data

    const no = (number || '').trim()
    if (!no) {
      return {
        code: 400,
        msg: '瓶号不能为空'
      }
    }

    // 唯一校验
    const exist = await bottlesCol.where({ number: no }).limit(1).get()
    if (exist.data && exist.data.length) {
      return {
        code: 409,
        msg: '该瓶号已存在，如需修改请使用编辑功能'
      }
    }

    const isTruck = no.toUpperCase().startsWith('TRUCK-')
    const finalKind = isTruck ? 'truck' : (kind || 'bottle')

    const now = Date.now()
    const doc = {
      number: no,
      tare_weight: toNumber(tare_weight, null),
      status: status || BOTTLE_STATUS.IN_STATION,
      kind: finalKind,
      remark: remark || '',

      // 旧字段（逐步废弃）
      last_gross_weight: null,
      last_net_weight: null,
      filling_gross_weight: null,
      filling_net_weight: null,
      last_return_diff: null,
      next_out_gross: null,
      next_out_net: null,

      // 新字段：标准回瓶净重
      last_back_net_weight: null,

      // 灌装信息
      last_fill_date: null,
      last_fill_tare: null,
      last_fill_gross: null,
      last_fill_net: null,

      // 客户 & 出回瓶日期
      last_customer_id: null,
      last_customer_name: null,
      last_out_date: null,
      last_back_date: null,

      created_at: now,
      updated_at: now,
      created_by: user._id,
      updated_by: user._id
    }

    const addRes = await bottlesCol.add(doc)
    await recordLog(user, 'bottle_create', { id: addRes.id, number: no })
    return {
      code: 0,
      msg: 'created',
      id: addRes.id
    }
  }

  // =========================
  // 5. 更新（管理用） action: update
  // =========================
  if (action === 'update') {
    const { id, ...rest } = data
    if (!id) {
      return {
        code: 400,
        msg: '缺少 id'
      }
    }

    const payload = {}

    if (rest.number !== undefined) {
      const no = (rest.number || '').trim()
      if (!no) {
        return {
          code: 400,
          msg: '瓶号不能为空'
        }
      }
      payload.number = no
    }
    if (rest.tare_weight !== undefined) {
      payload.tare_weight = toNumber(rest.tare_weight, null)
    }
    if (rest.status !== undefined) {
      payload.status = rest.status || BOTTLE_STATUS.UNKNOWN
    }
    if (rest.remark !== undefined) {
      payload.remark = rest.remark || ''
    }
    if (rest.kind !== undefined) {
      payload.kind = rest.kind || 'bottle'
    }

    // 可更新的数字字段（旧 + 新）
    const numericFields = [
      'last_gross_weight',
      'last_net_weight',
      'filling_gross_weight',
      'filling_net_weight',
      'last_return_diff',
      'next_out_gross',
      'next_out_net',
      'last_back_net_weight',
      'last_fill_tare',
      'last_fill_gross',
      'last_fill_net'
    ]
    numericFields.forEach(f => {
      if (rest[f] !== undefined) {
        payload[f] = toNumber(rest[f], null)
      }
    })

    // 日期字段
    if (rest.last_fill_date !== undefined) {
      payload.last_fill_date = rest.last_fill_date || null
    }
    if (rest.last_out_date !== undefined) {
      payload.last_out_date = rest.last_out_date || null
    }
    if (rest.last_back_date !== undefined) {
      payload.last_back_date = rest.last_back_date || null
    }

    // 客户字段
    if (rest.last_customer_id !== undefined) {
      payload.last_customer_id = rest.last_customer_id || null
    }
    if (rest.last_customer_name !== undefined) {
      payload.last_customer_name = rest.last_customer_name || null
    }

    payload.updated_at = Date.now()
    payload.updated_by = user._id

    await bottlesCol.doc(id).update(payload)
    await recordLog(user, 'bottle_update', { id, number: payload.number })
    return {
      code: 0,
      msg: 'updated'
    }
  }

  // =========================
  // 6. 删除 action: remove
  // =========================
  if (action === 'remove') {
    const { id } = data
    if (!id) {
      return {
        code: 400,
        msg: '缺少 id'
      }
    }

    await bottlesCol.doc(id).remove()
    await recordLog(user, 'bottle_remove', { id })
    return {
      code: 0,
      msg: 'removed'
    }
  }

  // =========================
  // 7. detail 详情 action: detail
  // =========================
  if (action === 'detail') {
    const { id, number } = data
    let doc = null

    if (id) {
      const res = await bottlesCol.doc(id).get()
      doc = res.data && res.data[0]
    } else if (number) {
      const no = (number || '').trim()
      if (!no) {
        return {
          code: 400,
          msg: 'number 不能为空'
        }
      }
      const res = await bottlesCol.where({ number: no }).limit(1).get()
      doc = res.data && res.data[0]
    } else {
      return {
        code: 400,
        msg: '缺少 id 或 number'
      }
    }

    return {
      code: 0,
      data: doc || null
    }
  }

  // =========================
  // 8. 列表（管理用） action: list
  // =========================
  if (action === 'list') {
    const {
      keyword = '',
      status,
      page = 1,
      pageSize = 50
    } = data

    const where = {}
    const kw = (keyword || '').trim()
    if (kw) {
      where.number = buildNumberPrefixCondition(kw)
    }
    if (status) {
      where.status = status
    }

    const skip = (page - 1) * pageSize
    const query = bottlesCol.where(where).orderBy('number', 'asc')

    const [listRes, countRes] = await Promise.all([
      query.skip(skip).limit(pageSize).get(),
      bottlesCol.where(where).count()
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
  // 9. 回瓶后批量更新瓶子信息
  //    action: updateAfterReturnBatch
  // =========================
  if (action === 'updateAfterReturnBatch') {
    const { items = [] } = data || {}

    if (!Array.isArray(items) || !items.length) {
      return {
        code: 400,
        msg: 'items 不能为空'
      }
    }

    const numbers = items
      .map(it => (it.number || '').trim())
      .filter(Boolean)

    if (!numbers.length) {
      return {
        code: 400,
        msg: '没有有效的瓶号'
      }
    }

    const bottleRes = await bottlesCol.where({
      number: dbCmd.in(numbers)
    }).get()

    const bottleMap = {}
    bottleRes.data &&
      bottleRes.data.forEach(b => {
        if (b && b.number) {
          bottleMap[b.number] = b
        }
      })

    const updates = []
    const anomalies = []
    const now = Date.now()
    const THRESHOLD = 5 // kg

    for (const it of items) {
      const no = (it.number || '').trim()
      const bottle = bottleMap[no]
      if (!bottle) continue

      const returnGross = toNumber(it.return_gross, null)
      const tare =
        bottle.tare_weight != null
          ? toNumber(bottle.tare_weight, null)
          : toNumber(it.return_tare, null)

      if (returnGross == null || tare == null) continue

      // 标准：回瓶净重 = 回瓶毛重 - 铭牌皮重（可能略有正负）
      const diffNet = returnGross - tare

      const updateDoc = {
        // 旧字段：兼容旧逻辑
        last_gross_weight: returnGross,
        last_net_weight: diffNet,
        last_return_diff: diffNet,
        next_out_gross: returnGross,
        next_out_net: diffNet,

        // 新字段：标准上次回瓶净重（灌装/详情/列表都应该优先用这个）
        last_back_net_weight: diffNet,

        status: BOTTLE_STATUS.IN_STATION,
        updated_at: now,
        updated_by: user._id
      }

      updates.push(bottlesCol.doc(bottle._id).update(updateDoc))

      if (Math.abs(diffNet) > THRESHOLD) {
        anomalies.push({
          number: no,
          tare,
          return_gross: returnGross,
          diff_net: diffNet
        })
      }
    }

    if (updates.length) {
      await Promise.all(updates)
    }

    await recordLog(user, 'bottle_batch_return_update', {
      updated: updates.length,
      anomalies: anomalies.length
    })

    return {
      code: 0,
      msg:
        anomalies.length > 0
          ? '已更新瓶子信息，其中部分瓶子回瓶差额异常'
          : '已更新瓶子信息',
      data: {
        updated: updates.length,
        anomalies
      }
    }
  }

  // =========================
  // 未知 action
  // =========================
  return {
    code: 400,
    msg: '未知 action'
  }
}
