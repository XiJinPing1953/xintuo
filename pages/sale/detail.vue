<template>
	<view class="sale-detail-page">
		<view class="sale-detail-inner">
			<BackToDashboardBar back-to="/pages/sale/list" text="返回" />

			<!-- 顶部标题 -->
			<view class="page-header">
				<view class="page-header-left">
					<view class="page-icon">
						<text class="page-icon-text">单</text>
					</view>
					<view class="page-header-text">
						<text class="page-title">销售记录详情</text>
						<text class="page-sub">
							查看本次出瓶、回瓶、存瓶与结算信息
						</text>
					</view>
				</view>

				<view class="page-header-right">
					<!-- 管理员编辑按钮 -->
					<button v-if="isAdmin && !loading && record && !errorMsg" class="btn-edit-top" @click.stop="goEdit">
						编辑
					</button>

					<view class="tag-soft">
						<text class="tag-dot"></text>
						<text class="tag-text">
							{{ record ? (record.date || '日期未知') : '加载中...' }}
						</text>
					</view>
				</view>
			</view>

			<!-- 错误提示 -->
			<view v-if="errorMsg" class="card">
				<view class="card-body">
					<text style="color:#dc2626;font-size:26rpx;">{{ errorMsg }}</text>
				</view>
			</view>

			<!-- 加载中 -->
			<view v-if="loading && !errorMsg" class="card">
				<view class="card-body">
					<text style="color:#6b7280;font-size:26rpx;">加载中...</text>
				</view>
			</view>

			<!-- 详情主体 -->
			<block v-if="!loading && record && !errorMsg">
				<!-- 基础信息 -->
				<view class="card card-basic">
					<view class="card-header">
						<text class="card-title">基础信息</text>
					</view>
					<view class="card-body">
						<!-- 第 1 行：客户 / 日期 / 配送员 / 车辆 -->
						<view class="info-grid">
							<view class="info-cell">
								<text class="info-label">客户</text>
								<text class="info-value">{{ record.customer_name || '—' }}</text>
							</view>

							<view class="info-cell">
								<text class="info-label">日期</text>
								<text class="info-value">{{ record.date || '—' }}</text>
							</view>

							<view class="info-cell">
								<text class="info-label">配送员</text>
								<text class="info-value">{{ record.delivery_man || '—' }}</text>
							</view>

							<view class="info-cell">
								<text class="info-label">车辆</text>
								<text class="info-value">{{ vehicleText }}</text>
							</view>
						</view>

						<!-- 第 2 行：单价 / 付款状态 / 本次实收 / 未收金额 -->
						<view class="info-grid">
							<view class="info-cell">
								<text class="info-label">单价</text>
								<text class="info-value">{{ unitPriceText }}</text>
							</view>

							<view class="info-cell">
								<text class="info-label">付款状态</text>
								<text class="info-value">{{ paymentStatusText }}</text>
							</view>

							<view class="info-cell">
								<text class="info-label">本次实收</text>
								<text class="info-value-strong">{{ amountReceivedText }} 元</text>
							</view>

							<view class="info-cell">
								<text class="info-label">未收金额</text>
								<text class="info-value" :class="{ 'text-danger': unpaidRaw > 0 }">
									{{ unpaidText }} 元
								</text>
							</view>
						</view>

						<view class="deposit-inline-block">
							<text class="info-label">存瓶清单
								<text v-if="depositNumbers.length">（共 {{ depositNumbers.length }}
									只）</text></text>
							<view v-if="depositNumbers.length" class="deposit-inline-list">
								<view class="deposit-inline-chip" v-for="(no, idx) in depositNumbers"
									:key="'dep-inline-' + idx">
									{{ no }}
								</view>
							</view>
							<text v-else class="info-value info-muted">暂无存瓶记录</text>
						</view>
					</view>
				</view>

				<!-- 出瓶明细 -->
				<view class="card">
					<view class="card-header">
						<text class="card-title">出瓶明细</text>
						<text class="card-sub">
							本次送出的瓶子
							<text v-if="outList.length">（共 {{ outList.length }} 只）</text>
						</text>
					</view>
					<view class="card-body card-body-table">
						<view v-if="!outList.length" class="empty-block">
							<text class="empty-text">无出瓶记录</text>
						</view>
						<view v-else>
							<view class="table-header">
								<text class="col-no">瓶号</text>
								<text class="col-num">毛重</text>
								<text class="col-num">皮重</text>
								<text class="col-num">净重</text>
							</view>
							<view v-for="(row, idx) in outList" :key="'out-' + idx" class="table-row">
								<text class="col-no">{{ row.bottle_no || '—' }}</text>
								<text class="col-num">{{ formatNum(row.gross) }}</text>
								<text class="col-num">{{ formatNum(row.tare) }}</text>
								<text class="col-num">{{ formatNum(row.net) }}</text>
							</view>

							<view class="table-summary">
								<text class="summary-label">出瓶净重合计：</text>
								<text class="summary-value">{{ outNetTotalText }} kg</text>
							</view>
						</view>
					</view>
				</view>

				<!-- 回瓶明细 -->
				<view class="card">
					<view class="card-header">
						<text class="card-title">回收瓶明细</text>
						<text class="card-sub">
							本次从客户处回收的瓶子
							<text v-if="backList.length">（共 {{ backList.length }} 只）</text>
						</text>
					</view>
					<view class="card-body card-body-table">
						<view v-if="!backList.length" class="empty-block">
							<text class="empty-text">无回瓶记录</text>
						</view>
						<view v-else>
							<view class="table-header">
								<text class="col-no">瓶号</text>
								<text class="col-num">毛重</text>
								<text class="col-num">皮重</text>
								<text class="col-num">净重</text>
							</view>
							<view v-for="(row, idx) in backList" :key="'back-' + idx" class="table-row">
								<text class="col-no">{{ row.bottle_no || '—' }}</text>
								<text class="col-num">{{ formatNum(row.gross) }}</text>
								<text class="col-num">{{ formatNum(row.tare) }}</text>
								<text class="col-num">{{ formatNum(row.net) }}</text>
							</view>

							<view class="table-summary">
								<text class="summary-label">回瓶净重合计：</text>
								<text class="summary-value">{{ backNetTotalText }} kg</text>
							</view>
						</view>
					</view>
				</view>

				<!-- 存瓶 -->
				<view class="card">
					<view class="card-header">
						<text class="card-title">存瓶号</text>
						<text class="card-sub">当前留在客户处的瓶子<text v-if="depositNumbers.length">（共
								{{ depositNumbers.length }}
								只）</text></text>

					</view>
					<view class="card-body">
						<view v-if="!depositNumbers.length" class="empty-block">
							<text class="empty-text">无单独记录的存瓶号</text>
						</view>
						<view v-else class="deposit-list">
							<view class="deposit-chip" v-for="(no, idx) in depositNumbers" :key="'dep-' + idx">
								<text class="deposit-text">{{ no }}</text>
							</view>
						</view>
					</view>
				</view>

				<!-- 结算汇总：根据单价单位动态展示 -->
				<view class="card">
					<view class="card-header">
						<text class="card-title">
							结算汇总（{{ isFlowPrice ? '流量结算' : '重量结算' }}）
						</text>
					</view>

					<!-- 重量结算模式 -->
					<view v-if="!isFlowPrice" class="card-body">
						<view class="formula-section">
							<view class="formula-block">
								<text class="formula-title">重量公式</text>

								<view class="formula-line">
									<text class="formula-label">出瓶净重</text>
									<text class="formula-main">{{ outNetFormula }}</text>
								</view>

								<view class="formula-line" v-if="backList.length">
									<text class="formula-label">回瓶净重</text>
									<text class="formula-main">{{ backNetFormula }}</text>
								</view>

								<view class="formula-line">
									<text class="formula-label">净重合计</text>
									<text class="formula-main">{{ netTotalFormula }}</text>
								</view>
							</view>

							<view class="formula-block">
								<text class="formula-title">金额公式</text>

								<view class="formula-line">
									<text class="formula-label">出瓶应收</text>
									<text class="formula-main">{{ outAmountFormula }}</text>
								</view>

								<view class="formula-line" v-if="isKgPrice && backNetTotalRaw !== 0">
									<text class="formula-label">回瓶结算</text>
									<text class="formula-main">{{ backAmountFormula }}</text>
								</view>

								<view class="formula-line">
									<text class="formula-label">理论应收</text>
									<text class="formula-main">{{ shouldReceiveFormula }}</text>
								</view>
							</view>
						</view>

						<view class="divider"></view>

						<view class="info-row">
							<text class="info-label">出瓶净重</text>
							<text class="info-value">{{ outNetTotalText }} kg</text>
						</view>
						<view class="info-row">
							<text class="info-label">回瓶净重</text>
							<text class="info-value">{{ backNetTotalText }} kg</text>
						</view>
						<view class="info-row">
							<text class="info-label">净重合计</text>
							<text class="info-value">{{ netTotalText }} kg</text>
						</view>

						<view class="divider"></view>

						<view class="info-row">
							<text class="info-label">出瓶金额</text>
							<text class="info-value">{{ outAmountText }} 元</text>
						</view>
						<view class="info-row">
							<text class="info-label">回瓶金额</text>
							<text class="info-value">
								{{ backAmountText }} 元
								<text class="hint" v-if="backAmountRaw > 0">（退给客户）</text>
								<text class="hint" v-else-if="backAmountRaw < 0">（客户补差）</text>
							</text>
						</view>

						<view class="info-row">
							<text class="info-label-strong">理论应收</text>
							<text class="info-value-strong">{{ shouldReceiveText }} 元</text>
						</view>
						<view class="info-row">
							<text class="info-label">本次实收</text>
							<text class="info-value">{{ amountReceivedText }} 元</text>
						</view>
						<view class="info-row">
							<text class="info-label">未收金额</text>
							<text class="info-value" :class="{ 'text-danger': unpaidRaw > 0 }">
								{{ unpaidText }} 元
							</text>
						</view>
					</view>

					<!-- 流量结算模式 -->
					<view v-else class="card-body">
						<view class="formula-section">
							<view class="formula-block">
								<text class="formula-title">用气公式</text>

								<view class="formula-line">
									<text class="formula-label">本次用气量</text>
									<text class="formula-main">{{ flowUseFormula }}</text>
								</view>

								<view class="formula-line" v-if="flowTheoreticalVolumeRaw > 0">
									<text class="formula-label">折算用气（按本次出瓶净重）</text>
									<text class="formula-main">
										{{ flowTheoreticalFormula }}
									</text>
								</view>
							</view>

							<view class="formula-block">
								<text class="formula-title">金额公式</text>

								<view class="formula-line">
									<text class="formula-label">流量应收</text>
									<text class="formula-main">{{ flowAmountFormula }}</text>
								</view>
							</view>
						</view>

						<view class="divider"></view>

						<view class="info-row">
							<text class="info-label">本次用气量</text>
							<text class="info-value">{{ flowVolumeMeterText }} m³</text>
						</view>
						<view class="info-row" v-if="flowTheoreticalVolumeRaw > 0">
							<text class="info-label">折算用气（参考）</text>
							<text class="info-value">
								{{ flowTheoreticalVolumeText }} m³
							</text>
						</view>

						<view class="divider"></view>

						<view class="info-row">
							<text class="info-label-strong">流量应收</text>
							<text class="info-value-strong">
								{{ flowShouldReceiveText }} 元
							</text>
						</view>
						<view class="info-row">
							<text class="info-label">本次实收</text>
							<text class="info-value">{{ amountReceivedText }} 元</text>
						</view>
						<view class="info-row">
							<text class="info-label">未收金额</text>
							<text class="info-value" :class="{ 'text-danger': unpaidRaw > 0 }">
								{{ unpaidText }} 元
							</text>
						</view>
					</view>
				</view>

				<!-- 备注 -->
				<view class="card">
					<view class="card-header">
						<text class="card-title">备注</text>
					</view>
					<view class="card-body">
						<text class="remark-text">
							{{ record.remark || '暂无备注' }}
						</text>
					</view>
				</view>
			</block>
		</view>
	</view>
</template>

<script>
	import BackToDashboardBar from '@/components/BackToDashboardBar.vue'
	import {
		ensureLogin,
		getToken,
		getUserInfo,
		isAdminRole
	} from '@/common/auth.js'

	export default {
		components: {
			BackToDashboardBar
		},

		data() {
			return {
				id: '',
				loading: false,
				errorMsg: '',
				record: null,
				vehicleList: [],
				isAdmin: false,
				customerDeposits: []
			}
		},

		computed: {
			/* 是否多瓶新单 */
			isMulti() {
				return (
					this.record &&
					Array.isArray(this.record.out_items) &&
					this.record.out_items.length
				)
			},

			/* 是否流量结算 */
			isFlowPrice() {
				if (!this.record) return false
				const u = (this.record.price_unit || '').toLowerCase()
				return u === 'm3' || u === 'm³'
			},

			/* ===== 公式展示 ===== */
			outNetFormula() {
				return `${this.outNetTotalText} kg`
			},
			backNetFormula() {
				return `${this.backNetTotalText} kg`
			},
			netTotalFormula() {
				return `${this.outNetTotalText} - ${this.backNetTotalText} = ${this.netTotalText} kg`
			},
			outAmountFormula() {
				if (this.isKgPrice) {
					return `${this.outNetTotalText} × ${this.unitPriceNumberText} = ${this.outAmountText} 元`
				}
				return `${this.outList.length} × ${this.unitPriceNumberText} = ${this.outAmountText} 元`
			},
			backAmountFormula() {
				if (!this.isKgPrice) return `${this.backAmountText} 元`
				return `${this.backNetTotalText} × ${this.unitPriceNumberText} = ${this.backAmountText} 元`
			},
			shouldReceiveFormula() {
				return `${this.outAmountText} - ${this.backAmountText} = ${this.shouldReceiveText} 元`
			},
			flowTheoryRatio() {
				if (!this.record) return 0
				const r = Number(this.record.flow_theory_ratio)
				return Number.isNaN(r) ? 0 : r
			},
			flowTheoryRatioText() {
				return this.flowTheoryRatio ? this.flowTheoryRatio.toFixed(2) : '0.00'
			},
			flowTheoreticalVolumeRaw() {
				if (!this.record) return 0
				if (this.record.flow_theoretical_volume_m3 != null) {
					return this.toNum(this.record.flow_theoretical_volume_m3, 0)
				}
				return this.netTotalRaw * this.flowTheoryRatio
			},
			flowTheoreticalVolumeText() {
				return this.flowTheoreticalVolumeRaw.toFixed(2)
			},
			flowUseFormula() {
				const prev = this.toNum(this.record && this.record.flow_index_prev, null)
				const curr = this.toNum(this.record && this.record.flow_index_curr, null)
				if (prev != null && curr != null && curr >= prev) {
					return `${curr} - ${prev} = ${this.flowVolumeMeterText} m³`
				}
				return `${this.flowVolumeMeterText} m³`
			},
			flowTheoreticalFormula() {
				return `${this.netTotalText} kg × ${this.flowTheoryRatioText} = ${this.flowTheoreticalVolumeText} m³`
			},
			flowAmountFormula() {
				return `${this.flowVolumeMeterText} × ${this.unitPriceFlowText} = ${this.flowShouldReceiveText} 元`
			},

			/* ===== 出瓶列表 ===== */
			outList() {
				if (!this.record) return []
				if (this.isMulti) return this.record.out_items || []
				if (this.record.bottle_no) {
					return [{
						bottle_no: this.record.bottle_no,
						gross: this.record.gross_weight_out,
						tare: this.record.tare_weight_out,
						net: this.record.net_weight_out
					}]
				}
				return []
			},

			/* ===== 回瓶列表 ===== */
			backList() {
				if (!this.record) return []
				if (this.isMulti) return this.record.back_items || []
				if (this.record.return_bottle_no) {
					return [{
						bottle_no: this.record.return_bottle_no,
						gross: this.record.gross_weight_back,
						tare: this.record.tare_weight_back,
						net: this.record.net_weight_back
					}]
				}
				return []
			},

			/* ===== 存瓶号 ===== */
			depositNumbers() {
				const normalized = this.normalizeDepositList(this.customerDeposits)
				if (normalized.length) return normalized

				if (!this.record || !this.record.deposit_bottles_raw) return []
				return this.normalizeDepositList(this.record.deposit_bottles_raw)
			},

			/* ===== 单价文本 ===== */
			unitPriceText() {
				if (!this.record) return '—'
				const p = this.toNum(this.record.unit_price)
				if (!p) return '—'

				const u = (this.record.price_unit || 'kg').toLowerCase()
				if (u === 'kg') return `${p} 元/kg`
				if (u === 'm3' || u === 'm³') return `${p} 元/m³`
				return `${p} 元/瓶`
			},

			paymentStatusText() {
				if (!this.record) return '—'
				if (this.isFlowPrice && this.record.flow_payment_status)
					return this.record.flow_payment_status
				return this.record.payment_status || '—'
			},

			/* ===== 金额与重量 ===== */
			unitPriceNumber() {
				if (!this.record) return 0
				const u = (this.record.price_unit || 'kg').toLowerCase()
				if (u === 'kg' || u === 'bottle') {
					return this.toNum(this.record.unit_price, 0)
				}
				return 0
			},
			unitPriceNumberText() {
				return this.unitPriceNumber.toFixed(2)
			},

			outNetTotalRaw() {
				if (!this.record) return 0
				// 新字段优先
				if (typeof this.record.out_net_total === 'number') {
					return this.toNum(this.record.out_net_total)
				}
				// 多瓶
				if (this.outList.length) {
					return this.outList.reduce((s, r) => s + this.toNum(r.net), 0)
				}
				// 旧字段
				return this.toNum(this.record.net_weight_out, 0)
			},
			outNetTotalText() {
				return this.outNetTotalRaw.toFixed(2)
			},

			backNetTotalRaw() {
				if (!this.record) return 0
				if (typeof this.record.back_net_total === 'number') {
					return this.toNum(this.record.back_net_total)
				}
				if (this.backList.length) {
					return this.backList.reduce((s, r) => s + this.toNum(r.net), 0)
				}
				return this.toNum(this.record.net_weight_back, 0)
			},
			backNetTotalText() {
				return this.backNetTotalRaw.toFixed(2)
			},

			netTotalRaw() {
				if (!this.record) return 0
				if (typeof this.record.total_net_weight === 'number') {
					return this.toNum(this.record.total_net_weight)
				}
				return this.outNetTotalRaw - this.backNetTotalRaw
			},
			netTotalText() {
				return this.netTotalRaw.toFixed(2)
			},

			/* ===== 金额：出 / 回 / 理论应收 ===== */
			outAmountRaw() {
				if (!this.record) return 0
				if (typeof this.record.out_amount === 'number') {
					return this.toNum(this.record.out_amount)
				}
				if (this.isKgPrice) {
					return this.outNetTotalRaw * this.unitPriceNumber
				}
				return this.outList.length * this.unitPriceNumber
			},
			outAmountText() {
				return this.outAmountRaw.toFixed(2)
			},

			backAmountRaw() {
				if (!this.record) return 0
				if (typeof this.record.back_amount === 'number') {
					return this.toNum(this.record.back_amount)
				}
				if (!this.isKgPrice) return 0
				return this.backNetTotalRaw * this.unitPriceNumber
			},
			backAmountText() {
				return this.backAmountRaw.toFixed(2)
			},

			isKgPrice() {
				if (!this.record) return true
				const u = (this.record.price_unit || 'kg').toLowerCase()
				return u === 'kg'
			},

			/* ===== 流量字段 ===== */
			flowVolumeMeterRaw() {
				if (!this.record) return 0
				const v = this.toNum(this.record.flow_volume_m3, NaN)
				if (!Number.isNaN(v)) return v
				const prev = this.toNum(this.record.flow_index_prev, NaN)
				const curr = this.toNum(this.record.flow_index_curr, NaN)
				if (!Number.isNaN(prev) && !Number.isNaN(curr) && curr >= prev) {
					return curr - prev
				}
				return 0
			},
			flowVolumeMeterText() {
				return this.flowVolumeMeterRaw.toFixed(3)
			},

			unitPriceFlowNumber() {
				if (!this.record) return 0
				if (typeof this.record.flow_unit_price === 'number')
					return this.toNum(this.record.flow_unit_price)
				const u = (this.record.price_unit || '').toLowerCase()
				if (u === 'm3' || u === 'm³') return this.toNum(this.record.unit_price)
				return 0
			},
			unitPriceFlowText() {
				return this.unitPriceFlowNumber.toFixed(2)
			},

			flowShouldReceiveRaw() {
				if (!this.record) return 0
				if (typeof this.record.flow_amount_should === 'number')
					return this.toNum(this.record.flow_amount_should)
				return this.flowVolumeMeterRaw * this.unitPriceFlowNumber
			},
			flowShouldReceiveText() {
				return this.flowShouldReceiveRaw.toFixed(2)
			},

			/* === 理论应收 === */
			shouldReceiveRaw() {
				if (!this.record) return 0
				if (this.isFlowPrice) return this.flowShouldReceiveRaw
				if (typeof this.record.should_receive === 'number') {
					return this.toNum(this.record.should_receive)
				}
				return this.outAmountRaw - this.backAmountRaw
			},
			shouldReceiveText() {
				return this.shouldReceiveRaw.toFixed(2)
			},

			/* === 实收 === */
			amountReceivedRaw() {
				if (!this.record) return 0
				if (this.isFlowPrice && typeof this.record.flow_amount_received === 'number')
					return this.toNum(this.record.flow_amount_received)
				return this.toNum(this.record.amount_received)
			},
			amountReceivedText() {
				return this.amountReceivedRaw.toFixed(2)
			},

			unpaidRaw() {
				return this.shouldReceiveRaw - this.amountReceivedRaw
			},
			unpaidText() {
				return this.unpaidRaw.toFixed(2)
			},

			/* ===== 车辆显示 ===== */
			vehicleText() {
				if (!this.record) return '—'
				if (this.record.car_no) return this.record.car_no

				if (this.record.vehicle_id && this.vehicleList.length) {
					const v = this.vehicleList.find(x => x._id === this.record.vehicle_id)
					if (v) {
						if (v.plate_no && v.name) return `${v.plate_no} - ${v.name}`
						return v.plate_no || v.name || '—'
					}
				}
				return '—'
			}
		},

		onLoad(options) {
			this.id = (options && (options.id || options.sale_id)) || ''
			if (!this.id) {
				this.errorMsg = '缺少销售记录 id'
				return
			}

			/* ⭐ 登录校验（和 customer/list、sale/list 一致） */
			if (!ensureLogin()) {
				uni.showModal({
					title: '提示',
					content: '登录已过期，请重新登录',
					showCancel: false,
					success: () => {
						uni.clearStorageSync()
						uni.reLaunch({
							url: '/pages/login/login'
						})
					}
				})
				return
			}

			/* 读取用户信息判断权限 */
			const user = getUserInfo() || {}
			this.isAdmin = isAdminRole(user)

			// 非管理员禁止进入
			if (!this.isAdmin) {
				uni.showModal({
					title: '无权限',
					content: '当前账号无权查看销售记录详情',
					showCancel: false,
					success: () => {
						uni.navigateBack({
							delta: 1
						})
					}
				})
				return
			}

			this.loadVehicles()
			this.fetchDetail()
		},

		onShow() {
			// 再次校验避免后台修改权限
			if (!ensureLogin()) return
			const user = getUserInfo() || {}
			if (!isAdminRole(user)) {
				uni.showModal({
					title: '无权限',
					content: '当前账号无权查看销售记录详情',
					showCancel: false,
					success: () => {
						uni.navigateBack()
					}
				})
				return
			}
		},

		methods: {
			/* 401 登录失效统一处理 */
			handleAuthError(res) {
				const code = res && res.result && res.result.code
				const msg = res && res.result && res.result.msg

				if (code === 401 || msg?.includes('未登录') || msg?.includes('过期')) {
					uni.showModal({
						title: '提示',
						content: msg || '登录已过期，请重新登录',
						showCancel: false,
						success: () => {
							uni.clearStorageSync()
							uni.reLaunch({
								url: '/pages/login/login'
							})
						}
					})
					return true
				}
				return false
			},

			normalizeDepositList(list) {
				if (typeof list === 'string') {
					return String(list)
						.split(/[\/\s,，]+/)
						.map(s => s.trim())
						.filter(Boolean)
				}

				return (list || [])
					.map(item => {
						if (typeof item === 'string') return item.trim()
						if (item && typeof item === 'object') {
							return String(item.bottle_no || item.number || '').trim()
						}
						return ''
					})
					.filter(Boolean)
			},

			toNum(v, def = 0) {
				if (v === '' || v == null) return def
				const n = Number(v)
				return isNaN(n) ? def : n
			},

			formatNum(v) {
				const n = Number(v)
				if (Number.isNaN(n)) return '--'
				return n.toFixed(2)
			},

			async loadVehicles() {
				const token = getToken()
				if (!token) return
				try {
					const res = await uniCloud.callFunction({
						name: 'crm-vehicle',
						data: {
							action: 'list',
							token,
							data: {}
						}
					})
					if (res.result && res.result.code === 0) {
						this.vehicleList = res.result.data || []
					}
				} catch (e) {
					console.error('loadVehicles error', e)
				}
			},

			async loadCustomerDeposits(customerId) {
				this.customerDeposits = []
				if (!customerId) return

				try {
					const token = getToken()
					if (!token) return
					const res = await uniCloud.callFunction({
						name: 'crm-sale',
						data: {
							action: 'customerDeposits',
							token,
							data: {
								customerId
							}
						}
					})
					if (this.handleAuthError(res)) return
					if (res.result?.code === 0 && Array.isArray(res.result.data)) {
						this.customerDeposits = res.result.data
					}
				} catch (err) {
					console.error('loadCustomerDeposits error', err)
				}
			},

			async fetchDetail() {
				const token = getToken()
				if (!token) {
					this.errorMsg = '未登录或登录已过期'
					return
				}

				this.loading = true
				this.errorMsg = ''

				try {
					const res = await uniCloud.callFunction({
						name: 'crm-sale',
						data: {
							action: 'get',
							token,
							data: {
								id: this.id
							}
						}
					})

					if (this.handleAuthError(res)) return

					if (res.result && res.result.code === 0) {
						this.record = res.result.data || null
						if (!this.record) {
							this.errorMsg = '未找到对应的销售记录'
						} else {
							await this.loadCustomerDeposits(
								this.record.customer_id || this.record.customerId
							)
						}
					} else {
						this.errorMsg = res.result?.msg || '加载失败'
					}
				} catch (err) {
					console.error('fetch detail error', err)
					this.errorMsg = '请求出错'
				} finally {
					this.loading = false
				}
			},

			goEdit() {
				if (!this.record || !this.record._id) return
				uni.navigateTo({
					url: `/pages/sale/edit?id=${this.record._id}`
				})
			},

			goBack() {
				uni.navigateBack({
					delta: 1
				})
			}
		}
	}
</script>

<style scoped>
	.sale-detail-page {
		min-height: 100vh;
		background-color: #f2f4f9;
		padding: 24rpx 16rpx 40rpx;
		box-sizing: border-box;
	}

	.sale-detail-inner {
		width: 100%;
		max-width: 1600rpx;
		margin: 0 auto;
	}

	/* 顶部标题区 */
	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin: 16rpx 0 24rpx;
	}

	.page-header-left {
		display: flex;
		align-items: center;
	}

	.page-icon {
		width: 64rpx;
		height: 64rpx;
		border-radius: 22rpx;
		background: linear-gradient(135deg, #e2f0ff, #d3e6ff);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-right: 18rpx;
	}

	.page-icon-text {
		font-size: 30rpx;
		font-weight: 600;
		color: #2b3a5a;
	}

	.page-header-text {
		display: flex;
		flex-direction: column;
	}

	.page-title {
		font-size: 32rpx;
		font-weight: 700;
		color: #181c28;
	}

	.page-sub {
		margin-top: 4rpx;
		font-size: 24rpx;
		color: #949aac;
	}

	.page-header-right {
		display: flex;
		align-items: center;
		column-gap: 16rpx;
	}

	.tag-soft {
		padding: 8rpx 18rpx;
		border-radius: 999rpx;
		background: rgba(255, 255, 255, 0.9);
		box-shadow: 0 8rpx 20rpx rgba(15, 35, 52, 0.12);
		display: flex;
		align-items: center;
	}

	.tag-dot {
		width: 10rpx;
		height: 10rpx;
		border-radius: 50%;
		background: #4d5cff;
		margin-right: 8rpx;
	}

	.tag-text {
		font-size: 22rpx;
		color: #4d5cff;
	}

	/* 顶部编辑按钮 */
	.btn-edit-top {
		padding: 10rpx 22rpx;
		border-radius: 999rpx;
		font-size: 24rpx;
		background: linear-gradient(135deg, #2979ff, #1a98ff);
		color: #ffffff;
		border: none;
		box-shadow: 0 8rpx 20rpx rgba(26, 120, 255, 0.35);
	}

	.btn-edit-top::after {
		border: none;
	}

	/* 卡片 */
	.card {
		background-color: #ffffff;
		border-radius: 16rpx;
		padding: 20rpx 24rpx;
		margin-bottom: 20rpx;
		box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.03);
	}

	.card-header {
		padding-bottom: 10rpx;
		border-bottom: 1px solid #f0f0f0;
		margin-bottom: 14rpx;
	}

	.card-title {
		font-size: 30rpx;
		font-weight: 600;
		color: #333;
	}

	.card-sub {
		margin-top: 4rpx;
		font-size: 24rpx;
		color: #9aa0ae;
	}

	.card-body {
		margin-top: 4rpx;
	}

	/* 信息行 */
	.info-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 10rpx;
	}

	.info-label {
		font-size: 26rpx;
		color: #6b7280;
	}

	.info-label-strong {
		font-size: 26rpx;
		color: #374151;
		font-weight: 600;
	}

	.info-value {
		font-size: 26rpx;
		color: #111827;
	}

	.info-muted {
		color: #9aa0ae;
	}

	.deposit-inline-block {
		margin-top: 6rpx;
	}

	.deposit-inline-list {
		display: flex;
		flex-wrap: wrap;
		gap: 8rpx;
		margin-top: 8rpx;
	}

	.deposit-inline-chip {
		padding: 8rpx 14rpx;
		border-radius: 12rpx;
		background: #f4f7fb;
		color: #1f2a44;
		font-size: 24rpx;
	}

	.info-value-strong {
		font-size: 30rpx;
		color: #111827;
		font-weight: 700;
	}

	.text-danger {
		color: #dc2626;
	}

	.hint {
		font-size: 22rpx;
		color: #9ca3af;
		margin-left: 6rpx;
	}

	/* 表格风格 —— 四列等分，左右留白更大 */
	.card-body-table {
		padding-left: 10rpx;
		padding-right: 10rpx;
	}

	.table-header {
		display: flex;
		padding: 10rpx 18rpx;
		border-radius: 12rpx;
		background: #f3f4f6;
		margin-bottom: 6rpx;
	}

	.table-row {
		display: flex;
		padding: 8rpx 18rpx;
		border-radius: 10rpx;
	}

	.table-row:nth-child(2n) {
		background: #f9fafb;
	}

	/* 四列等分 */
	.col-no,
	.col-num {
		flex: 1;
		font-size: 24rpx;
		color: #4b5563;
	}

	/* 第一列略强调 */
	.col-no {
		font-size: 26rpx;
		color: #111827;
	}

	.col-num {
		text-align: right;
	}

	.table-summary {
		margin-top: 10rpx;
		display: flex;
		justify-content: flex-end;
		align-items: baseline;
	}

	.summary-label {
		font-size: 24rpx;
		color: #6b7280;
	}

	.summary-value {
		font-size: 26rpx;
		color: #111827;
		margin-left: 6rpx;
	}

	/* 存瓶 chips */
	.deposit-list {
		flex-direction: row;
		flex-wrap: wrap;
		display: flex;
		margin: -4rpx;
	}

	.deposit-chip {
		padding: 6rpx 16rpx;
		border-radius: 999rpx;
		background: #f3f4ff;
		border: 1rpx solid #d4ddff;
		margin: 4rpx;
	}

	.deposit-text {
		font-size: 24rpx;
		color: #374151;
	}

	/* 空状态 */
	.empty-block {
		padding: 24rpx 0;
		align-items: center;
		justify-content: center;
		display: flex;
	}

	.empty-text {
		font-size: 24rpx;
		color: #9ca3af;
	}

	/* 分割线 */
	.divider {
		height: 1rpx;
		background-color: #e5e7eb;
		margin: 14rpx 0;
	}

	/* 备注 */
	.remark-text {
		font-size: 26rpx;
		color: #4b5563;
		line-height: 1.6;
	}

	/* 公式区域 */
	.formula-section {
		padding: 14rpx 16rpx;
		border-radius: 18rpx;
		background: #f9fafb;
		border: 1rpx solid #e5e7eb;
		margin-bottom: 16rpx;
	}

	.formula-block+.formula-block {
		margin-top: 12rpx;
		padding-top: 10rpx;
		border-top: 1rpx dashed #e5e7eb;
	}

	.formula-title {
		font-size: 26rpx;
		font-weight: 600;
		color: #111827;
		margin-bottom: 6rpx;
	}

	.formula-line {
		display: flex;
		align-items: baseline;
		margin-top: 4rpx;
	}

	.formula-label {
		font-size: 24rpx;
		color: #6b7280;
		min-width: 160rpx;
	}

	.formula-main {
		font-size: 26rpx;
		font-weight: 600;
		color: #111827;
	}

	/* 两行四列基础信息卡片 */
	.card-basic .card-body {
		padding-top: 10rpx;
		padding-bottom: 10rpx;
	}

	.info-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 14rpx 20rpx;
		margin-bottom: 20rpx;
	}

	.info-cell {
		display: flex;
		flex-direction: column;
	}

	.info-label {
		font-size: 24rpx;
		color: #6b7280;
		margin-bottom: 4rpx;
	}

	.info-value {
		font-size: 26rpx;
		color: #111827;
	}

	/* 窄屏自适应 */
	@media (max-width: 768px) {
		.info-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 14rpx 10rpx;
		}
	}
</style>