'use strict';
const crypto = require('crypto')
const db = uniCloud.database()
const users = db.collection('crm_users')
const logs = db.collection('crm_operation_logs')

const SUPERADMIN_USERNAME = 'superadmin'
const SUPERADMIN_PASSWORD = 'y7ez5CGAbivZkeP'

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
    console.error('[crm-auth] recordLog failed', action, err)
  }
}

function hashPassword(pwd) {
  return crypto.createHash('sha256').update(pwd).digest('hex')
}

async function ensureSuperAdmin() {
  const existing = await users.where({ username: SUPERADMIN_USERNAME }).limit(1).get()
  if (existing.data && existing.data.length) return existing.data[0]

  const doc = {
    username: SUPERADMIN_USERNAME,
    password_hash: hashPassword(SUPERADMIN_PASSWORD),
    role: 'superadmin',
    created_at: Date.now()
  }
  const res = await users.add(doc)
  return { _id: res.id, ...doc }
}

async function getUserByToken(token) {
  if (!token) return null
  const res = await users.where({ token }).limit(1).get()
  return res.data[0] || null
}

exports.main = async (event, context) => {
  const { action, data = {} } = event

  // 确保超级管理员存在（幂等）
  try {
    await ensureSuperAdmin()
  } catch (err) {
    console.error('[crm-auth] ensureSuperAdmin failed', err)
  }

  if (action === 'registerAdmin') {
    // 允许在仅有超级管理员的情况下初始化首个管理员
    const countRes = await users.where({ username: db.command.neq(SUPERADMIN_USERNAME) }).count()
    if (countRes.total > 0) {
      return { code: 400, msg: '已存在用户，不能重复初始化' }
    }
    const { username, password } = data
    if (!username || !password) return { code: 400, msg: '缺少账号或密码' }

    const doc = {
      username,
      password_hash: hashPassword(password),
      role: 'admin',
      created_at: Date.now()
    }
    const insertRes = await users.add(doc)

    await recordLog({ _id: insertRes.id, username, role: 'admin' }, 'register_admin', {})

    return { code: 0, msg: '管理员创建成功', data: { _id: insertRes.id } }
  }

  if (action === 'login') {
    const { username, password } = data
    const res = await users
      .where({
        username,
        password_hash: hashPassword(password)
      })
      .get()

    const user = res.data[0]
    if (!user) return { code: 400, msg: '账号或密码错误' }

    const newToken = crypto.randomBytes(16).toString('hex')
    await users.doc(user._id).update({ token: newToken })

    await recordLog(user, 'login', {})

    delete user.password_hash
    user.token = newToken // ✅ 把最新 token 放到返回的 user 里

    return { code: 0, token: newToken, user }
  }

  if (action === 'listUsers') {
    const user = await getUserByToken(event.token)
    if (!user) return { code: 401, msg: '未登录或登录已过期' }
    if (user.role !== 'superadmin') return { code: 403, msg: '仅超级管理员可操作' }

    const res = await users.get()
    const dataList = (res.data || []).map((u) => {
      const { password_hash, token, ...rest } = u
      return rest
    })
    await recordLog(user, 'list_users', {})

    return { code: 0, data: dataList }
  }

  if (action === 'createUser') {
    const user = await getUserByToken(event.token)
    if (!user) return { code: 401, msg: '未登录或登录已过期' }
    if (user.role !== 'superadmin') return { code: 403, msg: '仅超级管理员可操作' }

    const { username, password, role = 'user' } = data || {}
    if (!username || !password) return { code: 400, msg: '缺少账号或密码' }
    if (!['superadmin', 'admin', 'user'].includes(role)) {
      return { code: 400, msg: '角色不合法' }
    }
    if (username === SUPERADMIN_USERNAME) {
      return { code: 400, msg: '无法新增同名账号' }
    }

    const exists = await users.where({ username }).limit(1).get()
    if (exists.data && exists.data.length) {
      return { code: 400, msg: '账号已存在' }
    }

    const now = Date.now()
    const doc = {
      username,
      password_hash: hashPassword(password),
      role,
      created_at: now,
      updated_at: now
    }

    const res = await users.add(doc)
    await recordLog(user, 'create_user', { id: res.id, username, role })

    return { code: 0, msg: '创建成功', data: { _id: res.id } }
  }

  if (action === 'removeUser') {
    const user = await getUserByToken(event.token)
    if (!user) return { code: 401, msg: '未登录或登录已过期' }
    if (user.role !== 'superadmin') return { code: 403, msg: '仅超级管理员可操作' }

    const { userId } = data || {}
    if (!userId) return { code: 400, msg: '缺少用户 ID' }

    const target = await users.doc(userId).get()
    const targetDoc = (target && target.data && target.data[0]) || null
    if (!targetDoc) return { code: 404, msg: '用户不存在' }
    if (targetDoc.username === SUPERADMIN_USERNAME) {
      return { code: 400, msg: '不能删除超级管理员' }
    }

    await users.doc(userId).remove()
    await recordLog(user, 'remove_user', { id: userId, username: targetDoc.username })

    return { code: 0, msg: '已删除用户' }
  }

  if (action === 'updateRole') {
    const user = await getUserByToken(event.token)
    if (!user) return { code: 401, msg: '未登录或登录已过期' }
    if (user.role !== 'superadmin') return { code: 403, msg: '仅超级管理员可操作' }

    const { userId, role } = data
    if (!userId || !role) return { code: 400, msg: '缺少用户或角色' }
    if (role !== 'admin' && role !== 'user' && role !== 'superadmin') {
      return { code: 400, msg: '角色不合法' }
    }
    await users.doc(userId).update({ role })

    await recordLog(user, 'update_role', { target: userId, role })
    return { code: 0, msg: '角色已更新' }
  }

  return { code: 400, msg: '未知 action' }
}