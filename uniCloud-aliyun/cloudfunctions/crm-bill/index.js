'use strict'

const db = uniCloud.database()
const dbCmd = db.command

const sales = db.collection('crm_sale_records')
const users = db.collection('crm_users')
const customers = db.collection('crm_customers')

// 新增：用于导出 Excel
const xlsx = require('xlsx')

async function getUserByToken(token) {
	if (!token) return null
	const res = await users.where({
		token
	}).get()
	return res.data[0] || null
}

function toNumber(v, def = 0) {
	const n = Number(v)
	return Number.isNaN(n) ? def : n
}

// 文件名用日期格式：把 "YYYY-MM-DD" 变成 "YYYY-12-5"（去掉前导 0）
function formatDateForFile(dateStr) {
	if (!dateStr || typeof dateStr !== 'string') return ''
	const parts = dateStr.split('-')
	if (parts.length !== 3) return dateStr
	const y = parts[0]
	const m = Number(parts[1]) || 0
	const d = Number(parts[2]) || 0
	return `${y}-${m}-${d}` // 这里故意不用 '/', 避免变成多级路径
}

// Excel 用日期格式：把 "YYYY-MM-DD" 变成 "YYYY/MM/DD"
function formatDateForExcel(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') return ''
        const parts = dateStr.split('-')
        if (parts.length !== 3) return dateStr
        return `${parts[0]}/${parts[1]}/${parts[2]}`
}

function sanitizeFileNamePart(name, fallback = '导出') {
        const str = (name || '').toString().trim()
        if (!str) return fallback
        return str.replace(/[\\/:*?"<>|]/g, '_')
}

function buildFlowIntervals(list) {
        const toFinite = (v) => {
                const n = Number(v)
                return Number.isFinite(n) ? n : null
        }

        const sorted = (list || [])
                .filter((doc) => (doc.price_unit || '').toLowerCase() === 'm3')
                .slice()
                .sort((a, b) => {
                        const da = new Date(a.date || '').getTime()
                        const db = new Date(b.date || '').getTime()
                        if (da !== db) return da - db
                        return (a.created_at || 0) - (b.created_at || 0)
                })

        let lastReading = null
        let prevDoc = null
        const intervals = []

        const calcTheoreticalFromDoc = (doc) => {
                if (!doc) return null

                const raw = toFinite(doc.flow_theoretical_volume_m3)
                if (raw != null) return raw

                const ratio = toFinite(doc.flow_theory_ratio || doc.flow_conversion_ratio)
                const weight = toFinite(doc.total_net_weight)

                if (ratio != null && ratio > 0 && weight != null) {
                        const v = weight * ratio
                        return Number.isFinite(v) ? v : null
                }

                return null
        }

        const fix2 = (v) => {
                const n = Number(v)
                return Number.isFinite(n) ? Number(n.toFixed(2)) : 0
        }

        sorted.forEach((doc) => {
                const curr = toFinite(doc.flow_index_curr)
                if (curr == null) {
                        return
                }

                if (lastReading != null && prevDoc) {
                        const start = lastReading
                        const consumption = curr - start
                        const theoretical = calcTheoreticalFromDoc(prevDoc)

                        const unitPrice =
                                doc.flow_unit_price != null
                                        ? Number(doc.flow_unit_price)
                                        : (doc.unit_price != null ? Number(doc.unit_price) : null)

                        let should = null
                        if (doc.flow_amount_should != null) {
                                const n = Number(doc.flow_amount_should)
                                should = Number.isFinite(n) ? n : null
                        }

                        if (should == null && theoretical != null && unitPrice != null) {
                                should = theoretical * unitPrice
                        }

                        if (should == null) {
                                const n = Number(doc.amount || 0)
                                should = Number.isFinite(n) ? n : 0
                        }

                        let received = null
                        if (doc.flow_amount_received != null) {
                                const n = Number(doc.flow_amount_received)
                                received = Number.isFinite(n) ? n : null
                        }

                        if (received == null) {
                                const n = Number(doc.amount_received || 0)
                                received = Number.isFinite(n) ? n : 0
                        }

                        const writeOff = toNumber(doc.write_off, 0)
                        const unpaid = Math.max((should || 0) - (received || 0) - writeOff, 0)

                        intervals.push({
                                _id: doc._id,
                                customer_name: doc.customer_name || '',
                                record_date: doc.date,
                                period_start_reading: start,
                                period_end_reading: curr,
                                consumption_m3: consumption,
                                theoretical_m3: theoretical != null ? theoretical : null,
                                unit_price: unitPrice,
                                amount_should: fix2(should),
                                amount_received: fix2(received),
                                write_off: writeOff,
                                unpaid,
                                payment_status: doc.flow_payment_status || doc.payment_status || '',
                                remark: doc.flow_remark || doc.remark || ''
                        })
                }

                lastReading = curr
                prevDoc = doc
        })

        return intervals
}

// 从销售记录里解析多瓶号，和前端 getBottleList 保持一致
function getBottleListFromDoc(doc, type) {
	const trim = s => String(s || '').trim()
	let list = []

	if (type === 'out') {
		if (Array.isArray(doc.out_items) && doc.out_items.length) {
			list = doc.out_items.map(r => trim(r.bottle_no)).filter(Boolean)
		} else if (doc.bottle_no) {
			list = [trim(doc.bottle_no)]
		}
	} else if (type === 'back') {
		if (Array.isArray(doc.back_items) && doc.back_items.length) {
			list = doc.back_items.map(r => trim(r.bottle_no)).filter(Boolean)
		} else if (doc.return_bottle_no) {
			list = [trim(doc.return_bottle_no)]
		}
	} else if (type === 'deposit') {
		if (Array.isArray(doc.deposit_items) && doc.deposit_items.length) {
			list = doc.deposit_items.map(r => trim(r.bottle_no)).filter(Boolean)
		} else if (doc.deposit_bottles_raw) {
			list = doc.deposit_bottles_raw
				.split(/[\/、,，\s]+/)
				.map(s => trim(s))
				.filter(Boolean)
		}
	}

	return list
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

	// =========================================================
	// A. 客户 + 时间范围 汇总（供 /pages/bill/monthly 使用）
	//    兼容两种 action 名：customerSummaryByRange / monthlyByCustomer
	//    ✅ 客户现在是“可选”：不传 = 汇总全部客户
	// =========================================================
	if (action === 'customerSummaryByRange' || action === 'monthlyByCustomer') {
		let {
			customer_id,
			customer_name,
			year,
			month,
			date_from,
			date_to
		} = data || {}

		// 1) 客户条件：id 或 名称 任意一个匹配即可；都没传 = 全部客户
		const customerCond = []
		if (customer_id) customerCond.push({ customer_id })
		if (customer_name) customerCond.push({ customer_name })

		// 2) 时间范围：
		// - 如果前端传的是 date_from / date_to，就直接用
		// - 如果只传 year/month，则自动算这个月的 1 号~月底
		if (!date_from || !date_to) {
			if (!year || !month) {
				return {
					code: 400,
					msg: '缺少日期范围或年月参数'
				}
			}
			const y = Number(year)
			const m = Number(month)
			if (!y || !m) {
				return {
					code: 400,
					msg: '年月格式不正确'
				}
			}
			const mm = String(m).padStart(2, '0')
			const firstDay = `${y}-${mm}-01`
			const lastDay = `${y}-${mm}-31`
			date_from = firstDay
			date_to = lastDay
		}

		const dateCond = {
			date: dbCmd.gte(date_from).and(dbCmd.lte(date_to))
		}

		// 3) 最终 where：
		//    - 如果有 customer 条件：日期 AND (customer_id = ? OR customer_name = ?)
		//    - 如果没客户条件：只按日期，等于“全部客户”
		let where
		if (customerCond.length) {
			where = dbCmd.and(
				dateCond,
				dbCmd.or(...customerCond)
			)
		} else {
			where = dateCond
		}

		// 4) 查出这一段时间内的所有销售记录
		const listRes = await sales
			.where(where)
			.orderBy('date', 'asc')
			.orderBy('created_at', 'asc')
			.get()

		const list = listRes.data || []

		// 5) 汇总
		let out_net_total = 0
		let back_net_total = 0
		let net_total = 0
		let amount_total = 0
		let amount_received_total = 0
		let unpaid_total = 0

		list.forEach(doc => {
			const outNet = toNumber(doc.net_weight_out, 0)
			const backNet = toNumber(doc.net_weight_back, 0)
			const totalNet = doc.total_net_weight != null
				? toNumber(doc.total_net_weight, 0)
				: (outNet - backNet)

			const amt = toNumber(doc.amount, 0)
			const amtRecv = toNumber(doc.amount_received, 0)
			const writeOff = toNumber(doc.write_off, 0) // 新增字段，不存在时当 0

			out_net_total += outNet
			back_net_total += backNet
			net_total += totalNet
			amount_total += amt
			amount_received_total += amtRecv
			unpaid_total += Math.max(amt - amtRecv - writeOff, 0)
		})

		return {
			code: 0,
			data: {
				out_net_total,
				back_net_total,
				net_total,
				amount_total,
				amount_received_total,
				unpaid_total,
				record_count: list.length
			}
		}
	}

	// =========================================================
	// B. 客户 + 时间范围 明细（供 /pages/bill/monthly-detail 使用）
	//    action: customerDailyDetailByRange
	// =========================================================
	if (action === 'customerDailyDetailByRange') {
		const {
			customer_id,
			customer_name,
			date_from,
			date_to
		} = data || {}

		if (!customer_id && !customer_name) {
			return {
				code: 400,
				msg: '缺少客户参数'
			}
		}
		if (!date_from || !date_to) {
			return {
				code: 400,
				msg: '缺少日期范围'
			}
		}

		const dateCond = {
			date: dbCmd.gte(date_from).and(dbCmd.lte(date_to))
		}

		const customerCond = []
		if (customer_id) customerCond.push({ customer_id })
		if (customer_name) customerCond.push({ customer_name })

		if (!customerCond.length) {
			return {
				code: 400,
				msg: '缺少客户参数'
			}
		}

		const where = dbCmd.and(
			dateCond,
			dbCmd.or(...customerCond)
		)

		const listRes = await sales
			.where(where)
			.orderBy('date', 'asc')
			.orderBy('created_at', 'asc')
			.limit(500) // 一般够用
			.get()

		const list = listRes.data || []

		// 在这里不用汇总，让前端自己算 stats，但把未收算好
                const rows = list.map(doc => {
                        const amt = toNumber(doc.amount, 0)
                        const amtRecv = toNumber(doc.amount_received, 0)
                        const writeOff = toNumber(doc.write_off, 0)
                        const unpaid = Math.max(amt - amtRecv - writeOff, 0)

                        return Object.assign({}, doc, {
                                amount: amt,
                                amount_received: amtRecv,
                                write_off: writeOff,
                                unpaid
                        })
                })

                const flowIntervals = buildFlowIntervals(rows)

                return {
                        code: 0,
                        data: rows,
                        flow_intervals: flowIntervals
                }
        }

	// =========================================================
	// C. 自动分配收款 + 抹零到多条销售记录
	//    action: autoDistributePayment
	//    被 /pages/bill/monthly-detail 的「智能分配」按钮调用
	// =========================================================
	if (action === 'autoDistributePayment') {
		const {
			record_ids = [], // 要参与分配的销售记录 _id 列表（按前端当前排序传）
			pay_amount = 0,  // 本次实收现金/转账金额
			write_off_amount = 0 // 本次抹零金额（可为 0）
		} = data || {}

		if (!Array.isArray(record_ids) || record_ids.length === 0) {
			return {
				code: 400,
				msg: '缺少待分配的记录列表'
			}
		}

		const pay = Number(pay_amount) || 0
		const writeOff = Number(write_off_amount) || 0

		if (pay < 0 || writeOff < 0) {
			return {
				code: 400,
				msg: '金额和抹零不能为负数'
			}
		}
		if (pay === 0 && writeOff === 0) {
			return {
				code: 400,
				msg: '本次收款金额和抹零不能都为 0'
			}
		}

		// 1) 把这些记录按日期（旧 -> 新）排好
		const listRes = await sales
			.where({
				_id: dbCmd.in(record_ids)
			})
			.orderBy('date', 'asc')
			.orderBy('created_at', 'asc')
			.get()

		const docs = listRes.data || []
		if (!docs.length) {
			return {
				code: 400,
				msg: '未找到匹配的销售记录'
			}
		}

		let payLeft = pay
		let writeOffLeft = writeOff

		const updates = []

		for (const doc of docs) {
			const id = doc._id
			const amount = toNumber(doc.amount, 0)
			const receivedOld = toNumber(doc.amount_received, 0)
			const writeOffOld = toNumber(doc.write_off, 0)

			// 当前这单还差多少没结清
			let remain = amount - receivedOld - writeOffOld
			if (remain <= 0) {
				continue
			}

			const coverLeft = payLeft + writeOffLeft
			if (coverLeft <= 0) {
				break
			}

			// 这一单本次最多能覆盖多少
			const use = Math.min(remain, coverLeft)

			// 现金优先，其次抹零
			const cashUse = Math.min(use, payLeft)
			const writeOffUse = use - cashUse

			const receivedNew = receivedOld + cashUse
			const writeOffNew = writeOffOld + writeOffUse
			const unpaidNew = Math.max(amount - receivedNew - writeOffNew, 0)

			let paymentStatus = doc.payment_status || ''
			if (unpaidNew <= 0.000001) {
				paymentStatus = '已收清'
			} else if (receivedNew > 0) {
				paymentStatus = '部分收'
			} else {
				paymentStatus = '未收'
			}

			updates.push(
				sales.doc(id).update({
					amount_received: receivedNew,
					write_off: writeOffNew,
					payment_status: paymentStatus,
					updated_at: Date.now(),
					updated_by: user._id
				})
			)

			payLeft -= cashUse
			writeOffLeft -= writeOffUse
		}

		if (updates.length === 0) {
			return {
				code: 400,
				msg: '没有可分配的记录，可能都已结清'
			}
		}

		await Promise.all(updates)

		return {
			code: 0,
			msg: '分配完成',
			data: {
				updated: updates.length,
				pay_used: pay - payLeft,
				write_off_used: writeOff - writeOffLeft,
				pay_left: payLeft,
				write_off_left: writeOffLeft
			}
		}
	}

	// =========================================================
	// D. 导出 客户 + 时间范围 明细为 Excel（monthly-detail 页面）
	//    action: exportCustomerDailyDetailExcel
	// =========================================================
	if (action === 'exportCustomerDailyDetailExcel') {
		const {
			customer_id,
			customer_name,
			date_from,
			date_to
		} = data || {}

		if (!customer_id && !customer_name) {
			return {
				code: 400,
				msg: '缺少客户参数'
			}
		}
		if (!date_from || !date_to) {
			return {
				code: 400,
				msg: '缺少日期范围'
			}
		}

		const dateCond = {
			date: dbCmd.gte(date_from).and(dbCmd.lte(date_to))
		}

		const customerCond = []
		if (customer_id) customerCond.push({ customer_id })
		if (customer_name) customerCond.push({ customer_name })

		if (!customerCond.length) {
			return {
				code: 400,
				msg: '缺少客户参数'
			}
		}

		const where = dbCmd.and(
			dateCond,
			dbCmd.or(...customerCond)
		)

		const listRes = await sales
			.where(where)
			.orderBy('date', 'asc')
			.orderBy('created_at', 'asc')
			.limit(1000) // 导出上限，防止太大
			.get()

                const list = listRes.data || []
                if (!list.length) {
                        return {
                                code: 400,
                                msg: '该时间段暂无销售记录，无法导出'
                        }
                }

                const flowIntervals = buildFlowIntervals(list)

		// ========= AOA 数据 =========
		const aoa = []

		// 1) 表格标题行：客户名明细
		const displayCustomerName =
			customer_name ||
			(list[0] && list[0].customer_name) ||
			''
		const displayFrom = date_from || ''
		const displayTo = date_to || ''

		const titleText = displayCustomerName
			? `${displayCustomerName} ${displayFrom} ~ ${displayTo} 明细`
			: `客户明细 ${displayFrom} ~ ${displayTo}`

		aoa.push([titleText])

		// 3) 表头行：和页面一列一列保持一致
		aoa.push([
			'日期',
			'出瓶号',
			'回瓶号',
			'存瓶号',
			'出瓶净重(kg)',
			'回瓶净重(kg)',
			'单价',
			'应收金额',
			'实收金额',
			'抹零金额',
			'未收金额',
			'配送员',
			'车号',
			'收款状态',
			'备注'
		])

		// 4) 数据行
		list.forEach(doc => {
			const outList = getBottleListFromDoc(doc, 'out')
			const backList = getBottleListFromDoc(doc, 'back')
			const depositList = getBottleListFromDoc(doc, 'deposit')

			const outStr = outList.join(' / ')
			const backStr = backList.join(' / ')
			const depositStr = depositList.join(' / ')

			const outNet = doc.out_net_total != null
				? toNumber(doc.out_net_total, 0)
				: toNumber(doc.net_weight_out, 0)
			const backNet = doc.back_net_total != null
				? toNumber(doc.back_net_total, 0)
				: toNumber(doc.net_weight_back, 0)

			const amt = toNumber(doc.amount, 0)
			const amtRecv = toNumber(doc.amount_received, 0)
			const writeOff = toNumber(doc.write_off, 0)
			const unpaid = Math.max(amt - amtRecv - writeOff, 0)

			const dateCell = formatDateForExcel(doc.date)

			aoa.push([
				dateCell,
				outStr,
				backStr,
				depositStr,
				outNet,
				backNet,
				doc.unit_price != null ? Number(doc.unit_price) : '',
				amt,
				amtRecv,
				writeOff,
				unpaid,
				doc.delivery_man || '',
				doc.car_no || '',
				doc.payment_status || '',
				doc.remark || ''
			])
		})

		// ========= 生成工作簿并写入 buffer =========
		const wb = xlsx.utils.book_new()
		const ws = xlsx.utils.aoa_to_sheet(aoa)
		xlsx.utils.book_append_sheet(wb, ws, '日度明细')

                // ⭐⭐ 流量结算 sheet（只导出 price_unit === 'm3' 的记录）
                if (flowIntervals.length) {
                        const flowAoa = []

			// 标题：带客户名称
			const flowTitle = displayCustomerName
				? `${displayCustomerName} 流量结算明细 ${displayFrom} ~ ${displayTo}`
				: `流量结算明细 ${displayFrom} ~ ${displayTo}`

			flowAoa.push([flowTitle])

			// 表头：抄表 + 金额（注意：不导出“客户”和“换算系数”列）
			flowAoa.push([
				'抄表日期',
				'上次表数',
				'本次表数',
				'用气量(m³)',
				'理论用气量(m³)',
				'单价(元/m³)',
				'理论应收(元)',
				'实收(元)',
				'抹零金额',
				'未收金额',
				'付款状态',
				'备注'
			])

                        flowIntervals.forEach(doc => {
                                const dateCell = formatDateForExcel(doc.record_date)

                                const prev = doc.period_start_reading != null ? Number(doc.period_start_reading) : ''
                                const curr = doc.period_end_reading != null ? Number(doc.period_end_reading) : ''
                                const vol = doc.consumption_m3 != null ? Number(doc.consumption_m3) : ''
                                const theoVol = doc.theoretical_m3 != null ? Number(doc.theoretical_m3) : ''

                                const unitPrice = doc.unit_price != null ? Number(doc.unit_price) : ''
                                const should = doc.amount_should != null ? Number(doc.amount_should) : ''
                                const received = doc.amount_received != null ? Number(doc.amount_received) : ''
                                const writeOff = toNumber(doc.write_off, 0)
                                const unpaid = Math.max((Number(should) || 0) - (Number(received) || 0) - writeOff, 0)

                                flowAoa.push([
                                        dateCell,
                                        prev,
                                        curr,
                                        vol,
                                        theoVol,
                                        unitPrice,
                                        should,
                                        received,
                                        writeOff,
                                        unpaid,
                                        doc.payment_status || '',
                                        doc.remark || ''
                                ])
                        })

			const wsFlow = xlsx.utils.aoa_to_sheet(flowAoa)
			xlsx.utils.book_append_sheet(wb, wsFlow, '流量结算')
		}

		const buffer = xlsx.write(wb, {
			bookType: 'xlsx',
			type: 'buffer'
		})

		// ✅ 导出文件名：客户名_日期范围.xlsx
                const safeCustomerName = sanitizeFileNamePart(displayCustomerName, '客户')
                const startDateForFile = formatDateForFile(date_from)
                const endDateForFile = formatDateForFile(date_to)

                const fileName = `${safeCustomerName}_${startDateForFile}_${endDateForFile}_日度明细.xlsx`
                const cloudPath = `bill_export/${fileName}`

		const uploadRes = await uniCloud.uploadFile({
			cloudPath,
			fileContent: buffer
		})

		const fileID = uploadRes.fileID
		let url = ''

		try {
			const tempRes = await uniCloud.getTempFileURL({
				fileList: [fileID]
			})
			if (
				tempRes &&
				Array.isArray(tempRes.fileList) &&
				tempRes.fileList[0] &&
				tempRes.fileList[0].tempFileURL
			) {
				url = tempRes.fileList[0].tempFileURL
			}
		} catch (e) {
			console.error('getTempFileURL error:', e)
		}

		return {
			code: 0,
			msg: '导出成功',
			fileID,
			url,
			fileName
		}
	}

	// =========================================================
	// E. 导出 销售记录列表 为 Excel（/pages/sale/list 导出当前筛选范围）
	//    action: exportSaleListExcel
	//    ⭐ 这里额外导出一张「流量结算」sheet（price_unit === 'm3'）
	// =========================================================
	if (action === 'exportSaleListExcel') {
		const {
			customer_id,
			customer_name,
			date_from,
			date_to
		} = data || {}

		// 日期范围是必填，客户可以不选（表示全部客户）
		if (!date_from || !date_to) {
			return {
				code: 400,
				msg: '缺少日期范围'
			}
		}

		// 1) 组装 where 条件
		const conds = []

		// 日期条件
		const dateCond = {
			date: dbCmd.gte(date_from).and(dbCmd.lte(date_to))
		}
		conds.push(dateCond)

		// 客户条件：如果有传，就加；没传就导出所有客户
		const customerCond = []
		if (customer_id) customerCond.push({ customer_id })
		if (customer_name) customerCond.push({ customer_name })

		if (customerCond.length) {
			conds.push(dbCmd.or(...customerCond))
		}

		// 最终 where
		let where
		if (conds.length === 1) {
			where = conds[0]
		} else {
			where = dbCmd.and(...conds)
		}

		// 2) 查数据
		const listRes = await sales
			.where(where)
			.orderBy('date', 'asc')
			.orderBy('created_at', 'asc')
			.limit(2000) // 给个上限，防止一次性太多
			.get()

		const list = listRes.data || []
		if (!list.length) {
			return {
				code: 400,
				msg: '该时间段暂无销售记录，无法导出'
			}
		}

		// ========= 主表：销售记录 AOA =========
		const aoa = []

		// 标题：销售记录列表 + 日期范围（不强制单一客户）
		const displayFrom = date_from || ''
		const displayTo = date_to || ''
		const titleText = `销售记录 ${displayFrom} ~ ${displayTo} 明细`

		aoa.push([titleText])

		// 表头：比日度明细多一个「客户」列
		aoa.push([
			'日期',
			'客户',
			'出瓶号',
			'回瓶号',
			'存瓶号',
			'出瓶净重(kg)',
			'回瓶净重(kg)',
			'单价',
			'应收金额',
			'实收金额',
			'抹零金额',
			'未收金额',
			'配送员',
			'车号',
			'收款状态',
			'备注'
		])

		// 数据行
		list.forEach(doc => {
			const outList = getBottleListFromDoc(doc, 'out')
			const backList = getBottleListFromDoc(doc, 'back')
			const depositList = getBottleListFromDoc(doc, 'deposit')

			const outStr = outList.join(' / ')
			const backStr = backList.join(' / ')
			const depositStr = depositList.join(' / ')

			const outNet = doc.out_net_total != null
				? toNumber(doc.out_net_total, 0)
				: toNumber(doc.net_weight_out, 0)

			const backNet = doc.back_net_total != null
				? toNumber(doc.back_net_total, 0)
				: toNumber(doc.net_weight_back, 0)

			const amt = toNumber(doc.amount, 0)
			const amtRecv = toNumber(doc.amount_received, 0)
			const writeOff = toNumber(doc.write_off, 0)
			const unpaid = Math.max(amt - amtRecv - writeOff, 0)

			const dateCell = formatDateForExcel(doc.date)

			aoa.push([
				dateCell,
				doc.customer_name || '',
				outStr,
				backStr,
				depositStr,
				outNet,
				backNet,
				doc.unit_price != null ? Number(doc.unit_price) : '',
				amt,
				amtRecv,
				writeOff,
				unpaid,
				doc.delivery_man || '',
				doc.car_no || '',
				doc.payment_status || '',
				doc.remark || ''
			])
		})

		// ========= 生成工作簿 =========
		const wb = xlsx.utils.book_new()

		// Sheet1：销售记录
		const ws = xlsx.utils.aoa_to_sheet(aoa)
		xlsx.utils.book_append_sheet(wb, ws, '销售记录')

                // ========= Sheet2：流量结算（仅 price_unit === 'm3'） =========
                const flowIntervals = buildFlowIntervals(list)

                if (flowIntervals.length) {
                        const flowAoa = []

			// 标题
			const flowTitle = `流量结算 ${displayFrom} ~ ${displayTo} 明细`
			flowAoa.push([flowTitle])

                        // 表头：抄表 + 金额
                        flowAoa.push([
                                '抄表日期',
                                '客户',
                                '上次表数',
                                '本次表数',
                                '用气量(m³)',
                                '理论用气量(m³)',
                                '单价(元/m³)',
                                '实收(元)',
                                '抹零金额',
                                '未收金额',
                                '付款状态',
                                '备注'
                        ])

                        flowIntervals.forEach(doc => {
                                const dateCell = formatDateForExcel(doc.record_date)

                                const prev = doc.period_start_reading != null ? Number(doc.period_start_reading) : ''
                                const curr = doc.period_end_reading != null ? Number(doc.period_end_reading) : ''
                                const vol = doc.consumption_m3 != null ? Number(doc.consumption_m3) : ''
                                const theoVol = doc.theoretical_m3 != null ? Number(doc.theoretical_m3) : ''

                                const unitPrice = doc.unit_price != null ? Number(doc.unit_price) : ''

                                const should = doc.amount_should != null ? Number(doc.amount_should) : ''
                                const received = doc.amount_received != null ? Number(doc.amount_received) : ''

                                const writeOff = toNumber(doc.write_off, 0)
                                const unpaid = Math.max((Number(should) || 0) - (Number(received) || 0) - writeOff, 0)

                                flowAoa.push([
                                        dateCell,
                                        doc.customer_name || '',
                                        prev,
                                        curr,
                                        vol,
                                        theoVol,
                                        unitPrice,
                                        received,
                                        writeOff,
                                        unpaid,
                                        doc.payment_status || '',
                                        doc.remark || ''
                                ])
                        })

			const wsFlow = xlsx.utils.aoa_to_sheet(flowAoa)
			xlsx.utils.book_append_sheet(wb, wsFlow, '流量结算')
		}

		// ========= 写出 buffer =========
		const buffer = xlsx.write(wb, {
			bookType: 'xlsx',
			type: 'buffer'
		})

		// 文件名：客户 + 销售记录 + 日期范围
                let safeCustomerName = '全部客户'
                if (customer_name) {
                        safeCustomerName = customer_name
                }

                safeCustomerName = sanitizeFileNamePart(safeCustomerName, '全部客户')

                const startDateForFile = formatDateForFile(date_from)
                const endDateForFile = formatDateForFile(date_to)

                const fileName = `${safeCustomerName}_${startDateForFile}_${endDateForFile}_销售记录.xlsx`
                const cloudPath = `bill_export/${fileName}`

		const uploadRes = await uniCloud.uploadFile({
			cloudPath,
			fileContent: buffer
		})

		const fileID = uploadRes.fileID
		let url = ''

		try {
			const tempRes = await uniCloud.getTempFileURL({
				fileList: [fileID]
			})
			if (
				tempRes &&
				Array.isArray(tempRes.fileList) &&
				tempRes.fileList[0] &&
				tempRes.fileList[0].tempFileURL
			) {
				url = tempRes.fileList[0].tempFileURL
			}
		} catch (e) {
			console.error('getTempFileURL error (exportSaleListExcel):', e)
		}

		return {
			code: 0,
			msg: '导出成功',
			fileID,
			url,
			fileName
		}
	}

	// 未知 action
	return {
		code: 400,
		msg: '未知 action'
	}
}