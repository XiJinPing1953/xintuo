'use strict'

const db = uniCloud.database()
const dbCmd = db.command

const usersCol = db.collection('crm_users')
const bottlesCol = db.collection('crm_bottles')
const fillingCol = db.collection('crm_filling_records')
const logsCol = db.collection('crm_operation_logs')

// 新增：进站 & 销售集合
const gasInCol = db.collection('crm_gas_in')
const salesCol = db.collection('crm_sale_records')

async function getUserByToken(token) {
        if (!token) return null
        const res = await usersCol.where({
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
                console.error('[crm-filling] recordLog failed', action, err)
        }
}

function toNumber(v, def = null) {
	if (v === '' || v === null || typeof v === 'undefined') return def
	const n = Number(v)
	return Number.isNaN(n) ? def : n
}

// 统一用 YYYY-MM-DD 字符串
function normalizeDateStr(tsOrStr) {
	if (!tsOrStr) return ''
	if (typeof tsOrStr === 'string') {
		return tsOrStr.slice(0, 10)
	}
	const d = new Date(tsOrStr)
	const y = d.getFullYear()
	const m = String(d.getMonth() + 1).padStart(2, '0')
	const dd = String(d.getDate()).padStart(2, '0')
	return `${y}-${m}-${dd}`
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
	// 1. 新增灌装记录 action: create
	// =========================
	if (action === 'create') {
		const {
			bottle_no,
			tare_fill,
			gross_fill,
			net_fill, // 前端算好了也行，不信就后端再算一次
			operator,
			remark,
			date // 可选，没传就用今天
		} = data || {}

		const no = (bottle_no || '').trim()
		if (!no) {
			return {
				code: 400,
				msg: 'bottle_no 必填'
			}
		}

		const tare = toNumber(tare_fill, null)
		const gross = toNumber(gross_fill, null)
		let net = toNumber(net_fill, null)

		if (tare == null || gross == null) {
			return {
				code: 400,
				msg: 'tare_fill 和 gross_fill 必填且为数字'
			}
		}
		if (net == null) {
			net = gross - tare
		}

		const now = Date.now()
		const dateStr = normalizeDateStr(date || now)

		// 先查一次瓶子
		let bottleRes = await bottlesCol.where({
			number: no
		}).limit(1).get()
		let bottle = bottleRes.data[0] || null

		// 若不存在，后台兜底：走 quickCreate 自动补瓶子
		// 这样任何入口只要调 crm-filling.create，数据都不会残缺
		if (!bottle) {
			try {
				const quickRes = await uniCloud.callFunction({
					name: 'crm-bottle',
					data: {
						action: 'quickCreate',
						token,
                                                data: {
                                                        number: no,
                                                        // 如果本次灌装录了皮重，就拿来当铭牌皮重初始值
                                                        tare_weight: tare != null ? tare : null,
                                                        status: 'in_station',
                                                        remark: '由灌装记录自动建档'
                                                }
                                        }
                                })
				const qr = quickRes.result || {}
				if (qr.code === 0 && qr.data) {
					bottle = qr.data
				}
			} catch (e) {
				console.error('auto quickCreate bottle error:', e)
				// 兜底失败也不要阻塞灌装，只是 bottle_id 为空
			}
		}

		const doc = {
			bottle_no: no,
			bottle_id: bottle ? bottle._id : null,

			// 灌装时的称重（全部 kg）
			tare_fill: tare, // 灌装前皮重
			gross_fill: gross, // 灌装后毛重
			net_fill: net, // 灌装净重（毛 - 皮）

			date: dateStr,
			timestamp: now,

			operator: operator || user.username || user.name || '',
			remark: remark || '',

			created_at: now,
			updated_at: now,
			created_by: user._id,
			updated_by: user._id
		}

                const addRes = await fillingCol.add(doc)
                await recordLog(user, 'filling_create', { id: addRes.id, bottle_no: no, date: dateStr })

		// 顺手更新瓶子上的“最近一次灌装信息”（只是缓存，不影响三条线独立核算）
		if (bottle && bottle._id) {
			const bottleUpdate = {
				// 新字段：最近一次灌装（全部 kg）
				last_fill_date: dateStr,
				last_fill_tare: tare,
				last_fill_gross: gross,
				last_fill_net: net,

				// 兼容旧字段（如果别的页面还在用，可以继续用）
				filling_gross_weight: gross,
				filling_net_weight: net,
				next_out_gross: gross,
				next_out_net: net,

				updated_at: now,
				updated_by: user._id
			}

			// 若瓶子还没维护铭牌皮重，但这次灌装录了皮重，可以顺便写上
			if (bottle.tare_weight == null && tare != null) {
				bottleUpdate.tare_weight = tare
			}

			await bottlesCol.doc(bottle._id).update(bottleUpdate)
		}

                return {
                        code: 0,
                        msg: 'created',
                        id: addRes.id,
                        data: Object.assign({
                                _id: addRes.id
                        }, doc)
                }
        }

	// =========================
	// 2. 列表：按日期范围 + 分页  action: list
	// =========================
	if (action === 'list') {
		const {
			page = 1,
				pageSize = 50,
				start_date,
				end_date,
				bottle_no
		} = data || {}

		const where = {}

		if (start_date || end_date) {
			const start = (start_date || '').trim()
			const end = (end_date || '').trim()
			if (start && end) {
				where.date = dbCmd.gte(start).and(dbCmd.lte(end))
			} else if (start) {
				where.date = dbCmd.gte(start)
			} else if (end) {
				where.date = dbCmd.lte(end)
			}
		}

		if (bottle_no) {
			where.bottle_no = (bottle_no || '').trim()
		}

		const skip = (page - 1) * pageSize

		const query = fillingCol
			.where(where)
			.orderBy('date', 'desc')
			.orderBy('timestamp', 'desc')

		const [listRes, countRes] = await Promise.all([
			query.skip(skip).limit(pageSize).get(),
			fillingCol.where(where).count()
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
	// 3. 汇总：进站 / 灌装 / 销售 总量  action: summary
	// =========================
	if (action === 'summary') {
		const {
			start_date,
			end_date,
			date_from,
			date_to
		} = data || {}

		// 和 crm-gas-in 一样，兼容两种写法
		const start = (start_date || date_from || '').trim()
		const end = (end_date || date_to || '').trim()

		// 公共日期条件
		const buildWhereByDate = () => {
			const whereList = []
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
			return whereList.length ? dbCmd.and(...whereList) : {}
		}

		const where = buildWhereByDate()

		try {
			// 1）灌装总量（站内灌装净重，kg）
			const fillAgg = await fillingCol
				.aggregate()
				.match(where)
				.group({
					_id: null,
					total_net: dbCmd.aggregate.sum('$net_fill'),
					total_count: dbCmd.aggregate.sum(1)
				})
				.end()

			const fillRow = (fillAgg && fillAgg.data && fillAgg.data[0]) || {}
			const fill_total = toNumber(fillRow.total_net, 0) || 0
			const fill_count = toNumber(fillRow.total_count, 0) || 0

			// 2）进站总量（车进站净重，kg）
			const inboundAgg = await gasInCol
				.aggregate()
				.match(where)
				.group({
					_id: null,
					total_net: dbCmd.aggregate.sum('$net_weight'),
					total_count: dbCmd.aggregate.sum(1)
				})
				.end()

			const inboundRow = (inboundAgg && inboundAgg.data && inboundAgg.data[0]) || {}
			const inbound_total = toNumber(inboundRow.total_net, 0) || 0
			const inbound_count = toNumber(inboundRow.total_count, 0) || 0

			// 3）销售总量（从站里真正出去的净重，kg）
			//    这里直接用 crm_sale_records.total_net_weight：
			//    total_net_weight = out_net_total - back_net_total
			const saleAgg = await salesCol
				.aggregate()
				.match(where)
				.group({
					_id: null,
					total_net: dbCmd.aggregate.sum('$total_net_weight'),
					total_count: dbCmd.aggregate.sum(1)
				})
				.end()

			const saleRow = (saleAgg && saleAgg.data && saleAgg.data[0]) || {}
			const sale_total = toNumber(saleRow.total_net, 0) || 0
			const sale_count = toNumber(saleRow.total_count, 0) || 0

			return {
				code: 0,
				msg: 'ok',
				data: {
					inbound_total, // 进站合计（kg）
					inbound_count, // 进站记录数
					fill_total, // 灌装合计（kg）
					fill_count, // 灌装记录数
					sale_total, // 销售合计（kg）
					sale_count // 销售记录数
				}
			}
		} catch (e) {
			console.error('crm-filling summary error:', e)
			return {
				code: 500,
				msg: '汇总失败，请稍后再试'
			}
		}
	}

	// =========================
	// 4. 灌装记录导出（含瓶档字段 & 差异字段） action: export
	// =========================
	if (action === 'export') {
		const {
			start_date,
			end_date
		} = data || {}

		const where = {}
		const start = (start_date || '').trim()
		const end = (end_date || '').trim()

		if (start && end) {
			where.date = dbCmd.gte(start).and(dbCmd.lte(end))
		} else if (start) {
			where.date = dbCmd.gte(start)
		} else if (end) {
			where.date = dbCmd.lte(end)
		}

		// 暂给一个上限，够你日常导出用；真要全库导出可以再拆批次
		const listRes = await fillingCol
			.where(where)
			.orderBy('date', 'asc')
			.orderBy('timestamp', 'asc')
			.limit(1000)
			.get()

		const fillList = listRes.data || []
		if (!fillList.length) {
			return {
				code: 0,
				msg: 'no data',
				data: []
			}
		}

		// 取所有瓶号，批量拉瓶档
		const bottleNos = Array.from(
			new Set(fillList.map(it => (it.bottle_no || '').trim()).filter(Boolean))
		)

		let bottleMap = {}
		if (bottleNos.length) {
			const bottlesRes = await bottlesCol.where({
				number: dbCmd.in(bottleNos)
			}).get()
			const bottles = bottlesRes.data || []
			bottleMap = bottles.reduce((map, b) => {
				if (b && b.number) {
					map[b.number] = b
				}
				return map
			}, {})
		}

		const rows = fillList.map(row => {
			const b = bottleMap[row.bottle_no] || {}

			const tareFill = toNumber(row.tare_fill, null)
			const grossFill = toNumber(row.gross_fill, null)
			const netFill = toNumber(row.net_fill, null)

			const tareWeight = toNumber(b.tare_weight, null)
			const lastGross = toNumber(b.last_gross_weight, null)
			const lastNet = toNumber(b.last_net_weight, null)

			// 差异字段
			const diffTareVsLastGross =
				tareFill != null && lastGross != null ? +(tareFill - lastGross) : null
			const diffTareVsTareWeight =
				tareFill != null && tareWeight != null ? +(tareFill - tareWeight) : null

			return {
				// 灌装记录字段
				date: row.date || '',
				bottle_no: row.bottle_no || '',
				tare_fill: tareFill,
				gross_fill: grossFill,
				net_fill: netFill,
				operator: row.operator || '',
				remark: row.remark || '',

				// 瓶档字段（快照）
				tare_weight: tareWeight,
				last_customer_name: b.last_customer_name || '',
				last_out_date: b.last_out_date || '',
				last_back_date: b.last_back_date || '',
				last_gross_weight: lastGross,
				last_net_weight: lastNet,
				last_return_diff: toNumber(b.last_return_diff, null),

				// 对账/差异字段
				diff_tare_vs_last_gross: diffTareVsLastGross,    // 本次皮重 - 上次回瓶毛重
				diff_tare_vs_tare_weight: diffTareVsTareWeight   // 本次皮重 - 铭牌皮重
				// 后续如需要再补：灌装净重 vs 销售净重等字段，可以在这里扩展
			}
		})

		return {
			code: 0,
			msg: 'ok',
			data: rows
		}
        }

        // =========================
        // 5. 删除灌装记录 action: remove
        // =========================
        if (action === 'remove') {
                const { id } = data || {}
                if (!id) {
                        return {
                                code: 400,
                                msg: 'id 必填'
                        }
                }

                await fillingCol.doc(id).remove()
                await recordLog(user, 'filling_delete', { id })

                return {
                        code: 0,
                        msg: 'deleted'
                }
        }

        // 未知 action
        return {
                code: 400,
		msg: '未知 action'
	}
}