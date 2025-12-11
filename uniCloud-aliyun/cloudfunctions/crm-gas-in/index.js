'use strict'

const db = uniCloud.database()
const dbCmd = db.command

// 入库记录表
const gasInCol = db.collection('crm_gas_in')
const logsCol = db.collection('crm_operation_logs')

// 用户表，用于 token 校验
const users = db.collection('crm_users')

// 工具：根据 token 查用户
async function getUserByToken(token) {
        if (!token) return null
        const res = await users.where({
                token
        }).limit(1).get()
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
                console.error('[crm-gas-in] recordLog failed', action, err)
        }
}

function toNumber(v, def = 0) {
	const n = Number(v)
	return Number.isNaN(n) ? def : n
}

exports.main = async (event, context) => {
	const {
		action,
		data = {},
		token
	} = event

	// ========= 统一鉴权 =========
	const user = await getUserByToken(token)
	if (!user) {
		return {
			code: 401,
			msg: '未登录或登录已过期'
		}
	}

	const userId = user._id

	// =========================================================
	// 1. 列表：按日期范围 + 关键词查询
	//    action: list
	//    支持两种写法：
	//    - date_from / date_to（你原来的）
	//    - start_date / end_date（灌装页那种）
	// =========================================================
	if (action === 'list') {
		const {
			date_from,
			date_to,
			keyword,
			start_date,
			end_date
		} = data

		// 统一一下日期参数
		const start = (start_date || date_from || '').trim()
		const end = (end_date || date_to || '').trim()

		const whereList = []

		// 如果以后要做“不同用户各自一套数据”，可以加一条：
		// whereList.push({ created_by: userId })

		// 日期范围（字符串 YYYY-MM-DD）
		if (start && end) {
			whereList.push({
				date: dbCmd.gte(start).and(dbCmd.lte(end))
			})
		} else if (start) {
			whereList.push({
				date: dbCmd.gte(start)
			})
		} else if (end) {
			whereList.push({
				date: dbCmd.lte(end)
			})
		}

		// 关键词：车牌 / 罐车号 / 液厂 / 送货人员 / 备注
		if (keyword && String(keyword).trim()) {
			const kw = String(keyword).trim()
			const reg = new RegExp(kw, 'i')
			whereList.push(
				dbCmd.or({
					plate_no: reg
				}, {
					tanker_no: reg
				}, {
					factory: reg
				}, {
					sender: reg
				}, {
					remark: reg
				})
			)
		}

		const where = whereList.length ? dbCmd.and(...whereList) : {}

		try {
			const res = await gasInCol
				.where(where)
				.orderBy('date', 'desc')
				.orderBy('created_at', 'desc')
				.limit(500)
				.get()

			const list = res.data || []

			// 确保数字字段都是 Number，方便前端汇总
			const rows = list.map(doc => ({
				...doc,
				load_weight: toNumber(doc.load_weight, 0),
				gross_weight: toNumber(doc.gross_weight, 0),
				tare_weight: toNumber(doc.tare_weight, 0),
				net_weight: toNumber(doc.net_weight, 0),
				loss_amount: toNumber(doc.loss_amount, 0),
				unit_price: toNumber(doc.unit_price, 0),
				amount: toNumber(doc.amount, 0)
			}))

			return {
				code: 0,
				msg: 'ok',
				data: rows
			}
		} catch (e) {
			console.error('crm-gas-in list error:', e)
			return {
				code: 500,
				msg: '查询失败，请稍后再试'
			}
		}
	}

	// =========================================================
	// 2. 新增入库记录  action: create
	// =========================================================
	if (action === 'create') {
		const now = Date.now()

		let loadWeight = toNumber(data.load_weight, 0)
		let grossWeight = toNumber(data.gross_weight, 0)
		let tareWeight = toNumber(data.tare_weight, 0)
		let netWeight = toNumber(data.net_weight, 0)

		// 如果前端没算净重，后端兜一层：毛重 - 皮重
		if (!netWeight && grossWeight && tareWeight) {
			netWeight = grossWeight - tareWeight
		}

		const doc = {
			date: data.date || '', // 入库日期，YYYY-MM-DD 字符串
			product_name: data.product_name || 'LNG', // 品名
			load_weight: loadWeight, // 装车重量
			gross_weight: grossWeight, // 毛重
			tare_weight: tareWeight, // 皮重
			net_weight: netWeight, // 净重
			loss_amount: toNumber(data.loss_amount, 0), // 亏损数量
			unit_price: toNumber(data.unit_price, 0), // 单价
			amount: toNumber(data.amount, 0), // 金额

			plate_no: (data.plate_no || '').trim(), // 车牌
			tanker_no: (data.tanker_no || '').trim(), // 罐车号
			sender: (data.sender || '').trim(), // 送货人员
			factory: (data.factory || '').trim(), // 液厂
			remark: (data.remark || '').trim(), // 备注

			created_at: now,
			updated_at: now,
			created_by: userId,
			updated_by: userId
		}

		if (!doc.date) {
			return {
				code: 400,
				msg: '缺少入库日期'
			}
		}

                try {
                        const res = await gasInCol.add(doc)
                        await recordLog(user, 'gas_in_create', { id: res.id, date: doc.date, plate_no: doc.plate_no })
                        return {
                                code: 0,
                                msg: '新增成功',
                                id: res.id
                        }
		} catch (e) {
			console.error('crm-gas-in create error:', e)
			return {
				code: 500,
				msg: '新增失败，请稍后再试'
			}
		}
	}

	// =========================================================
	// 3. 更新入库记录  action: update
	// =========================================================
	if (action === 'update') {
		const id = data.id || data._id
		if (!id) {
			return {
				code: 400,
				msg: '缺少记录 ID'
			}
		}

		const now = Date.now()

		let loadWeight = toNumber(data.load_weight, 0)
		let grossWeight = toNumber(data.gross_weight, 0)
		let tareWeight = toNumber(data.tare_weight, 0)
		let netWeight = toNumber(data.net_weight, 0)

		if (!netWeight && grossWeight && tareWeight) {
			netWeight = grossWeight - tareWeight
		}

		const patch = {
			date: data.date || '',
			product_name: data.product_name || 'LNG',
			load_weight: loadWeight,
			gross_weight: grossWeight,
			tare_weight: tareWeight,
			net_weight: netWeight,
			loss_amount: toNumber(data.loss_amount, 0),
			unit_price: toNumber(data.unit_price, 0),
			amount: toNumber(data.amount, 0),

			plate_no: (data.plate_no || '').trim(),
			tanker_no: (data.tanker_no || '').trim(),
			sender: (data.sender || '').trim(),
			factory: (data.factory || '').trim(),
			remark: (data.remark || '').trim(),

			updated_at: now,
			updated_by: userId
		}

		if (!patch.date) {
			return {
				code: 400,
				msg: '缺少入库日期'
			}
		}

                try {
                        await gasInCol.doc(id).update(patch)
                        await recordLog(user, 'gas_in_update', { id, date: patch.date })
                        return {
                                code: 0,
                                msg: '更新成功'
                        }
		} catch (e) {
			console.error('crm-gas-in update error:', e)
			return {
				code: 500,
				msg: '更新失败，请稍后再试'
			}
		}
	}

	// =========================================================
	// 4. 删除记录  action: remove
	// =========================================================
	if (action === 'remove') {
		const id = data.id || data._id
		if (!id) {
			return {
				code: 400,
				msg: '缺少记录 ID'
			}
		}

                try {
                        await gasInCol.doc(id).remove()
                        await recordLog(user, 'gas_in_remove', { id })
                        return {
                                code: 0,
                                msg: '删除成功'
                        }
		} catch (e) {
			console.error('crm-gas-in remove error:', e)
			return {
				code: 500,
				msg: '删除失败，请稍后再试'
			}
		}
	}

	// =========================================================
	// 5. 根据 ID 获取一条记录  action: get
	// =========================================================
	if (action === 'get') {
		const id = data.id || data._id
		if (!id) {
			return {
				code: 400,
				msg: '缺少记录 ID'
			}
		}

		try {
			const res = await gasInCol.doc(id).get()
			const doc = res.data[0]
			if (!doc) {
				return {
					code: 404,
					msg: '记录不存在'
				}
			}

			return {
				code: 0,
				msg: 'ok',
				data: doc
			}
		} catch (e) {
			console.error('crm-gas-in get error:', e)
			return {
				code: 500,
				msg: '查询失败，请稍后再试'
			}
		}
	}

	// =========================================================
	// 6. 汇总：按日期范围统计进站总量
	//    action: summary
	//    入参：
	//      start_date / end_date （YYYY-MM-DD）
	//    返回：
	//      inbound_total   进站净重合计（kg）
	//      inbound_count   记录条数
	//      loss_total      亏损数量合计
	//      amount_total    金额合计
	// =========================================================
	if (action === 'summary') {
		const {
			start_date,
			end_date,
			date_from,
			date_to
		} = data || {}

		const start = (start_date || date_from || '').trim()
		const end = (end_date || date_to || '').trim()

		const whereList = []

		// 同样可以在这里加多租户条件：
		// whereList.push({ created_by: userId })

		if (start && end) {
			whereList.push({
				date: dbCmd.gte(start).and(dbCmd.lte(end))
			})
		} else if (start) {
			whereList.push({
				date: dbCmd.gte(start)
			})
		} else if (end) {
			whereList.push({
				date: dbCmd.lte(end)
			})
		}

		const where = whereList.length ? dbCmd.and(...whereList) : {}

		try {
			const aggRes = await gasInCol
				.aggregate()
				.match(where)
				.group({
					_id: null,
					total_net: dbCmd.aggregate.sum('$net_weight'),
					total_loss: dbCmd.aggregate.sum('$loss_amount'),
					total_amount: dbCmd.aggregate.sum('$amount'),
					// 记录条数
					total_count: dbCmd.aggregate.sum(1)
				})
				.end()

			const row = (aggRes && aggRes.data && aggRes.data[0]) || {}

			const inboundTotal = toNumber(row.total_net, 0)
			const lossTotal = toNumber(row.total_loss, 0)
			const amountTotal = toNumber(row.total_amount, 0)
			const inboundCount = toNumber(row.total_count, 0)

			return {
				code: 0,
				msg: 'ok',
				data: {
					inbound_total: inboundTotal,
					inbound_count: inboundCount,
					loss_total: lossTotal,
					amount_total: amountTotal
				}
			}
		} catch (e) {
			console.error('crm-gas-in summary error:', e)
			return {
				code: 500,
				msg: '汇总失败，请稍后再试'
			}
		}
	}

	// 未知 action
	return {
		code: 400,
		msg: '未知 action'
	}
}