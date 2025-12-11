'use strict'

const db = uniCloud.database()
const dbCmd = db.command

const salesCol = db.collection('crm_sale_records')
const gasInCol = db.collection('crm_gas_in')
const users = db.collection('crm_users')

async function getUserByToken(token) {
  if (!token) return null
  const res = await users.where({ token }).get()
  return res.data[0] || null
}

function toNumber(v, def = 0) {
  const n = Number(v)
  return Number.isNaN(n) ? def : n
}

// 把 JS Date 转成 YYYY-MM-DD
function formatDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

exports.main = async (event, context) => {
  const { action, data = {}, token } = event

  // 统一鉴权
  const user = await getUserByToken(token)
  if (!user) {
    return { code: 401, msg: '未登录或登录已过期' }
  }

  // ================== 仪表盘汇总 ==================
  if (action === 'summary') {
    const now = new Date()
    const todayStr = formatDate(now)
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const monthStart = `${year}-${month}-01`
    const monthEnd = `${year}-${month}-31` // 你的 date 是字符串，用 <= '31' 就可以覆盖整月

    try {
      // 1）今日销售（所有客户）
      const todayRes = await salesCol
        .where({ date: todayStr })
        .get()

      let todayWeight = 0  // kg
      let todayAmount = 0  // 元

      ;(todayRes.data || []).forEach(doc => {
        const outNet = doc.net_weight_out != null
          ? toNumber(doc.net_weight_out, 0)
          : 0
        const backNet = doc.net_weight_back != null
          ? toNumber(doc.net_weight_back, 0)
          : 0
        const totalNet = doc.total_net_weight != null
          ? toNumber(doc.total_net_weight, 0)
          : (outNet - backNet)

        todayWeight += totalNet          // 这里是 kg
        todayAmount += toNumber(doc.amount_received, 0)
      })

      // 2）本月销售 & 未收
      const monthRes = await salesCol
        .where({
          date: dbCmd.gte(monthStart).and(dbCmd.lte(monthEnd))
        })
        .get()

      let monthAmount = 0   // 元（按实收）
      let monthUnpaid = 0   // 元

      ;(monthRes.data || []).forEach(doc => {
        const amt = toNumber(doc.amount, 0)
        const recv = toNumber(doc.amount_received, 0)
        const writeOff = toNumber(doc.write_off, 0)
        monthAmount += recv
        monthUnpaid += Math.max(amt - recv - writeOff, 0)
      })

      // 3）天然气库存 ==============================
      // 3.1 入库净重：单位是“吨” → 先转成 kg 再算
      const gasInRes = await gasInCol
        .field({ net_weight: true })
        .limit(10000) // 量不大应该够用
        .get()

      let totalGasInTon = 0   // 吨
      ;(gasInRes.data || []).forEach(doc => {
        totalGasInTon += toNumber(doc.net_weight, 0)   // net_weight 存的是“吨”
      })
      const totalGasInKg = totalGasInTon * 1000        // 统一转成 kg

      // 3.2 所有销售净重总和：已经是 kg
      const allSalesRes = await salesCol
        .field({
          net_weight_out: true,
          net_weight_back: true,
          total_net_weight: true
        })
        .limit(10000)
        .get()

      let totalGasUsedKg = 0   // 已用气量 kg
      ;(allSalesRes.data || []).forEach(doc => {
        const outNet = doc.net_weight_out != null
          ? toNumber(doc.net_weight_out, 0)
          : 0
        const backNet = doc.net_weight_back != null
          ? toNumber(doc.net_weight_back, 0)
          : 0
        const totalNet = doc.total_net_weight != null
          ? toNumber(doc.total_net_weight, 0)
          : (outNet - backNet)

        totalGasUsedKg += totalNet
      })

      // 3.3 库存 = 入库kg - 已用kg，结果再转回“吨”给前端显示
      let gasStockKg = totalGasInKg - totalGasUsedKg
      if (gasStockKg < 0) gasStockKg = 0  // 防止因为历史数据误差出现负数
      const gasStockTon = gasStockKg / 1000

      return {
        code: 0,
        msg: 'ok',
        data: {
          today_weight: Number(todayWeight.toFixed(2)),   // kg
          today_amount: Number(todayAmount.toFixed(2)),   // 元
          month_amount: Number(monthAmount.toFixed(2)),   // 元
          month_unpaid: Number(monthUnpaid.toFixed(2)),   // 元
          gas_stock: Number(gasStockTon.toFixed(3))       // ✅ 返回“吨”
        }
      }
    } catch (e) {
      console.error('crm-dashboard summary error:', e)
      return { code: 500, msg: '统计失败，请稍后重试' }
    }
  }

  // 未知 action
  return { code: 400, msg: '未知 action' }
}