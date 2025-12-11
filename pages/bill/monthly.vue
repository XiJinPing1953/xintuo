<template>
	<view class="page">
		<view class="inner">
			<!-- 顶部：客户 + 时间范围 -->
			<BackToDashboardBar back-to="/pages/dashboard/index" text="返回工作台" />
			<view class="top-bar">
				<!-- 客户联想搜索 -->
				<view class="field customer-field">
					<text class="label">客户</text>
					<view class="input-wrapper">
						<input class="input" v-model="customerKeyword" placeholder="输入客户名称，支持联想搜索（不填=全部客户）"
							confirm-type="search" @input="onCustomerInput" @confirm="onCustomerConfirm" />
					</view>

					<!-- 联想下拉 -->
					<view v-if="showCustomerDropdown" class="suggest-panel">
						<view v-if="filteredCustomers.length" class="suggest-list">
							<view v-for="item in filteredCustomers" :key="item._id" class="suggest-item"
								@click="onSelectCustomer(item)">
								<text class="suggest-name">{{ item.name }}</text>
								<text class="suggest-sub" v-if="item.address">
									{{ item.address }}
								</text>
							</view>
						</view>
						<view v-else class="suggest-empty">
							<text>没有匹配的客户</text>
						</view>
					</view>
				</view>

				<!-- 时间段选择：开始日期 ~ 结束日期 -->
				<view class="field date-range-field">
					<text class="label">时间范围</text>
					<view class="date-range-wrapper">
						<picker mode="date" :value="startDate" @change="onStartDateChange">
							<view class="date-input">
								<text>{{ startDate || '开始日期' }}</text>
							</view>
						</picker>

						<text class="range-sep">至</text>

						<picker mode="date" :value="endDate" @change="onEndDateChange">
							<view class="date-input">
								<text>{{ endDate || '结束日期' }}</text>
							</view>
						</picker>
					</view>
				</view>
			</view>

			<!-- 汇总卡片区 -->
			<view class="summary-grid">
				<view class="summary-card" @click="goDailyDetail">
					<text class="summary-label">出瓶净重合计</text>
					<view class="summary-main">
						<text class="summary-value">{{ summary.out_net_total }}</text>
						<text class="summary-unit">kg</text>
					</view>
				</view>

				<view class="summary-card" @click="goDailyDetail">
					<text class="summary-label">回瓶净重合计</text>
					<view class="summary-main">
						<text class="summary-value">{{ summary.back_net_total }}</text>
						<text class="summary-unit">kg</text>
					</view>
				</view>

				<view class="summary-card" @click="goDailyDetail">
					<text class="summary-label">净出气量</text>
					<view class="summary-main">
						<text class="summary-value">{{ summary.net_total }}</text>
						<text class="summary-unit">kg</text>
					</view>
				</view>

				<view class="summary-card" @click="goDailyDetail">
					<text class="summary-label">应收合计</text>
					<view class="summary-main">
						<text class="summary-value">{{ summary.amount_total }}</text>
						<text class="summary-unit">元</text>
					</view>
				</view>

				<view class="summary-card" @click="goDailyDetail">
					<text class="summary-label">实收合计</text>
					<view class="summary-main">
						<text class="summary-value">{{ summary.amount_received_total }}</text>
						<text class="summary-unit">元</text>
					</view>
				</view>

				<view class="summary-card" @click="goDailyDetail">
					<text class="summary-label">未收（挂账）</text>
					<view class="summary-main">
						<text class="summary-value unpaid">{{ summary.unpaid_total }}</text>
						<text class="summary-unit unpaid">元</text>
					</view>
				</view>
			</view>

			<!-- ✅ 有数据时的注脚 -->
			<view class="footer-note" v-if="summary.record_count > 0">
				<text class="note-text">
					当前范围内共
					<text class="note-strong">{{ summary.record_count }}</text>
					条销售记录。
					<text v-if="Number(summary.unpaid_total) > 0">
						其中仍有
						<text class="note-strong">{{ summary.unpaid_total }}</text>
						元挂账未收。
					</text>
				</text>
			</view>

			<!-- ✅ 没有任何数据时，给出明确提醒（参考你给的列表页空状态） -->
			<view class="footer-note footer-note-empty" v-else-if="startDate && endDate && !loadingSummary">
				<text class="note-text">
					当前时间范围内
					<text v-if="!customerId && !customerName">（全部客户）</text>
					暂无任何销售记录。
				</text>
				<text class="note-sub">
					可以调整时间范围，
					<text v-if="!customerId && !customerName">或选择具体客户后</text>
					再试一次。
				</text>
			</view>

			<!-- ✅ 如果连日期都没选（理论上不会，因为我们给了默认值），也提示一下 -->
			<view class="footer-note footer-note-empty" v-else-if="!startDate || !endDate">
				<text class="note-text">
					请先选择一个时间范围，再查看对账汇总。
				</text>
			</view>

			<!-- 底部操作 -->
			<view class="bottom-actions">
				<button class="btn-soft" @click="resetFilter">重置</button>
				<button class="btn-primary" @click="goDailyDetail" :disabled="!customerId || !startDate || !endDate">
					查看明细
				</button>
			</view>
		</view>
	</view>
</template>

<script>
	import BackToDashboardBar from '@/components/BackToDashboardBar.vue'
	import {
		getToken as getAuthToken,
		ensureLogin
	} from '@/common/auth.js'

	export default {
		components: {
			BackToDashboardBar
		},

		data() {
			return {
				// 客户相关
				customers: [],
				customerKeyword: '',
				customerId: '',
				customerName: '',
				showCustomerDropdown: false,

				// 时间段
				startDate: '', // YYYY-MM-DD
				endDate: '', // YYYY-MM-DD

				// 汇总
				summary: {
					out_net_total: '0.00',
					back_net_total: '0.00',
					net_total: '0.00',
					amount_total: '0.00',
					amount_received_total: '0.00',
					unpaid_total: '0.00',
					record_count: 0
				},

				loadingSummary: false
			}
		},

		computed: {
			// 本地联想列表
			filteredCustomers() {
				const kw = (this.customerKeyword || '').trim()
				if (!kw) return []
				const lower = kw.toLowerCase()
				return (this.customers || [])
					.filter((c) => (c.name || '').toLowerCase().indexOf(lower) !== -1)
					.slice(0, 20)
			}
		},

		onLoad() {
			this.initDateRange()
			this.loadCustomers()
			// 默认：全部客户 + 最近 1 个月（等 data 更新完再拉一次）
			this.$nextTick(() => {
				this.loadSummaryByRange()
			})
		},

		methods: {
			// 统一走 common/auth.js 的 getToken

			getToken() {
				const token = getAuthToken()
				if (!token) {
					uni.showToast({
						title: '登录已过期，请重新登录',
						icon: 'none'
					})
					ensureLogin()
					return ''
				}
				return token
			},

			// 默认时间段：今天往前推 1 个月 ~ 今天
			initDateRange() {
				const end = new Date()
				const start = new Date()
				start.setMonth(start.getMonth() - 1)

				const fmt = (d) => {
					const y = d.getFullYear()
					const m = String(d.getMonth() + 1).padStart(2, '0')
					const day = String(d.getDate()).padStart(2, '0')
					return `${y}-${m}-${day}`
				}

				this.startDate = fmt(start)
				this.endDate = fmt(end)
			},

			async loadCustomers() {
			  try {
			    const token = this.getToken()
			    if (!token) return // 这里直接退出，避免再调云函数
			
			    const res = await uniCloud.callFunction({
			      name: 'crm-customer',
			      data: {
			        action: 'list',
			        token,
			        data: {}
			      }
			    })
			    const result = res.result || {}
			    if (result.code !== 0) {
			      uni.showToast({
			        title: result.msg || '加载客户失败',
			        icon: 'none'
			      })
			      return
			    }
			    this.customers = result.data || []
			  } catch (e) {
			    console.error('loadCustomers error', e)
			    uni.showToast({
			      title: '加载客户失败',
			      icon: 'none'
			    })
			  }
			},

			onCustomerInput(e) {
				this.customerKeyword = e.detail.value
				this.showCustomerDropdown = !!this.customerKeyword
				// 只做联想，不在这里查汇总
			},

			onCustomerConfirm() {
				// 回车时，如果刚好只有一个匹配，自动选中
				if (this.filteredCustomers.length === 1) {
					this.onSelectCustomer(this.filteredCustomers[0])
				} else {
					this.showCustomerDropdown = true
				}
			},

			onSelectCustomer(item) {
				this.customerId = item._id
				this.customerName = item.name
				this.customerKeyword = item.name
				this.showCustomerDropdown = false
				this.loadSummaryByRange()
			},

			/* ===== 时间段选择 ===== */
			onStartDateChange(e) {
				this.startDate = e.detail.value
				// 只要日期都有，就按“全部客户 / 当前客户”重新统计
				if (this.endDate) {
					this.loadSummaryByRange()
				}
			},

			onEndDateChange(e) {
				this.endDate = e.detail.value
				if (this.startDate) {
					this.loadSummaryByRange()
				}
			},

			/* ===== 拉取汇总（客户可选；不选=全部客户） ===== */
			async loadSummaryByRange() {
				if (!this.startDate || !this.endDate) {
					this.resetSummary()
					return
				}
				// 简单校验：开始日期不能大于结束日期
				if (this.startDate > this.endDate) {
					uni.showToast({
						title: '开始日期不能大于结束日期',
						icon: 'none'
					})
					this.resetSummary()
					return
				}

				// 登录校验
				const token = this.getToken()
				if (!token) {
					this.resetSummary()
					return
				}

				this.loadingSummary = true
				try {
					const res = await uniCloud.callFunction({
						name: 'crm-bill',
						data: {
							action: 'customerSummaryByRange',
							token,
							data: {
								customer_id: this.customerId || '',
								customer_name: this.customerName || '',
								date_from: this.startDate,
								date_to: this.endDate
							}
						}
					})

					const result = res.result || {}
					if (result.code !== 0) {
						uni.showToast({
							title: result.msg || '加载账单失败',
							icon: 'none'
						})
						this.resetSummary()
						return
					}

					const info = result.data || {}
					const to2 = (v) => Number(v || 0).toFixed(2)

					this.summary = {
						out_net_total: to2(info.out_net_total),
						back_net_total: to2(info.back_net_total),
						net_total: to2(info.net_total),
						amount_total: to2(info.amount_total),
						amount_received_total: to2(info.amount_received_total),
						unpaid_total: to2(info.unpaid_total),
						record_count: info.record_count || 0
					}
				} catch (e) {
					console.error('loadSummaryByRange error', e)
					uni.showToast({
						title: '加载账单失败',
						icon: 'none'
					})
					this.resetSummary()
				} finally {
					this.loadingSummary = false
				}
			},

			resetSummary() {
				this.summary = {
					out_net_total: '0.00',
					back_net_total: '0.00',
					net_total: '0.00',
					amount_total: '0.00',
					amount_received_total: '0.00',
					unpaid_total: '0.00',
					record_count: 0
				}
			},

			resetFilter() {
				this.customerKeyword = ''
				this.customerId = ''
				this.customerName = ''
				this.showCustomerDropdown = false
				this.initDateRange()
				// 重置后，回到“全部客户 + 最近 1 个月”
				this.loadSummaryByRange()
			},

			// 点击汇总卡片 or 查看明细按钮 -> 日度明细页
			goDailyDetail() {
				if (!this.customerId && !this.customerName) {
					uni.showToast({
						title: '请选择一个客户再看明细（汇总已经是全部客户了）',
						icon: 'none'
					})
					return
				}
				if (!this.startDate || !this.endDate) {
					uni.showToast({
						title: '请选择时间范围',
						icon: 'none'
					})
					return
				}

				uni.navigateTo({
					url: `/pages/bill/monthly-detail` +
						`?customer_id=${this.customerId || ''}` +
						`&customer_name=${encodeURIComponent(this.customerName || '')}` +
						`&date_from=${this.startDate}` +
						`&date_to=${this.endDate}`
				})
			}
		}
	}
</script>

<style scoped>
	.page {
		min-height: 100vh;
		background: #f2f4f9;
		padding: 24rpx 16rpx 40rpx;
		box-sizing: border-box;
	}

	.inner {
		max-width: 1600rpx;
		margin: 0 auto;
	}

	/* 顶部区域：客户 + 时间范围 */
	.top-bar {
		display: flex;
		flex-wrap: wrap;
		row-gap: 16rpx;
		margin-bottom: 20rpx;
	}

	/* 统一字段容器 */
	.field {
		display: flex;
		flex-direction: column;
	}

	/* 客户行：整行铺满 */
	.customer-field {
		flex: 1 1 100%;
		min-width: 100%;
	}

	/* 时间范围：也整行铺满，这样不挤 */
	.date-range-field {
		flex: 1 1 100%;
		min-width: 100%;
	}

	.label {
		font-size: 24rpx;
		color: #555;
		margin-bottom: 6rpx;
	}

	/* 普通输入外壳（客户输入框） */
	.input-wrapper {
		width: 100%;
		height: 80rpx;
		padding: 0 20rpx;
		border-radius: 20rpx;
		border: 1rpx solid #e0e0e0;
		background: #ffffff;
		box-shadow: 0 10rpx 24rpx rgba(16, 46, 90, 0.04);
		box-sizing: border-box;
		display: flex;
		align-items: center;
	}

	.input {
		flex: 1;
		border: none;
		background: transparent;
		font-size: 28rpx;
		color: #222;
	}

	/* 时间范围胶囊 */
	.date-range-wrapper {
		width: 100%;
		height: 80rpx;
		border-radius: 24rpx;
		border: 1rpx solid #e0e0e0;
		background: #ffffff;
		box-shadow: 0 10rpx 24rpx rgba(16, 46, 90, 0.04);
		box-sizing: border-box;
		padding: 0 18rpx;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	/* 每个日期小块 */
	.date-input {
		flex: 1;
		height: 100%;
		border-radius: 18rpx;
		padding: 0 10rpx;
		display: flex;
		align-items: center;
		font-size: 26rpx;
		color: #222;
		justify-content: center;
		text-align: center;
	}

	/* 中间的“至” */
	.range-sep {
		margin: 0 8rpx;
		font-size: 24rpx;
		color: #9ca3af;
	}

	/* 客户联想面板 */
	.suggest-panel {
		margin-top: 6rpx;
		background: #ffffff;
		border-radius: 18rpx;
		box-shadow: 0 14rpx 30rpx rgba(15, 23, 42, 0.18);
		border: 1rpx solid #e5e7eb;
		max-height: 420rpx;
		overflow: auto;
	}

	.suggest-list {
		padding: 6rpx 0;
	}

	.suggest-item {
		padding: 10rpx 18rpx;
		display: flex;
		flex-direction: column;
	}

	.suggest-item+.suggest-item {
		border-top: 1rpx solid #f3f4f6;
	}

	.suggest-name {
		font-size: 26rpx;
		color: #111827;
	}

	.suggest-sub {
		margin-top: 2rpx;
		font-size: 22rpx;
		color: #9ca3af;
	}

	.suggest-empty {
		padding: 16rpx 18rpx;
		font-size: 24rpx;
		color: #9ca3af;
	}

	/* 汇总卡片 */
	.summary-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 16rpx;
		margin-top: 8rpx;
	}

	.summary-card {
		background: #ffffff;
		border-radius: 24rpx;
		padding: 20rpx 22rpx;
		box-shadow: 0 10rpx 26rpx rgba(15, 35, 52, 0.05);
		border: 1rpx solid rgba(235, 238, 245, 0.9);
	}

	.summary-label {
		font-size: 24rpx;
		color: #6b7280;
	}

	.summary-main {
		margin-top: 10rpx;
		display: flex;
		align-items: baseline;
	}

	.summary-value {
		font-size: 34rpx;
		font-weight: 700;
		color: #111827;
	}

	.summary-unit {
		font-size: 24rpx;
		color: #9ca3af;
		margin-left: 4rpx;
	}

	.unpaid {
		color: #dc2626;
	}

	/* 底部注脚 */
	.footer-note {
		margin-top: 18rpx;
	}

	.note-text {
		font-size: 24rpx;
		color: #6b7280;
	}

	.note-strong {
		font-weight: 600;
		color: #111827;
	}

	/* 空状态注脚样式 */
	.footer-note-empty {
		display: flex;
		flex-direction: column;
	}

	.note-sub {
		margin-top: 4rpx;
		font-size: 22rpx;
		color: #9ca3af;
	}

	/* 底部按钮 */
	.bottom-actions {
		margin-top: 24rpx;
		display: flex;
		justify-content: flex-end;
		column-gap: 16rpx;
	}

	.btn-soft,
	.btn-primary {
		min-width: 180rpx;
		padding: 16rpx 24rpx;
		border-radius: 999rpx;
		font-size: 26rpx;
	}

	.btn-soft {
		background: rgba(244, 247, 255, 0.9);
		color: #4d5cff;
		border: 1rpx solid rgba(212, 220, 255, 0.9);
	}

	.btn-soft::after {
		border: none;
	}

	.btn-primary {
		background: linear-gradient(135deg, #2979ff, #1a98ff);
		color: #ffffff;
		box-shadow: 0 14rpx 30rpx rgba(26, 120, 255, 0.32);
		border: none;
	}

	.btn-primary::after {
		border: none;
	}

	@media screen and (max-width: 750px) {
		.date-range-wrapper {
			padding: 0 10rpx;
		}

		.date-input {
			font-size: 24rpx;
		}
	}
</style>