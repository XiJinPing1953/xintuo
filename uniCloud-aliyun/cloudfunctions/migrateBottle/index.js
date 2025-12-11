'use strict'

const db = uniCloud.database()
const dbCmd = db.command

const usersCol = db.collection('crm_users')
const bottlesCol = db.collection('crm_bottles')

function toNumber(v, def = null) {
  if (v === '' || v === null || typeof v === 'undefined') return def
  const n = Number(v)
  return Number.isNaN(n) ? def : n
}

async function getUserByToken(token) {
  if (!token) return null
  const res = await usersCol.where({ token }).limit(1).get()
  return res.data[0] || null
}

// 允许的状态
const ALLOWED_STATUS = new Set([
  'in_station',
  'at_customer',
  'repairing',
  'scrapped',
  'lost',
  'unknown'
])

exports.main = async (event, context) => {
  const {
    token,
    data = {}
  } = event

  const {
    dryRun = true,   // 默认只是预览，不真正写库
    batchSize = 500, // 每批处理多少条
    fixStatus = true // 是否顺手修一下异常 status
  } = data

  const user = await getUserByToken(token)
  if (!user) {
    return {
      code: 401,
      msg: '未登录或登录已过期'
    }
  }

  // 保险一点：只允许 admin 跑迁移
  if (user.role !== 'admin') {
    return {
      code: 403,
      msg: '只有管理员可以执行瓶子数据迁移'
    }
  }

  let processed = 0
  let updated = 0
  let noTareOrGross = 0
  let alreadyMigrated = 0
  const sampleChanges = [] // 只返回前几十条变更样例

  // 先查总数
  const totalRes = await bottlesCol.where({}).count()
  const total = totalRes.total

  while (processed < total) {
    const pageRes = await bottlesCol
      .where({})
      .skip(processed)
      .limit(batchSize)
      .get()

    const list = pageRes.data || []
    if (!list.length) break

    for (const doc of list) {
      const patch = {}
      let needUpdate = false

      const tare = toNumber(doc.tare_weight, null)
      const lastGross = toNumber(doc.last_gross_weight, null)

      // 1）last_back_net_weight 缺失时，用 last_gross_weight - tare_weight 计算
      const hasBackNet =
        doc.last_back_net_weight !== null &&
        typeof doc.last_back_net_weight !== 'undefined'

      if (!hasBackNet && tare != null && lastGross != null) {
        const diff = lastGross - tare // 回瓶净重（可能略有正负）

        patch.last_back_net_weight = diff
        patch.last_net_weight = diff
        patch.last_return_diff = diff
        patch.next_out_gross = lastGross
        patch.next_out_net = diff

        needUpdate = true

        if (sampleChanges.length < 50) {
          sampleChanges.push({
            number: doc.number,
            reason: 'fill_last_back_net_weight',
            tare_weight: tare,
            last_gross_weight: lastGross,
            new_diff: diff
          })
        }
      } else if (!hasBackNet && (tare == null || lastGross == null)) {
        // 这类没法算，记个统计
        noTareOrGross++
      } else {
        alreadyMigrated++
      }

      // 2）顺手规范 status（可选）
      if (fixStatus) {
        const rawStatus = doc.status
        if (!ALLOWED_STATUS.has(rawStatus)) {
          // 简单策略：有 last_back_date 就当在站；有 last_out_date 没回瓶就当在客户；否则 unknown
          let newStatus = 'unknown'
          if (doc.last_back_date) {
            newStatus = 'in_station'
          } else if (doc.last_out_date) {
            newStatus = 'at_customer'
          }
          if (newStatus !== rawStatus) {
            patch.status = newStatus
            needUpdate = true

            if (sampleChanges.length < 50) {
              sampleChanges.push({
                number: doc.number,
                reason: 'fix_status',
                from: rawStatus,
                to: newStatus
              })
            }
          }
        }
      }

      if (needUpdate && !dryRun) {
        await bottlesCol.doc(doc._id).update(patch)
        updated++
      }
    }

    processed += list.length
  }

  return {
    code: 0,
    msg: dryRun
      ? 'dryRun: 仅预览迁移结果，未真正写库'
      : '迁移已执行',
    data: {
      total,
      processed,
      updated,
      alreadyMigrated,
      noTareOrGross,
      dryRun,
      sampleChanges
    }
  }
}