'use strict';
const db = uniCloud.database()
const dbCmd = db.command
const users = db.collection('crm_users')
const logs = db.collection('crm_operation_logs')

async function getUserByToken(token) {
  if (!token) return null
  const res = await users.where({ token }).get()
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
    console.error('[crm-sale] recordLog failed', action, err)
  }
}

const sales = db.collection('crm_sale_records')
const customers = db.collection('crm_customers')
const bottles = db.collection('crm_bottles')

async function buildCustomerDeposits(customerId) {
  const depositMap = new Map()
  const pageSize = 500
  let skip = 0

  while (true) {
    const res = await sales
      .where({ customer_id: customerId })
      .orderBy('date', 'asc')
      .orderBy('created_at', 'asc')
      .skip(skip)
      .limit(pageSize)
      .get()

    const batch = res.data || []
    batch.forEach(doc => {
      // 仅针对瓶装业务做存瓶计算
      if (doc.biz_mode === 'truck') return

      const recordId = doc._id
      const recordDate = doc.date || ''

      const outList = Array.isArray(doc.out_items) ? doc.out_items : []
      outList.forEach(o => {
        const no = (o.bottle_no || o.bottleNo || '').trim()
        if (!no) return
        depositMap.set(no, {
          bottle_no: no,
          bottle_id: o.bottle_id || o.bottleId || null,
          last_date: recordDate,
          last_record_id: recordId
        })
      })

      if (doc.bottle_no) {
        const legacyNo = String(doc.bottle_no).trim()
        if (legacyNo) {
          depositMap.set(legacyNo, {
            bottle_no: legacyNo,
            bottle_id: doc.bottle_id || null,
            last_date: recordDate,
            last_record_id: recordId
          })
        }
      }

      const backList = Array.isArray(doc.back_items) ? doc.back_items : []
      backList.forEach(b => {
        const no = (b.bottle_no || b.bottleNo || '').trim()
        if (!no) return
        depositMap.delete(no)
      })

      if (doc.return_bottle_no) {
        const legacyBack = String(doc.return_bottle_no).trim()
        if (legacyBack) depositMap.delete(legacyBack)
      }
    })

    if (batch.length < pageSize) break
    skip += pageSize
  }

  const deposits = Array.from(depositMap.values())
  deposits.sort((a, b) => (a.bottle_no || '').localeCompare(b.bottle_no || ''))
  return deposits
}

// 安全更新瓶子状态：没有这个瓶号就什么都不做
async function updateBottleStatusByNumber(number, payload) {
  const no = (number || '').trim()
  if (!no) return
  await bottles.where({ number: no }).update({
    ...payload,
    updated_at: Date.now()
  })
}

function toNumber(v, def = 0) {
  if (v === '' || v === null || typeof v === 'undefined') return def
  const n = Number(v)
  return Number.isNaN(n) ? def : n
}

<<<<<<< HEAD
=======
function escapeRegExp(str = '') {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

>>>>>>> 25fda4a (init project)
exports.main = async (event, context) => {
  const { action, data = {}, token } = event

  const user = await getUserByToken(token)
  if (!user) {
    return {
      code: 401,
      msg: '未登录或登录已过期'
    }
  }

  // =========================
  // 1. 新版：多瓶 createV2
  // =========================
  if (action === 'createV2') {
    const payload = data || {}
    const base = payload.base || {}
    const outRows = payload.outRows || []
    const backRows = payload.backRows || []
    const depositRows = payload.depositRows || []
    const source = payload.source

    const {
      date,
      customerId,
      customerName,
      unitPrice,
      priceUnit,
      delivery1,
      delivery2,
      vehicleId,
      car_no,

      remark,
      amountReceived,
      paymentStatus,
      paymentNote,

      // 业务模式 / 整车称重
      bizMode,
      truckGross,
      truckTare,
      truckNet,

      // Flow 相关字段（前端传的是 snake_case）
      flow_index_prev: flowIndexPrevRaw,
      flow_index_curr: flowIndexCurrRaw,
      flow_volume: flowVolumeRaw,
      flow_unit_price: flowUnitPriceRaw,
      flow_amount_should: flowAmountShouldRaw,
      flow_amount_received: flowAmountReceivedRaw,
      flow_payment_status: flowPaymentStatusRaw,
      flow_remark: flowRemarkRaw,
      flow_theory_ratio: flowTheoryRatioRaw
    } = base

    if (!date) {
      return { code: 400, msg: '日期必填' }
    }
    if (!customerId && !customerName) {
      return { code: 400, msg: '客户必填' }
    }

    // 尝试根据名称补齐 customerId
    let customer_id = customerId
    let customer_name = customerName
    if (!customer_id && customer_name) {
      const cRes = await customers.where({ name: customer_name }).get()
      if (cRes.data.length > 0) {
        customer_id = cRes.data[0]._id
        customer_name = cRes.data[0].name
      }
    }

    // 规范化瓶子行
    function normalizeRows(rows) {
      return (rows || [])
        .map(row => {
          const bottle_no = (row.bottleInput || '').trim()
          const gross = toNumber(row.gross)
          const tare = toNumber(row.tare)
          let net = toNumber(row.net, null)
          if (net === null) {
            if (gross || tare) net = gross - tare
            else net = 0
          }
          return {
            bottle_no,
            gross,
            tare,
            net,
            bottle_id: row.bottleId || null
          }
        })
        .filter(item => !!item.bottle_no)
    }

    const out_items = normalizeRows(outRows)
    const back_items = normalizeRows(backRows)

    // 瓶行净重汇总
    const raw_out_net_total = out_items.reduce((s, r) => s + toNumber(r.net), 0)
    const raw_back_net_total = back_items.reduce((s, r) => s + toNumber(r.net), 0)

    // 业务模式 / 整车称重
    const biz_mode = bizMode || 'bottle' // bottle | truck
    const truck_gross = toNumber(truckGross)
    const truck_tare = toNumber(truckTare)
    const truck_net = toNumber(truckNet)

    // ========= 强关联 bottle_id：对所有 bottle_id 为空的行做一次号 → _id 映射 =========
    const needLinkNosSet = new Set();
    [...out_items, ...back_items].forEach(row => {
      const no = (row.bottle_no || '').trim()
      if (!no) return
      if (row.bottle_id) return
      needLinkNosSet.add(no)
    })

    if (needLinkNosSet.size > 0) {
      const needLinkNos = Array.from(needLinkNosSet)
      try {
        const bottleRes = await bottles
          .where({ number: dbCmd.in(needLinkNos) })
          .field({ _id: 1, number: 1 })
          .get()

        const bottleMap = Object.create(null);
        (bottleRes.data || []).forEach(b => {
          const no = (b.number || '').trim()
          if (!no) return
          bottleMap[no] = b._id
        })

        const patchRows = rows => {
          rows.forEach(row => {
            if (row.bottle_id) return
            const no = (row.bottle_no || '').trim()
            if (!no) return
            const id = bottleMap[no]
            if (id) {
              row.bottle_id = id
            }
          })
        }

        patchRows(out_items)
        patchRows(back_items)
      } catch (e) {
        console.error('link bottle_id by number failed in createV2:', e)
        // 这里失败就算了，不影响主流程
      }
    }

    // 单价与计价单位
    const unit_price = toNumber(unitPrice)
    const price_unit = priceUnit || 'kg'

    // ========= 净重统计：truck 模式按整车净重算 =========
    let out_net_total = raw_out_net_total
    let back_net_total = raw_back_net_total

    if (biz_mode === 'truck') {
      // 整车模式：直接用整车净重代表本次出气，不存在回瓶
      out_net_total = truck_net
      back_net_total = 0
    }

    const total_net_weight = out_net_total - back_net_total

    // ========= Flow 字段整理 =========
    // 抄表数
    let flow_index_prev = null
    if (flowIndexPrevRaw !== undefined && flowIndexPrevRaw !== null && flowIndexPrevRaw !== '') {
      const n = toNumber(flowIndexPrevRaw, null)
      flow_index_prev = Number.isNaN(n) ? null : n
    }

    let flow_index_curr = null
    if (flowIndexCurrRaw !== undefined && flowIndexCurrRaw !== null && flowIndexCurrRaw !== '') {
      const n = toNumber(flowIndexCurrRaw, null)
      flow_index_curr = Number.isNaN(n) ? null : n
    }

    // 用气量（m³）——优先用前端算好的 volume，没有再用抄表差
    let flow_volume_m3 = null
    if (flowVolumeRaw !== undefined && flowVolumeRaw !== null && flowVolumeRaw !== '') {
      const n = toNumber(flowVolumeRaw, null)
      flow_volume_m3 = Number.isNaN(n) ? null : n
    }

    if (
      (flow_volume_m3 === null || Number.isNaN(flow_volume_m3)) &&
      flow_index_prev !== null &&
      flow_index_curr !== null
    ) {
      const diff = flow_index_curr - flow_index_prev
      flow_volume_m3 = diff >= 0 ? diff : 0
    }

    if (flow_volume_m3 !== null && Number.isNaN(flow_volume_m3)) {
      flow_volume_m3 = null
    }

    // 流量结算单价（元/m³）——优先 flow_unit_price，退回到整体单价
    let flow_unit_price = unit_price
    if (flowUnitPriceRaw !== undefined && flowUnitPriceRaw !== null && flowUnitPriceRaw !== '') {
      const n = toNumber(flowUnitPriceRaw, unit_price)
      flow_unit_price = Number.isNaN(n) ? unit_price : n
    }

    // 理论换算系数（m³/kg）
    let flow_theory_ratio = null
    if (flowTheoryRatioRaw !== undefined && flowTheoryRatioRaw !== null && flowTheoryRatioRaw !== '') {
      const n = toNumber(flowTheoryRatioRaw, null)
      flow_theory_ratio = Number.isNaN(n) ? null : n
    }

    // 理论用气量（m³）= 实际消耗 kg × 换算系数(m³/kg)
    let flow_theoretical_volume_m3 = null
    if (flow_theory_ratio !== null && flow_theory_ratio > 0 && total_net_weight) {
      const v = total_net_weight * flow_theory_ratio
      if (Number.isFinite(v)) {
        flow_theoretical_volume_m3 = v
      }
    }

    // Flow 应收金额（如果前端传了就信前端）
    let flow_amount_should = null
    if (flowAmountShouldRaw !== undefined && flowAmountShouldRaw !== null && flowAmountShouldRaw !== '') {
      const n = toNumber(flowAmountShouldRaw, null)
      if (!Number.isNaN(n)) flow_amount_should = n
    }

    // ⚠️ 非 m3 模式：把抄表相关字段清理掉（但保留理论换算）
    if (price_unit !== 'm3') {
      flow_index_prev = null
      flow_index_curr = null
      flow_volume_m3 = null
      flow_unit_price = unit_price
      flow_amount_should = null
      // flow_amount_received 后面按实收金额算
    }

    // ========= 金额（按计价单位分三种模式） =========
    let out_amount = 0
    let back_amount = 0
    let should_receive = 0

    if (price_unit === 'kg') {
      // 元/kg：按净重计算。truck 模式已经把 out_net_total 替换为整车净重
      out_amount = out_net_total * unit_price
      back_amount = back_net_total * unit_price
      should_receive = out_amount - back_amount
    } else if (price_unit === 'bottle') {
      // 元/瓶：只看出瓶数量，回瓶不调金额
      const count = out_items.length
      out_amount = count * unit_price
      back_amount = 0
      should_receive = out_amount
    } else if (price_unit === 'm3') {
      // 元/m³：按抄表流量计费，回瓶仅影响库存不影响金额
      const safeVolume =
        flow_volume_m3 !== null && !Number.isNaN(flow_volume_m3) ? flow_volume_m3 : 0
      out_amount = safeVolume * unit_price
      back_amount = 0
      should_receive = out_amount

      if (flow_amount_should === null) {
        flow_amount_should = should_receive
      }
    } else {
      // 兜底：当作 kg 处理
      out_amount = out_net_total * unit_price
      back_amount = back_net_total * unit_price
      should_receive = out_amount - back_amount
    }

    // ★ 统一两位小数（最小改动，只在最终入库前收口）
    function fix2(n) {
      const v = Number(n)
      return Number.isFinite(v) ? Number(v.toFixed(2)) : 0
    }

    out_amount = fix2(out_amount)
    back_amount = fix2(back_amount)
    should_receive = fix2(should_receive)
    if (flow_amount_should != null) {
      flow_amount_should = fix2(flow_amount_should)
    }

    // 实收金额与付款状态（Flow 优先生效）
    const base_amount_received = toNumber(amountReceived, 0)
    let flow_amount_received = base_amount_received
    if (
      flowAmountReceivedRaw !== undefined &&
      flowAmountReceivedRaw !== null &&
      flowAmountReceivedRaw !== ''
    ) {
      const n = toNumber(flowAmountReceivedRaw, base_amount_received)
      if (!Number.isNaN(n)) flow_amount_received = n
    }

    const payment_status = flowPaymentStatusRaw || paymentStatus || ''
    const payment_note = paymentNote || ''

    // ========= 存瓶逻辑：出瓶即存瓶 + 手动存瓶 =========
    // 1）手动录入的存瓶
    const depositNosExplicit = (depositRows || [])
      .map(r => (r.bottleInput || '').trim())
      .filter(Boolean)

    const explicitSet = new Set(depositNosExplicit)

    // 2）本单回瓶的瓶号
    const backSet = new Set(
      (back_items || [])
        .map(it => (it.bottle_no || '').trim())
        .filter(Boolean)
    )

    // 3）隐式存瓶：不录存瓶时，出瓶即存瓶
    const implicitDepositNos = []
    out_items.forEach(it => {
      const no = (it.bottle_no || '').trim()
      if (!no) return
      if (backSet.has(no)) return
      if (explicitSet.has(no)) return
      implicitDepositNos.push(no)
    })

    // 4）最终存瓶列表 = 手动存瓶 ∪ 隐式存瓶
    const allDepositNos = Array.from(new Set([...depositNosExplicit, ...implicitDepositNos]))
    const deposit_bottles_raw = allDepositNos.join(' / ')

    // ========= 旧字段兼容 =========
    const firstOut = out_items[0] || {}
    const firstBack = back_items[0] || {}

    const now = Date.now()

    const doc = {
      // 基本信息
      date,
      customer_id: customer_id || '',
      customer_name: customer_name || '',
      delivery_man: [delivery1, delivery2].filter(Boolean).join(' / '),
      vehicle_id: vehicleId || '',
      car_no: car_no || '',


      // 业务模式 / 整车称重
      biz_mode,
      truck_gross,
      truck_tare,
      truck_net,

      // 旧版字段兼容（单瓶）
      bottle_no: firstOut.bottle_no || '',
      gross_weight_out: toNumber(firstOut.gross),
      tare_weight_out: toNumber(firstOut.tare),
      net_weight_out: toNumber(firstOut.net),
      return_bottle_no: firstBack.bottle_no || '',
      gross_weight_back: toNumber(firstBack.gross),
      tare_weight_back: toNumber(firstBack.tare),
      net_weight_back: toNumber(firstBack.net),
      total_net_weight,

      // 单价与金额
      unit_price,
      price_unit,
      amount: should_receive, // 本单实际应收
      amount_received: flow_amount_received,
      payment_status,
      payment_note,

      // 存瓶
      deposit_bottles_raw,

      // 备注
      remark: remark || '',

      // 新增的明细与统计
      out_items,
      back_items,
      out_net_total,
      back_net_total,
      out_amount,
      back_amount,
      should_receive,

      // ★ 流量相关字段（新）
      flow_index_prev,
      flow_index_curr,
      flow_volume_m3,
      flow_theory_ratio,
      // 为兼容旧命名，顺带存一份
      flow_conversion_ratio: flow_theory_ratio,
      flow_theoretical_volume_m3,
      flow_unit_price,
      flow_amount_should,
      flow_amount_received,
      flow_payment_status: payment_status,
      flow_remark: flowRemarkRaw || '',

      // 审计
      created_at: now,
      created_by: user._id,
      source: source || 'manual-v2'
    }

    // ========= 多瓶回瓶后，更新瓶子称重信息（批量） =========
    const returnItems = []

    if (Array.isArray(doc.back_items) && doc.back_items.length) {
      doc.back_items.forEach(b => {
        const no = (b.bottle_no || '').trim()
        if (!no) return
        returnItems.push({
          number: no,
          return_gross: b.gross, // 回瓶毛重
          return_tare: b.tare    // 本次录入皮重
        })
      })
    } else if (doc.return_bottle_no) {
      const no = (doc.return_bottle_no || '').trim()
      if (no) {
        returnItems.push({
          number: no,
          return_gross: doc.gross_weight_back,
          return_tare: doc.tare_weight_back
        })
      }
    }

    const resAdd = await sales.add(doc)
    await recordLog(user, 'sale_create_v2', { id: resAdd.id, customer: customer_name || customer_id, date })

    // ========= 同步瓶子状态：出瓶 -> 在客户；回瓶 -> 在站 =========
    const bottleTasks = []

    // 出瓶：在客户
    out_items.forEach(item => {
      bottleTasks.push(
        updateBottleStatusByNumber(item.bottle_no, {
          status: 'at_customer',
          last_customer_id: customer_id || '',
          last_customer_name: customer_name || '',
          last_out_date: date
        })
      )
    })

    // 回瓶：回到站内
    back_items.forEach(item => {
      bottleTasks.push(
        updateBottleStatusByNumber(item.bottle_no, {
          status: 'in_station',
          last_customer_id: customer_id || '',
          last_customer_name: customer_name || '',
          last_back_date: date
        })
      )
    })

    await Promise.all(bottleTasks).catch(err => {
      console.error('update bottles status in createV2 error:', err)
    })

    // ========= 回瓶后批量更新瓶子称重信息（调用 crm-bottle 云函数） =========
    let anomalies = []

    if (returnItems.length) {
      try {
        const bottleRes = await uniCloud.callFunction({
          name: 'crm-bottle',
          data: {
            action: 'updateAfterReturnBatch',
            token,
            data: { items: returnItems }
          }
        })

        const bResult = bottleRes.result || {}
        if (
          bResult.code === 0 &&
          bResult.data &&
          Array.isArray(bResult.data.anomalies)
        ) {
          anomalies = bResult.data.anomalies
        }
      } catch (e) {
        console.error('updateAfterReturnBatch error:', e)
        // 不因为瓶子更新失败而让整个开单失败
      }
    }

    let msg = '保存成功'
    if (anomalies.length) {
      const s = anomalies
        .map(a => {
          const abs = Math.abs(a.diff_net || 0)
          const flag = (a.diff_net || 0) > 0 ? '多' : '少'
          return `${a.number}(${flag} ${abs}kg)`
        })
        .join('，')
      msg = `保存成功，但有异常瓶子：${s}`
    }

    return {
      code: 0,
      msg,
      data: {
        id: resAdd.id,
        anomalies
      }
    }
  }

  // =========================
  // 1.1 新版：多瓶 updateV2
  // =========================
  if (action === 'updateV2') {
    const payload = data || {}
    const id = payload.id
    if (!id) {
      return { code: 400, msg: '缺少 id' }
    }

    const base = payload.base || {}
    const outRows = payload.outRows || []
    const backRows = payload.backRows || []
    const depositRows = payload.depositRows || []

    const {
      date,
      customerId,
      customerName,
      unitPrice,
      priceUnit,
      delivery1,
      delivery2,
      vehicleId,
      car_no,

      remark,
      amountReceived,
      paymentStatus,
      paymentNote,

      bizMode,
      truckGross,
      truckTare,
      truckNet,

      flow_index_prev: flowIndexPrevRaw,
      flow_index_curr: flowIndexCurrRaw,
      flow_volume: flowVolumeRaw,
      flow_unit_price: flowUnitPriceRaw,
      flow_amount_should: flowAmountShouldRaw,
      flow_amount_received: flowAmountReceivedRaw,
      flow_payment_status: flowPaymentStatusRaw,
      flow_remark: flowRemarkRaw,
      flow_theory_ratio: flowTheoryRatioRaw
    } = base

    if (!date) {
      return { code: 400, msg: '日期必填' }
    }
    if (!customerId && !customerName) {
      return { code: 400, msg: '客户必填' }
    }

    // 尝试根据名称补齐 customerId
    let customer_id = customerId
    let customer_name = customerName
    if (!customer_id && customer_name) {
      const cRes = await customers.where({ name: customer_name }).get()
      if (cRes.data.length > 0) {
        customer_id = cRes.data[0]._id
        customer_name = cRes.data[0].name
      }
    }

    function normalizeRows(rows) {
      return (rows || [])
        .map(row => {
          const bottle_no = (row.bottleInput || '').trim()
          const gross = toNumber(row.gross)
          const tare = toNumber(row.tare)
          let net = toNumber(row.net, null)
          if (net === null) {
            if (gross || tare) net = gross - tare
            else net = 0
          }
          return {
            bottle_no,
            gross,
            tare,
            net,
            bottle_id: row.bottleId || null
          }
        })
        .filter(item => !!item.bottle_no)
    }

    const out_items = normalizeRows(outRows)
    const back_items = normalizeRows(backRows)

    const raw_out_net_total = out_items.reduce((s, r) => s + toNumber(r.net), 0)
    const raw_back_net_total = back_items.reduce((s, r) => s + toNumber(r.net), 0)

    const biz_mode = bizMode || 'bottle'
    const truck_gross = toNumber(truckGross)
    const truck_tare = toNumber(truckTare)
    const truck_net = toNumber(truckNet)

    const needLinkNosSet = new Set();
    [...out_items, ...back_items].forEach(row => {
      const no = (row.bottle_no || '').trim()
      if (!no) return
      if (row.bottle_id) return
      needLinkNosSet.add(no)
    })

    if (needLinkNosSet.size > 0) {
      const needLinkNos = Array.from(needLinkNosSet)
      try {
        const bottleRes = await bottles
          .where({ number: dbCmd.in(needLinkNos) })
          .field({ _id: 1, number: 1 })
          .get()

        const bottleMap = Object.create(null);
        (bottleRes.data || []).forEach(b => {
          const no = (b.number || '').trim()
          if (!no) return
          bottleMap[no] = b._id
        })

        const patchRows = rows => {
          rows.forEach(row => {
            if (row.bottle_id) return
            const no = (row.bottle_no || '').trim()
            if (!no) return
            const bid = bottleMap[no]
            if (bid) {
              row.bottle_id = bid
            }
          })
        }

        patchRows(out_items)
        patchRows(back_items)
      } catch (e) {
        console.error('link bottle_id by number failed in updateV2:', e)
      }
    }

    const unit_price = toNumber(unitPrice)
    const price_unit = priceUnit || 'kg'

    let out_net_total = raw_out_net_total
    let back_net_total = raw_back_net_total

    if (biz_mode === 'truck') {
      out_net_total = truck_net
      back_net_total = 0
    }

    const total_net_weight = out_net_total - back_net_total

    let flow_index_prev = null
    if (flowIndexPrevRaw !== undefined && flowIndexPrevRaw !== null && flowIndexPrevRaw !== '') {
      const n = toNumber(flowIndexPrevRaw, null)
      flow_index_prev = Number.isNaN(n) ? null : n
    }

    let flow_index_curr = null
    if (flowIndexCurrRaw !== undefined && flowIndexCurrRaw !== null && flowIndexCurrRaw !== '') {
      const n = toNumber(flowIndexCurrRaw, null)
      flow_index_curr = Number.isNaN(n) ? null : n
    }

    let flow_volume_m3 = null
    if (flowVolumeRaw !== undefined && flowVolumeRaw !== null && flowVolumeRaw !== '') {
      const n = toNumber(flowVolumeRaw, null)
      flow_volume_m3 = Number.isNaN(n) ? null : n
    }
    if (
      (flow_volume_m3 === null || Number.isNaN(flow_volume_m3)) &&
      flow_index_prev !== null &&
      flow_index_curr !== null
    ) {
      const diff = flow_index_curr - flow_index_prev
      flow_volume_m3 = diff >= 0 ? diff : 0
    }
    if (flow_volume_m3 !== null && Number.isNaN(flow_volume_m3)) {
      flow_volume_m3 = null
    }

    let flow_unit_price = unit_price
    if (flowUnitPriceRaw !== undefined && flowUnitPriceRaw !== null && flowUnitPriceRaw !== '') {
      const n = toNumber(flowUnitPriceRaw, unit_price)
      flow_unit_price = Number.isNaN(n) ? unit_price : n
    }

    let flow_theory_ratio = null
    if (flowTheoryRatioRaw !== undefined && flowTheoryRatioRaw !== null && flowTheoryRatioRaw !== '') {
      const n = toNumber(flowTheoryRatioRaw, null)
      flow_theory_ratio = Number.isNaN(n) ? null : n
    }

    let flow_theoretical_volume_m3 = null
    if (flow_theory_ratio !== null && flow_theory_ratio > 0 && total_net_weight) {
      const v = total_net_weight * flow_theory_ratio
      if (Number.isFinite(v)) {
        flow_theoretical_volume_m3 = v
      }
    }

    let flow_amount_should = null
    if (flowAmountShouldRaw !== undefined && flowAmountShouldRaw !== null && flowAmountShouldRaw !== '') {
      const n = toNumber(flowAmountShouldRaw, null)
      if (!Number.isNaN(n)) flow_amount_should = n
    }

    if (price_unit !== 'm3') {
      flow_index_prev = null
      flow_index_curr = null
      flow_volume_m3 = null
      flow_unit_price = unit_price
      flow_amount_should = null
    }

    let out_amount = 0
    let back_amount = 0
    let should_receive = 0

    if (price_unit === 'kg') {
      out_amount = out_net_total * unit_price
      back_amount = back_net_total * unit_price
      should_receive = out_amount - back_amount
    } else if (price_unit === 'bottle') {
      const count = out_items.length
      out_amount = count * unit_price
      back_amount = 0
      should_receive = out_amount
    } else if (price_unit === 'm3') {
      const safeVolume =
        flow_volume_m3 !== null && !Number.isNaN(flow_volume_m3) ? flow_volume_m3 : 0
      out_amount = safeVolume * unit_price
      back_amount = 0
      should_receive = out_amount
      if (flow_amount_should === null) {
        flow_amount_should = should_receive
      }
    } else {
      out_amount = out_net_total * unit_price
      back_amount = back_net_total * unit_price
      should_receive = out_amount - back_amount
    }

    function fix2(n) {
      const v = Number(n)
      return Number.isFinite(v) ? Number(v.toFixed(2)) : 0
    }

    out_amount = fix2(out_amount)
    back_amount = fix2(back_amount)
    should_receive = fix2(should_receive)
    if (flow_amount_should != null) {
      flow_amount_should = fix2(flow_amount_should)
    }

    const base_amount_received = toNumber(amountReceived, 0)
    let flow_amount_received = base_amount_received
    if (
      flowAmountReceivedRaw !== undefined &&
      flowAmountReceivedRaw !== null &&
      flowAmountReceivedRaw !== ''
    ) {
      const n = toNumber(flowAmountReceivedRaw, base_amount_received)
      if (!Number.isNaN(n)) flow_amount_received = n
    }

    const payment_status = flowPaymentStatusRaw || paymentStatus || ''
    const payment_note = paymentNote || ''

    const depositNosExplicit = (depositRows || [])
      .map(r => (r.bottleInput || '').trim())
      .filter(Boolean)

    const explicitSet = new Set(depositNosExplicit)

    const backSet = new Set(
      (back_items || [])
        .map(it => (it.bottle_no || '').trim())
        .filter(Boolean)
    )

    const implicitDepositNos = []
    out_items.forEach(it => {
      const no = (it.bottle_no || '').trim()
      if (!no) return
      if (backSet.has(no)) return
      if (explicitSet.has(no)) return
      implicitDepositNos.push(no)
    })

    const allDepositNos = Array.from(new Set([...depositNosExplicit, ...implicitDepositNos]))
    const deposit_bottles_raw = allDepositNos.join(' / ')

    const firstOut = out_items[0] || {}
    const firstBack = back_items[0] || {}

    const now = Date.now()

    const patch = {
      date,
      customer_id: customer_id || '',
      customer_name: customer_name || '',
      delivery_man: [delivery1, delivery2].filter(Boolean).join(' / '),
      vehicle_id: vehicleId || '',
      car_no: car_no || '',

      biz_mode,
      truck_gross,
      truck_tare,
      truck_net,

      bottle_no: firstOut.bottle_no || '',
      gross_weight_out: toNumber(firstOut.gross),
      tare_weight_out: toNumber(firstOut.tare),
      net_weight_out: toNumber(firstOut.net),
      return_bottle_no: firstBack.bottle_no || '',
      gross_weight_back: toNumber(firstBack.gross),
      tare_weight_back: toNumber(firstBack.tare),
      net_weight_back: toNumber(firstBack.net),
      total_net_weight,

      unit_price,
      price_unit,
      amount: should_receive,
      amount_received: flow_amount_received,
      payment_status,
      payment_note,

      deposit_bottles_raw,
      remark: remark || '',

      out_items,
      back_items,
      out_net_total,
      back_net_total,
      out_amount,
      back_amount,
      should_receive,

      flow_index_prev,
      flow_index_curr,
      flow_volume_m3,
      flow_theory_ratio,
      flow_conversion_ratio: flow_theory_ratio,
      flow_theoretical_volume_m3,
      flow_unit_price,
      flow_amount_should,
      flow_amount_received,
      flow_payment_status: payment_status,
      flow_remark: flowRemarkRaw || '',

      updated_at: now
    }

    const returnItems = []

    if (Array.isArray(patch.back_items) && patch.back_items.length) {
      patch.back_items.forEach(b => {
        const no = (b.bottle_no || '').trim()
        if (!no) return
        returnItems.push({
          number: no,
          return_gross: b.gross,
          return_tare: b.tare
        })
      })
    } else if (patch.return_bottle_no) {
      const no = (patch.return_bottle_no || '').trim()
      if (no) {
        returnItems.push({
          number: no,
          return_gross: patch.gross_weight_back,
          return_tare: patch.tare_weight_back
        })
      }
    }

    await sales.doc(id).update(patch)

    const bottleTasks = []

    out_items.forEach(item => {
      bottleTasks.push(
        updateBottleStatusByNumber(item.bottle_no, {
          status: 'at_customer',
          last_customer_id: customer_id || '',
          last_customer_name: customer_name || '',
          last_out_date: date
        })
      )
    })

    back_items.forEach(item => {
      bottleTasks.push(
        updateBottleStatusByNumber(item.bottle_no, {
          status: 'in_station',
          last_customer_id: customer_id || '',
          last_customer_name: customer_name || '',
          last_back_date: date
        })
      )
    })

    await Promise.all(bottleTasks).catch(err => {
      console.error('update bottles status in updateV2 error:', err)
    })

    let anomalies = []

    if (returnItems.length) {
      try {
        const bottleRes = await uniCloud.callFunction({
          name: 'crm-bottle',
          data: {
            action: 'updateAfterReturnBatch',
            token,
            data: { items: returnItems }
          }
        })
        const bResult = bottleRes.result || {}
        if (
          bResult.code === 0 &&
          bResult.data &&
          Array.isArray(bResult.data.anomalies)
        ) {
          anomalies = bResult.data.anomalies
        }
      } catch (e) {
        console.error('updateAfterReturnBatch error in updateV2:', e)
      }
    }

    let msg = '更新成功'
    if (anomalies.length) {
      const s = anomalies
        .map(a => {
          const abs = Math.abs(a.diff_net || 0)
          const flag = (a.diff_net || 0) > 0 ? '多' : '少'
          return `${a.number}(${flag} ${abs}kg)`
        })
        .join('，')
      msg = `更新成功，但有异常瓶子：${s}`
    }

    await recordLog(user, 'sale_update_v2', {
      id,
      customer: customerName || customerId,
      anomalies: anomalies.length
    })

    return {
      code: 0,
      msg,
      data: {
        id,
        anomalies
      }
    }
  }

  // =========================
  // 2. 旧版 create
  // =========================
  if (action === 'create') {
    const {
      date,
      customer_id,
      customer_name,
      bottle_no,
      gross_weight_out,
      tare_weight_out,
      net_weight_out,
      return_bottle_no,
      gross_weight_back,
      tare_weight_back,
      net_weight_back,
      total_net_weight,
      unit_price,
      price_unit,
      amount,
      amount_received,
      payment_status,
      payment_note,
      deposit_bottles_raw,
      delivery_man,
      car_no,
      vehicle_id,
      remark
    } = data

    if (!date) return { code: 400, msg: '日期必填' }
    if (!customer_id && !customer_name) {
      return { code: 400, msg: '客户必填' }
    }

    let customerId = customer_id
    let customerName = customer_name

    if (!customerId && customerName) {
      const cRes = await customers.where({ name: customerName }).get()
      if (cRes.data.length > 0) {
        customerId = cRes.data[0]._id
        customerName = cRes.data[0].name
      }
    }

    // 计算净重
    let netOut = toNumber(net_weight_out)
    let netBack = toNumber(net_weight_back)

    if (!netOut) {
      const g = toNumber(gross_weight_out)
      const t = toNumber(tare_weight_out)
      if (g || t) netOut = g - t
    }

    if (!netBack) {
      const g2 = toNumber(gross_weight_back)
      const t2 = toNumber(tare_weight_back)
      if (g2 || t2) netBack = g2 - t2
    }

    let totalNet = toNumber(total_net_weight)
    if (!totalNet) {
      totalNet = netOut - netBack
    }

    const price = toNumber(unit_price)
    let amt = toNumber(amount, null)
    if (amt === null) {
      amt = totalNet * price
    }

    const amtRecv = toNumber(amount_received, 0)

    const doc = {
      date,
      customer_id: customerId || '',
      customer_name: customerName || '',
      bottle_no: bottle_no || '',
      gross_weight_out: toNumber(gross_weight_out),
      tare_weight_out: toNumber(tare_weight_out),
      net_weight_out: netOut,
      return_bottle_no: return_bottle_no || '',
      gross_weight_back: toNumber(gross_weight_back),
      tare_weight_back: toNumber(tare_weight_back),
      net_weight_back: netBack,
      total_net_weight: totalNet,
      unit_price: price,
      price_unit: price_unit || 'kg',
      amount: amt,
      amount_received: amtRecv,
      payment_status: payment_status || '',
      payment_note: payment_note || '',
      deposit_bottles_raw: deposit_bottles_raw || '',
      delivery_man: delivery_man || '',
      car_no: car_no || '',
      vehicle_id: vehicle_id || '',
      remark: remark || '',
      created_at: Date.now(),
      created_by: user._id,
      source: data.source || 'manual'
    }

    const res = await sales.add(doc)
    await recordLog(user, 'sale_create', { id: res.id, customer: doc.customer_name || doc.customer_id, date })

    const tasks = []

    if (doc.bottle_no) {
      tasks.push(
        updateBottleStatusByNumber(doc.bottle_no, {
          status: 'at_customer',
          last_customer_id: doc.customer_id || '',
          last_customer_name: doc.customer_name || '',
          last_out_date: doc.date
        })
      )
    }

    if (doc.return_bottle_no) {
      tasks.push(
        updateBottleStatusByNumber(doc.return_bottle_no, {
          status: 'in_station',
          last_customer_id: doc.customer_id || '',
          last_customer_name: doc.customer_name || '',
          last_back_date: doc.date
        })
      )
    }

    await Promise.all(tasks).catch(err => {
      console.error('update bottles status in create error:', err)
    })

    return {
      code: 0,
      msg: 'created',
      id: res.id
    }
  }

  // =========================
  // 3. 列表查询
  // =========================
  if (action === 'list') {
    const {
      customer_id,
      customer_name,
      date_from,
      date_to,
      delivery_man,
      vehicle_id,
<<<<<<< HEAD
=======
      vehicle_kw,
      bottle_no,
>>>>>>> 25fda4a (init project)
      page = 1,
      pageSize = 50
    } = data

<<<<<<< HEAD
    let where = {}

    if (customer_id) where.customer_id = customer_id
    if (customer_name) where.customer_name = customer_name
    if (delivery_man) where.delivery_man = delivery_man
    if (vehicle_id) where.vehicle_id = vehicle_id
=======
    const whereList = []

    if (customer_id) {
      whereList.push(dbCmd.or({ customer_id }, { customerId: customer_id }))
    }
    if (customer_name) {
      whereList.push(
        dbCmd.or({ customer_name }, { customerName: customer_name })
      )
    }
    if (delivery_man) whereList.push({ delivery_man })
    if (vehicle_id) whereList.push({ vehicle_id })

    const vehicleKeyword = (vehicle_kw || '').trim()
    if (vehicleKeyword) {
      const reg = new RegExp(escapeRegExp(vehicleKeyword), 'i')
      whereList.push(dbCmd.or({ car_no: reg }, { vehicle_plate: reg }))
    }
>>>>>>> 25fda4a (init project)

    // 统一使用 dbCmd.gte / lte 写法
    if (date_from || date_to) {
      let cond = null
      if (date_from && date_to) {
        cond = dbCmd.gte(date_from).and(dbCmd.lte(date_to))
      } else if (date_from) {
        cond = dbCmd.gte(date_from)
      } else if (date_to) {
        cond = dbCmd.lte(date_to)
      }
<<<<<<< HEAD
      if (cond) where.date = cond
    }

=======
      if (cond) whereList.push({ date: cond })
    }

    const bottleKeyword = (bottle_no || '').trim()
    if (bottleKeyword) {
      whereList.push(
        dbCmd.or(
          { bottle_no: bottleKeyword },
          { return_bottle_no: bottleKeyword },
          { out_items: dbCmd.elemMatch({ bottle_no: bottleKeyword }) },
          { back_items: dbCmd.elemMatch({ bottle_no: bottleKeyword }) },
          { deposit_bottles_raw: new RegExp(bottleKeyword) }
        )
      )
    }

    const where = whereList.length ? dbCmd.and(...whereList) : {}

>>>>>>> 25fda4a (init project)
    const skip = (page - 1) * pageSize

    let query = sales.where(where).orderBy('date', 'desc')

    const [listRes, countRes] = await Promise.all([
      query.skip(skip).limit(pageSize).get(),
      sales.where(where).count()
    ])

    return {
      code: 0,
      data: listRes.data,
      total: countRes.total,
      page,
      pageSize
    }
  }

  // =========================
  // 4. 获取单条（编辑页用）
  // =========================
  if (action === 'get') {
    if (!data.id) return { code: 400, msg: '缺少 id' }
    const res = await sales.doc(data.id).get()
    return {
      code: 0,
      data: res.data[0] || null
    }
  }

  // =========================
  // 5. 旧版更新
  // =========================
  if (action === 'update') {
    const { id, ...rest } = data
    if (!id) return { code: 400, msg: '缺少 id' }
    await sales.doc(id).update(rest)
    await recordLog(user, 'sale_update', { id })
    return {
      code: 0,
      msg: 'updated'
    }
  }

  // =========================
  // 6. 删除
  // =========================
  if (action === 'remove') {
    if (!data.id) return { code: 400, msg: '缺少 id' }
    await sales.doc(data.id).remove()
    await recordLog(user, 'sale_remove', { id: data.id })
    return {
      code: 0,
      msg: 'removed'
    }
  }

  // =========================
  // 7. 按瓶号查询流转记录（瓶子详情页用）
  // =========================
  if (action === 'listByBottle') {
    const {
      number,
      page = 1,
      pageSize = 20
    } = data || {}

    const no = (number || '').trim()
    if (!no) {
      return {
        code: 400,
        msg: 'number 必填'
      }
    }

    const skip = (page - 1) * pageSize

    const where = dbCmd.or(
      { bottle_no: no },
      { return_bottle_no: no },
      { out_items: dbCmd.elemMatch({ bottle_no: no }) },
      { back_items: dbCmd.elemMatch({ bottle_no: no }) },
      { deposit_bottles_raw: new RegExp(no) }
    )

    const res = await sales
      .where(where)
      .orderBy('date', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()

    const rows = []

    function isInDepositStr(str, target) {
      if (!str) return false
      const parts = String(str)
        .split(/[\/\s,，]+/)
        .map(s => s.trim())
        .filter(Boolean)
      return parts.includes(target)
    }

    function findItemByBottle(items, targetNo) {
      if (!Array.isArray(items)) return null
      const t = (targetNo || '').trim()
      return items.find(it => (it.bottle_no || '').trim() === t) || null
    }

    (res.data || []).forEach(doc => {
      const base = {
        sale_id: doc._id,
        date: doc.date,
        customer_name: doc.customer_name || '',
        unit_price: doc.unit_price != null ? Number(doc.unit_price) : null,
        price_unit: doc.price_unit || 'kg',
        remark: doc.remark || '',
        created_at: doc.created_at || null,
        updated_at: doc.updated_at || null,
        timestamp: doc.created_at || doc.updated_at || null
      }

      const outItem = findItemByBottle(doc.out_items, no)
      const backItem = findItemByBottle(doc.back_items, no)

      const isOutLegacy = doc.bottle_no === no
      const isBackLegacy = doc.return_bottle_no === no

      const isOut = !!outItem || isOutLegacy
      const isBack = !!backItem || isBackLegacy
      const isDeposit = isInDepositStr(doc.deposit_bottles_raw, no)

      const outNet =
        outItem && outItem.net != null
          ? Number(outItem.net)
          : doc.net_weight_out != null
          ? Number(doc.net_weight_out)
          : null

      const backNet =
        backItem && backItem.net != null
          ? Number(backItem.net)
          : doc.net_weight_back != null
          ? Number(doc.net_weight_back)
          : null

      if (isOut) {
        rows.push({
          ...base,
          role: 'out',
          role_text: '出瓶',
          net_weight: outNet,
          deposited: isDeposit
        })
      }

      if (isBack) {
        rows.push({
          ...base,
          role: 'back',
          role_text: '回瓶',
          net_weight: backNet
        })
      }

      if (isDeposit && !isOut && !isBack) {
        rows.push({
          ...base,
          role: 'deposit',
          role_text: '存瓶',
          net_weight: null
        })
      }
    })

    return {
      code: 0,
      data: rows
    }
  }

  if (action === 'customerDeposits') {
    const { customerId } = data || {}
    if (!customerId) return { code: 400, msg: '缺少客户' }

    const deposits = await buildCustomerDeposits(customerId)
    return { code: 0, data: deposits }
  }

  // =========================
  // 8. 客户月度对账（按天汇总）
  // =========================
  if (action === 'monthBill') {
    const { month, customer_id, customer_name } = data || {}

    const m = (month || '').trim()
    if (!m) {
      return { code: 400, msg: 'month 必填，格式如 2025-02' }
    }

    if (!customer_id && !customer_name) {
      return { code: 400, msg: '客户必填' }
    }

    let cid = customer_id || ''
    let cname = customer_name || ''

    // 更严格：按名称没找到客户时直接报错，不再用 exists(true) 兜底
    if (!cid && cname) {
      const cRes = await customers.where({ name: cname }).get()
      if (cRes.data.length > 0) {
        cid = cRes.data[0]._id
        cname = cRes.data[0].name
      } else {
        return { code: 404, msg: '未找到该客户，请确认名称' }
      }
    }

    if (!cid) {
      return { code: 400, msg: '客户信息有误，请重新选择' }
    }

    const [yearStr, monthStr] = m.split('-')
    const year = Number(yearStr)
    const mon = Number(monthStr)

    if (!year || !mon || mon < 1 || mon > 12) {
      return {
        code: 400,
        msg: 'month 格式不正确，应为 YYYY-MM，例如 2025-02'
      }
    }

    const nextMonth =
      mon === 12
        ? `${year + 1}-01`
        : `${year}-${String(mon + 1).padStart(2, '0')}`

    const date_from = `${m}-01`

    const where = {
      customer_id: cid,
      date: dbCmd.gte(date_from).and(dbCmd.lt(`${nextMonth}-01`))
    }

    const res = await sales.where(where).orderBy('date', 'asc').get()

    const docs = res.data || []

    const dayMap = Object.create(null)

    function getOutNet(doc) {
      if (typeof doc.out_net_total === 'number') return toNumber(doc.out_net_total, 0)
      if (typeof doc.net_weight_out === 'number') return toNumber(doc.net_weight_out, 0)
      return 0
    }

    function getBackNet(doc) {
      if (typeof doc.back_net_total === 'number') return toNumber(doc.back_net_total, 0)
      if (typeof doc.net_weight_back === 'number') return toNumber(doc.net_weight_back, 0)
      return 0
    }

    function getShouldReceive(doc) {
      if (typeof doc.should_receive === 'number') return toNumber(doc.should_receive, 0)
      if (typeof doc.amount === 'number') return toNumber(doc.amount, 0)
      return 0
    }

    docs.forEach(doc => {
      const d = doc.date || ''
      if (!d) return

      if (!dayMap[d]) {
        dayMap[d] = {
          date: d,
          out_net: 0,
          back_net: 0,
          net_total: 0,
          should_receive: 0,
          amount_received: 0,
          unpaid: 0,
          count: 0
        }
      }

      const row = dayMap[d]
      const outNet = getOutNet(doc)
      const backNet = getBackNet(doc)
      const shouldRecv = getShouldReceive(doc)
      const recv = toNumber(doc.amount_received, 0)
      const unpaid = shouldRecv - recv

      row.out_net += outNet
      row.back_net += backNet
      row.net_total += outNet - backNet
      row.should_receive += shouldRecv
      row.amount_received += recv
      row.unpaid += unpaid
      row.count += 1
    })

    const days = Object.values(dayMap).sort((a, b) => {
      if (a.date < b.date) return -1
      if (a.date > b.date) return 1
      return 0
    })

    let total_out_net = 0
    let total_back_net = 0
    let total_net = 0
    let total_should_receive = 0
    let total_amount_received = 0
    let total_unpaid = 0

    days.forEach(d => {
      total_out_net += d.out_net
      total_back_net += d.back_net
      total_net += d.net_total
      total_should_receive += d.should_receive
      total_amount_received += d.amount_received
      total_unpaid += d.unpaid
    })

    return {
      code: 0,
      data: {
        customer_id: cid,
        customer_name: cname,
        month: m,
        days,
        total_out_net,
        total_back_net,
        total_net,
        total_should_receive,
        total_amount_received,
        total_unpaid
      }
    }
  }

  // =========================
  // 9. 按客户 + 月份统计日度对账
  // =========================
  if (action === 'statMonthlyByCustomer') {
    const { customer_id, year, month } = data || {}

    if (!customer_id) {
      return { code: 400, msg: 'customer_id 必填' }
    }

    const now = new Date()
    const y = Number(year) || now.getFullYear()
    const m = Number(month) || now.getMonth() + 1
    const mm = String(m).padStart(2, '0')

    const startDate = `${y}-${mm}-01`
    const endDate = `${y}-${mm}-31`

    const listRes = await sales
      .where({
        customer_id,
        date: dbCmd.gte(startDate).and(dbCmd.lte(endDate))
      })
      .orderBy('date', 'asc')
      .get()

    const docs = listRes.data || []

    const mapByDate = Object.create(null)

    const toNum = v => {
      const n = Number(v)
      return Number.isNaN(n) ? 0 : n
    }

    docs.forEach(doc => {
      const d = doc.date || ''
      if (!d) return

      if (!mapByDate[d]) {
        mapByDate[d] = {
          date: d,
          out_net: 0,
          back_net: 0,
          net_out: 0,
          should_receive: 0,
          received: 0,
          unpaid: 0,
          sale_ids: []
        }
      }

      const row = mapByDate[d]

      const outNet =
        (doc.out_net_total != null ? toNum(doc.out_net_total) : 0) ||
        toNum(doc.net_weight_out)
      const backNet =
        (doc.back_net_total != null ? toNum(doc.back_net_total) : 0) ||
        toNum(doc.net_weight_back)

      const should = toNum(doc.amount)
      const rec = toNum(doc.amount_received)
      const unp = Math.max(should - rec, 0)

      row.out_net += outNet
      row.back_net += backNet
      row.net_out += outNet - backNet
      row.should_receive += should
      row.received += rec
      row.unpaid += unp
      row.sale_ids.push(doc._id)
    })

    const rows = Object.values(mapByDate).sort((a, b) => {
      if (a.date < b.date) return -1
      if (a.date > b.date) return 1
      return 0
    })

    let total_out_net = 0
    let total_back_net = 0
    let total_net_out = 0
    let total_should = 0
    let total_received = 0
    let total_unpaid = 0

    rows.forEach(r => {
      total_out_net += r.out_net
      total_back_net += r.back_net
      total_net_out += r.net_out
      total_should += r.should_receive
      total_received += r.received
      total_unpaid += r.unpaid
    })

    const summary = {
      year: y,
      month: m,
      total_out_net,
      total_back_net,
      total_net_out,
      total_should,
      total_received,
      total_unpaid,
      record_count: rows.length
    }

    return {
      code: 0,
      data: {
        summary,
        rows
      }
    }
  }

  // =========================
  // 10. 查询客户最近一条流量记录（给“上次表数”用）
  // =========================
  if (action === 'getLastFlowRecord') {
    const { customerId } = data || {}
    if (!customerId) {
      return { code: 400, msg: 'customerId 必填' }
    }

    const res = await sales
      .where({
        customer_id: customerId,
        price_unit: 'm3'
      })
      .orderBy('date', 'desc')
      .orderBy('created_at', 'desc')
      .limit(1)
      .get()

    const doc = (res.data || [])[0] || null

    if (!doc) {
      return { code: 0, data: null }
    }

    return {
      code: 0,
      data: {
        lastRecordId: doc._id,
        flowIndexCurr: doc.flow_index_curr || null
      }
    }
  }

  // =========================
  // 默认：未知 action
  // =========================
  return {
    code: 400,
    msg: '未知 action'
  }
}