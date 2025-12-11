'use strict'

const db = uniCloud.database()
const logs = db.collection('crm_operation_logs')
const users = db.collection('crm_users')

async function getUserByToken(token) {
  if (!token) return null
  const res = await users.where({ token }).limit(1).get()
  return res.data[0] || null
}

exports.main = async (event, context) => {
  const { action, data = {}, token } = event

  if (action === 'list') {
    const user = await getUserByToken(token)
    if (!user) return { code: 401, msg: '未登录或登录已过期' }
    if (user.role !== 'superadmin') return { code: 403, msg: '仅超级管理员可查看操作日志' }

    const page = Number(data.page) || 1
    const pageSize = Math.min(Number(data.pageSize) || 50, 200)
    const skip = (page - 1) * pageSize

    const res = await logs
      .orderBy('created_at', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()

    const countRes = await logs.count()

    return {
      code: 0,
      data: res.data || [],
      total: countRes.total,
      page,
      pageSize
    }
  }

  return { code: 400, msg: '未知 action' }
}
