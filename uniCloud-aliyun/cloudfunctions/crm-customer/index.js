'use strict'

// ====== 数据库 & 工具 ======
const db = uniCloud.database()
const dbCmd = db.command

const usersCol = db.collection('crm_users')
const customersCol = db.collection('crm_customers')
const logsCol = db.collection('crm_operation_logs')

async function getUserByToken(token) {
  if (!token) return null
  const res = await usersCol.where({ token }).limit(1).get()
  return res.data[0] || null
}

/* ================= 工具函数 ================= */

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
    console.error('[crm-customer] recordLog failed', action, err)
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

function normalizeKeyword(str) {
  return String(str || '').replace(/[\s\u3000]+/g, '').trim()
}

function normalizeStr(str) {
  return String(str || '').replace(/[\s\u3000]+/g, '').trim().toLowerCase()
}

function normalizePhone(phone) {
  const raw = String(phone ?? '').trim()
  const digits = raw.replace(/[^\d]/g, '')
  return digits || raw.replace(/[\s\u3000]+/g, '')
}

function toBoolIsActive(v, def = true) {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  const s = String(v ?? '').trim().toLowerCase()
  if (s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 't') return true
  if (s === 'false' || s === '0' || s === 'no' || s === 'n' || s === 'f') return false
  return def
}

function buildUniqKey(name, phone) {
  const n = normalizeStr(name)
  const p = normalizePhone(phone)
  return `${n}|${p || '_'}`
}

function assertAdmin(user) {
  const ok = user && (user.role === 'admin' || user.is_admin === true)
  if (!ok) {
    const err = new Error('无权限：仅管理员可执行数据修复/导入')
    err.code = 403
    throw err
  }
}

function buildActiveCond(is_active) {
  if (typeof is_active !== 'boolean') return null
  if (is_active === true) {
    return dbCmd.or(
      { is_active: true },
      { is_active: 'TRUE' },
      { is_active: 'true' },
      { is_active: 1 }
    )
  }
  return dbCmd.or(
    { is_active: false },
    { is_active: 'FALSE' },
    { is_active: 'false' },
    { is_active: 0 }
  )
}

/* ================= 主入口 ================= */
exports.main = async (event, context) => {
  const { action, data = {}, token } = event

  // ===== 鉴权 =====
  const user = await getUserByToken(token)
  if (!user) return { code: 401, msg: '未登录或登录已过期' }

  /* =====================================================
   * 1. 列表
   * ===================================================== */
  if (action === 'list') {
    const { keyword = '', is_active, page = 1, pageSize = 50 } = data

    const kw = normalizeKeyword(keyword)
    let where = {}

    if (kw) {
      const regCond = { $regex: escapeRegExp(kw), $options: 'i' }
      const orConds = [
        { name: regCond },
        { short_name: regCond },
        { contact: regCond },
        { phone: regCond }
      ]
      const kwNumber = Number(kw)
      if (!Number.isNaN(kwNumber)) orConds.push({ phone: kwNumber })
      where = { $or: orConds }
    }

    const activeCond = buildActiveCond(is_active)
    const finalWhere = activeCond ? dbCmd.and(where, activeCond) : where

    const p = Math.max(Number(page) || 1, 1)
    const ps = Math.min(Math.max(Number(pageSize) || 50, 1), 200)
    const skip = (p - 1) * ps

    const query = customersCol.where(finalWhere).orderBy('created_at', 'desc')
    const [listRes, countRes] = await Promise.all([
      query.skip(skip).limit(ps).get(),
      customersCol.where(finalWhere).count()
    ])

    return { code: 0, data: listRes.data || [], total: countRes.total, page: p, pageSize: ps }
  }

  /* =====================================================
   * 2. 获取单条
   * ===================================================== */
  if (action === 'get') {
    const { id } = data
    if (!id) return { code: 400, msg: '缺少 id' }

    const res = await customersCol.doc(id).get()
    return { code: 0, data: res.data[0] || null }
  }

  /* =====================================================
   * 3. 创建
   * ===================================================== */
  if (action === 'create') {
    const {
      name, short_name, contact, phone, address,
      default_unit_price, default_price_unit, remark
    } = data

    const nm = String(name || '').trim()
    if (!nm) return { code: 400, msg: '客户名称不能为空' }

    const existRes = await customersCol.where({ name: nm }).limit(1).get()
    if (existRes.data?.length) return { code: 409, msg: '已存在同名客户' }

    const now = Date.now()
    const doc = {
      name: nm,
      short_name: String(short_name || '').trim(),
      contact: String(contact || '').trim(),
      phone: String(phone || '').trim(),
      address: String(address || '').trim(),
      default_unit_price: toNumber(default_unit_price, null),
      default_price_unit: default_price_unit || 'kg',
      remark: String(remark || '').trim(),
      is_active: true,
      created_at: now,
      updated_at: now,
      created_by: user._id,
      updated_by: user._id
    }

    const addRes = await customersCol.add(doc)
    await recordLog(user, 'customer_create', { id: addRes.id, name: nm })

    return { code: 0, id: addRes.id }
  }

  /* =====================================================
   * 4. 更新
   * ===================================================== */
  if (action === 'update') {
    const { id, ...rest } = data
    if (!id) return { code: 400, msg: '缺少 id' }

    const payload = {}

    if ('name' in rest) payload.name = String(rest.name || '').trim()
    if ('short_name' in rest) payload.short_name = String(rest.short_name || '').trim()
    if ('contact' in rest) payload.contact = String(rest.contact || '').trim()
    if ('phone' in rest) payload.phone = String(rest.phone || '').trim()
    if ('address' in rest) payload.address = String(rest.address || '').trim()
    if ('remark' in rest) payload.remark = String(rest.remark || '').trim()
    if ('is_active' in rest) payload.is_active = !!rest.is_active
    if ('default_price_unit' in rest) payload.default_price_unit = rest.default_price_unit || 'kg'
    if ('default_unit_price' in rest) payload.default_unit_price = toNumber(rest.default_unit_price, null)

    payload.updated_at = Date.now()
    payload.updated_by = user._id

    await customersCol.doc(id).update(payload)
    await recordLog(user, 'customer_update', { id })
    return { code: 0 }
  }

  /* =====================================================
   * 5. 删除
   * ===================================================== */
  if (action === 'remove') {
    const { id } = data
    if (!id) return { code: 400, msg: '缺少 id' }

    await customersCol.doc(id).remove()
    await recordLog(user, 'customer_remove', { id })
    return { code: 0 }
  }

  /* =====================================================
   * 6. 联想搜索（重点）
   * ===================================================== */
  if (action === 'suggest') {
    const { keyword = '', limit = 20, debug = false } = data

    const kw = normalizeKeyword(keyword)
    if (!kw) return { code: 0, data: [], debug: debug ? { raw: keyword, kw, reason: 'empty_kw' } : undefined }

    const pageSize = Math.min(Math.max(Number(limit) || 20, 1), 100)

    const pattern = escapeRegExp(kw)
    const regCond = { $regex: pattern, $options: 'i' }

    const where = {
      $or: [
        { name: regCond },
        { short_name: regCond },
        { contact: regCond },
        { phone: regCond }
      ]
    }

    const kwNumber = Number(kw)
    if (!Number.isNaN(kwNumber)) where.$or.push({ phone: kwNumber })

    const res = await customersCol
      .where(where)
      .orderBy('updated_at', 'desc')
      .limit(pageSize)
      .field({ name: 1, short_name: 1, contact: 1, phone: 1, is_active: 1, default_unit_price: 1, default_price_unit: 1 })
      .get()

    return {
      code: 0,
      data: res.data || [],
      debug: debug ? { raw: keyword, kw, limit: pageSize, pattern, where } : undefined
    }
  }

  /* =====================================================
   * 7. 修复数据（一次性/可重复执行）
   * ===================================================== */
  if (action === 'fix') {
    assertAdmin(user)

    const { dryRun = true, batchSize = 200, startAfterId = '' } = data
    const bs = Math.min(Math.max(Number(batchSize) || 200, 50), 500)

    const where = startAfterId ? { _id: dbCmd.gt(startAfterId) } : {}
    const res = await customersCol.where(where).orderBy('_id', 'asc').limit(bs).get()

    const list = res.data || []
    if (!list.length) {
      return { code: 0, msg: 'done', dryRun, scanned: 0, updated: 0, nextAfterId: '' }
    }

    let scanned = 0
    let updated = 0

    const dupMap = new Map()

    for (const doc of list) {
      scanned++

      const next = {}
      const phoneStr = normalizePhone(doc.phone)
      const isActiveBool = toBoolIsActive(doc.is_active, true)

      if (String(doc.phone ?? '') !== phoneStr) next.phone = phoneStr
      if (doc.is_active !== isActiveBool) next.is_active = isActiveBool

      const uk = buildUniqKey(doc.name, phoneStr)
      if (doc.uniq_key !== uk) next.uniq_key = uk

      if (!doc.updated_at) next.updated_at = Date.now()

      if (!dupMap.has(uk)) dupMap.set(uk, [])
      dupMap.get(uk).push(doc._id)

      if (Object.keys(next).length) {
        updated++
        if (!dryRun) {
          await customersCol.doc(doc._id).update({ ...next, updated_at: Date.now() })
        }
      }
    }

    const dups = []
    for (const [uk, ids] of dupMap.entries()) {
      if (ids.length > 1) dups.push({ uniq_key: uk, ids })
    }

    const nextAfterId = list[list.length - 1]._id

    if (!dryRun) {
      await recordLog(user, 'customer_fix_batch', { scanned, updated, nextAfterId })
    }

    return { code: 0, dryRun, scanned, updated, nextAfterId, dups: dups.slice(0, 20) }
  }

  /* =====================================================
   * 8. 幂等导入（upsert）
   * ===================================================== */
  if (action === 'import') {
    assertAdmin(user)

    const { rows = [], dryRun = true, overwrite = false } = data

    if (!Array.isArray(rows) || rows.length === 0) {
      return { code: 0, dryRun, total: 0, created: 0, updated: 0, skipped: 0, errors: [] }
    }

    let created = 0
    let updated = 0
    let skipped = 0
    const errors = []

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] || {}
      try {
        const name = String(r.name || r.customer_name || '').trim()
        if (!name) { skipped++; continue }

        const phone = normalizePhone(r.phone)
        const uniq_key = buildUniqKey(name, phone)

        const payload = {
          name,
          short_name: String(r.short_name || '').trim(),
          contact: String(r.contact || '').trim(),
          phone: String(phone || '').trim(),
          address: String(r.address || '').trim(),
          remark: String(r.remark || '').trim(),
          default_unit_price: toNumber(r.default_unit_price, null),
          default_price_unit: r.default_price_unit || 'kg',
          is_active: toBoolIsActive(r.is_active, true),
          uniq_key,
          updated_at: Date.now(),
          updated_by: user._id
        }

        const existRes = await customersCol.where({ uniq_key }).limit(1).get()
        const exist = existRes.data?.[0]

        if (!exist) {
          if (!dryRun) {
            const now = Date.now()
            await customersCol.add({ ...payload, created_at: now, created_by: user._id })
          }
          created++
        } else {
          const patch = {}
          for (const k of Object.keys(payload)) {
            if (k === 'uniq_key') continue
            const newV = payload[k]
            const oldV = exist[k]

            if (overwrite) {
              if (newV !== '' && newV !== null && typeof newV !== 'undefined' && newV !== oldV) patch[k] = newV
            } else {
              const oldEmpty = oldV === '' || oldV === null || typeof oldV === 'undefined'
              const newHas = newV !== '' && newV !== null && typeof newV !== 'undefined'
              if (oldEmpty && newHas) patch[k] = newV
            }
          }

          if (Object.keys(patch).length) {
            if (!dryRun) {
              await customersCol.doc(exist._id).update({
                ...patch,
                updated_at: Date.now(),
                updated_by: user._id,
                uniq_key
              })
            }
            updated++
          } else {
            skipped++
          }
        }
      } catch (e) {
        errors.push({ rowIndex: i, msg: e?.message || String(e) })
      }
    }

    if (!dryRun) {
      await recordLog(user, 'customer_import', {
        total: rows.length, created, updated, skipped, errors: errors.length
      })
    }

    return { code: 0, dryRun, total: rows.length, created, updated, skipped, errors: errors.slice(0, 50) }
  }

  return { code: 400, msg: '未知 action' }
}
