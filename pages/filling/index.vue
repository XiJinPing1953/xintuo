<template>
	<view class="filling-page">
		<view class="filling-inner">
			<BackToDashboardBar back-to="/pages/dashboard/index" text="返回工作台" />

			<!-- 顶部标题 -->
			<view class="page-header">
				<view class="page-header-left">
					<view class="page-icon">
						<text class="page-icon-text">灌</text>
					</view>
					<view class="page-header-text">
						<text class="page-title">灌装管理</text>
						<text class="page-sub">
							记录站上每一瓶的灌装数据，对比进站、销售，追踪气量损耗
						</text>
					</view>
				</view>
			</view>

			<!-- 顶部：时间筛选 + 概览 -->
			<view class="card card-summary">
				<!-- 时间筛选 -->
				<view class="filter-row">
					<view class="filter-tabs">
						<view class="filter-tab" :class="{ active: filterPreset === 'today' }"
							@click="changePreset('today')">
							今日
						</view>
						<view class="filter-tab" :class="{ active: filterPreset === 'week' }"
							@click="changePreset('week')">
							本周
						</view>
						<view class="filter-tab" :class="{ active: filterPreset === 'month' }"
							@click="changePreset('month')">
							本月
						</view>
						<view class="filter-tab" :class="{ active: filterPreset === 'custom' }"
							@click="changePreset('custom')">
							自定义
						</view>
					</view>

					<view class="filter-dates" v-if="filterPreset === 'custom'">
						<picker mode="date" :value="dateRange.start" @change="onDateChange($event, 'start')">
							<view class="date-input">
								<text class="date-label">开始</text>
								<text class="date-value">
									{{ dateRange.start || '选择日期' }}
								</text>
							</view>
						</picker>
						<text class="date-sep">-</text>
						<picker mode="date" :value="dateRange.end" @change="onDateChange($event, 'end')">
							<view class="date-input">
								<text class="date-label">结束</text>
								<text class="date-value">
									{{ dateRange.end || '选择日期' }}
								</text>
							</view>
						</picker>
					</view>
				</view>

				<!-- 概览三个大数字 -->
				<view class="summary-row" v-if="!loadingSummary">
					<view class="summary-card">
						<view class="summary-label">进站总量</view>
						<view class="summary-value-row">
							<text class="summary-value">
								{{ formatKg(summary.inbound_total) }}
							</text>
							<text class="summary-unit">kg</text>
						</view>
						<text class="summary-tip">期间所有入库天然气净重合计</text>
					</view>

					<view class="summary-card">
						<view class="summary-label">灌装总量</view>
						<view class="summary-value-row">
							<text class="summary-value">
								{{ formatKg(summary.fill_total) }}
							</text>
							<text class="summary-unit">kg</text>
						</view>
						<text class="summary-tip">所有灌装记录净重合计</text>
					</view>

					<view class="summary-card">
						<view class="summary-label">销售出站总量</view>
						<view class="summary-value-row">
							<text class="summary-value">
								{{ formatKg(summary.sale_total) }}
							</text>
							<text class="summary-unit">kg</text>
						</view>
						<text class="summary-tip">对应期间销售出瓶净重合计</text>
					</view>
				</view>

				<view class="summary-row loading" v-else>
					<text class="loading-text">正在统计灌装与损耗数据...</text>
				</view>

				<!-- 差值说明 -->
				<view class="diff-row" v-if="!loadingSummary">
					<view class="diff-item">
						<text class="diff-label">进站 → 灌装 差值</text>
						<text class="diff-value" :class="{ danger: Math.abs(diffInboundFillRaw) > diffThreshold }">
							{{ formatKg(diffInboundFillRaw) }} kg
						</text>
					</view>
					<view class="diff-item">
						<text class="diff-label">灌装 → 销售 差值</text>
						<text class="diff-value" :class="{ danger: Math.abs(diffFillSaleRaw) > diffThreshold }">
							{{ formatKg(diffFillSaleRaw) }} kg
						</text>
					</view>
					<view class="diff-item">
						<text class="diff-label">进站 → 销售 总差值</text>
						<text class="diff-value" :class="{ danger: Math.abs(diffInboundSaleRaw) > diffThreshold }">
							{{ formatKg(diffInboundSaleRaw) }} kg
						</text>
					</view>
				</view>
			</view>

			<!-- 中部：左表单 + 右列表 -->
			<view class="layout-main">
				<!-- 左：新增灌装记录（非管理员整卡灰化） -->
				<view class="col-left">
					<view class="card" :class="{ 'card-disabled': !isAdmin }">
						<view class="card-header">
							<text class="card-title">
								{{ isEditing ? '编辑灌装记录' : '新增灌装记录' }}
							</text>
							<text v-if="!isAdmin" style="color:#d9534f;font-size:24rpx;margin-top:4rpx;">
								（仅管理员可录入）
							</text>
							<text v-if="isAdmin && isEditing" style="color:#6b7280;font-size:22rpx;margin-top:4rpx;">
								正在编辑，修改后点击下方“提交灌装记录”保存
							</text>
						</view>

                                                <view class="form-body">
                                                        <view class="form-row">
                                                                <text class="form-label">灌装日期</text>
                                                                <picker mode="date" :value="form.date" @change="(e) => (form.date = e.detail.value)">
                                                                        <view class="picker-display">
                                                                                <text>{{ form.date || '选择日期' }}</text>
                                                                        </view>
                                                                </picker>
                                                        </view>
                                                        <!-- 瓶号 + 联想 -->
                                                        <view class="form-row">
                                                                <text class="form-label">瓶号</text>
                                                                <view class="input-with-suggest">
                                                                        <input class="form-input" :disabled="!isAdmin" v-model.trim="form.bottle_no"
										placeholder="请输入瓶号，如 217，支持模糊搜索" @input="onBottleInput" @blur="onBottleBlur" />
									<!-- 候选瓶号下拉列表，仅管理员可用 -->
									<view v-if="
                      isAdmin &&
                      bottleSuggestions &&
                      bottleSuggestions.length
                    " class="bottle-suggest">
										<view v-for="item in bottleSuggestions" :key="item._id || item.number"
											class="suggest-item" @tap.stop="onSelectBottle(item)">
											<text class="suggest-no">{{ item.number }}</text>
											<text class="suggest-sub">
												皮重
												{{
                          item.tare_weight != null ? item.tare_weight : '-'
                        }}kg ·
												{{ bottleStatusText(item.status) }}
											</text>
                                                                </view>
                                                        </view>
								</view>
							</view>

							<!-- 上次瓶子信息提示（只读） -->
							<view v-if="lastBottleInfo" class="last-bottle-info">
								<text class="last-info-text">
									上次客户：{{ lastBottleInfo.last_customer_name || '—' }}；
									上次回瓶净重：
									{{
                    effectiveLastBackNet != null
                      ? formatKg(effectiveLastBackNet)
                      : '-'
                  }}kg；
									本次灌装皮重参考：
									{{
                    lastBottleInfo.last_gross_weight != null
                      ? formatKg(lastBottleInfo.last_gross_weight)
                      : '-'
                  }}kg；
									瓶子铭牌皮重：
									{{
                    lastBottleInfo.tare_weight != null
                      ? formatKg(lastBottleInfo.tare_weight)
                      : '-'
                  }}kg
								</text>

								<view v-if="showTareWarning" style="color:#d9534f;font-size:26rpx;margin-top:4rpx;">
									⚠ 与铭牌皮重差异较大，请核实瓶子是否称重异常
								</view>
							</view>

                                                        <view class="form-row">
                                                                <text class="form-label">灌装后毛重 (kg)</text>
                                                                <input class="form-input" :disabled="!isAdmin" v-model="form.gross_fill" type="digit"
                                                                        placeholder="灌装后称的毛重" />
                                                        </view>

                                                        <view class="form-row">
                                                                <text class="form-label">灌装前皮重 (kg)</text>
                                                                <input class="form-input" :disabled="!isAdmin" v-model="form.tare_fill" type="digit"
                                                                        placeholder="站上称的空瓶重量" />
                                                        </view>

							<view class="form-row">
								<text class="form-label">灌装净重 (kg)</text>
								<view class="form-static">
									<text :class="{
                      'net-value': true,
                      danger: netFillRaw <= 0
                    }">
										{{ netFillText }}
									</text>
									<text class="form-hint" v-if="netFillRaw <= 0">
										净重≤0，请检查皮重/毛重是否录反
									</text>
								</view>
							</view>

                                <view class="form-row operator-row">
                                        <text class="form-label">操作员</text>
                                        <view class="operator-autocomplete">
                                                <input class="form-input" :disabled="!isAdmin" v-model.trim="form.operator"
                                                        placeholder="输入并选择配送员" @input="onOperatorInput" @focus="onOperatorFocus"
                                                        @blur="onOperatorBlur" />
                                                <view v-if="showOperatorDropdown" class="operator-suggestions">
                                                        <view v-for="item in operatorSuggestions" :key="item._id || item.display"
                                                                class="suggestion-item" @click="selectOperator(item)">
                                                                {{ item.display }}
                                                        </view>
                                                        <view v-if="!operatorSuggestions.length" class="suggestion-empty">
                                                                未找到匹配的配送员
                                                        </view>
                                                </view>
                                        </view>
                                </view>

							<view class="form-row">
								<text class="form-label">备注</text>
								<textarea class="form-textarea" :disabled="!isAdmin" v-model.trim="form.remark"
									auto-height placeholder="可记录本次灌装的特殊情况、批次等信息" />
							</view>

							<view class="form-actions">
								<button class="btn-primary" :loading="submitting" :disabled="!isAdmin"
									@click="onSubmitClick">
									提交灌装记录
								</button>
								<button v-if="isAdmin && isEditing" class="btn-secondary" style="margin-left:12rpx;"
									@click="exitEditMode">
									取消编辑
								</button>
							</view>
						</view>
					</view>
				</view>

				<!-- 右：灌装记录列表 -->
				<view class="col-right">
					<view class="card">
						<view class="card-header card-header-with-actions">
							<view class="card-header-main">
								<text class="card-title">灌装记录</text>
								<text class="card-sub">
									显示当前时间段内的灌装记录，默认按时间倒序
								</text>
							</view>

							<button class="btn-secondary btn-export" @click="exportFilling">
								导出
							</button>
						</view>

						<view v-if="loadingList" class="list-empty">
							<text class="empty-text">正在加载灌装记录...</text>
						</view>

						<view v-else-if="!fillingList.length" class="list-empty">
							<text class="empty-text">
								当前时间段内暂无灌装记录。
							</text>
						</view>

						<view v-else class="filling-list">
							<view class="list-header">
								<text class="col-time">日期</text>
								<text class="col-bottle">瓶号</text>
								<text class="col-num">皮重</text>
								<text class="col-num">毛重</text>
								<text class="col-num">净重</text>
								<text class="col-operator">操作员</text>
								<text v-if="isAdmin" class="col-operator">操作</text>
							</view>

							<view v-for="item in fillingList" :key="item._id" class="list-row">
								<text class="col-time">{{ item.date || '--' }}</text>
								<text class="col-bottle">{{ item.bottle_no || '--' }}</text>
								<text class="col-num">{{ formatKg(item.tare_fill) }}</text>
								<text class="col-num">{{ formatKg(item.gross_fill) }}</text>
								<text class="col-num">{{ formatKg(item.net_fill) }}</text>
								<text class="col-operator">
									{{ item.operator || '-' }}
								</text>

								<!-- 管理员编辑按钮：复用左侧表单 -->
                                                                <view v-if="isAdmin" class="edit-btn-cell">
                                                                        <button class="btn-edit" @click="startEdit(item)">编辑</button>
                                                                        <button class="btn-danger" @click="confirmDelete(item)">删除</button>
                                                                </view>
							</view>
						</view>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
        import BackToDashboardBar from '@/components/BackToDashboardBar.vue'
        import {
                ensureLogin,
                getUserInfo,
                isAdminRole
        } from '@/common/auth.js'
        import { callCloud } from '@/common/request.js'

	// 简单防抖
	function debounce(fn, delay = 200) {
		let timer = null
		return function(...args) {
			clearTimeout(timer)
			timer = setTimeout(() => {
				fn.apply(this, args)
			}, delay)
		}
	}

	export default {
		components: {
			BackToDashboardBar
		},

		data() {
			return {
                                userInfo: {},
                                isAdmin: false,

                                deliveryList: [],
                                operatorSuggestions: [],
                                showOperatorDropdown: false,

                                // 时间范围
				filterPreset: 'month',
				dateRange: {
					start: '',
					end: ''
				},

				// 概览数据
				loadingSummary: false,
				summary: {
					inbound_total: 0,
					fill_total: 0,
					sale_total: 0
				},

				// 列表
				loadingList: false,
				fillingList: [],

                                // 灌装表单（新增 / 编辑共用）
                                form: {
                                        bottle_no: '',
                                        date: '',
                                        tare_fill: '',
                                        gross_fill: '',
                                        operator: '',
                                        remark: ''
                                },
				submitting: false,

				// 差值阈值
				diffThreshold: 5,

				// 瓶号联想 & 状态
				statusTextMap: {
					in_station: '在站',
					at_customer: '在客户',
					repairing: '维修',
					scrapped: '报废',
					lost: '丢失',
					unknown: '未知'
				},
				bottleSuggestions: [],
				bottleSearchCache: {},
				bottleSearchPending: {},
				debouncedBottleSuggest: null,
				bottleExists: null,
				lastBottleInfo: null,

				// 编辑状态
				isEditing: false,
				editingId: null
			}
		},

		computed: {
			// 当前表单灌装净重
			netFillRaw() {
				const tare = Number(this.form.tare_fill)
				const gross = Number(this.form.gross_fill)
				if (isNaN(tare) || isNaN(gross)) return 0
				return +(gross - tare)
			},
			netFillText() {
				return this.netFillRaw.toFixed(2)
			},

			// 差值
			diffInboundFillRaw() {
				const {
					inbound_total,
					fill_total
				} = this.summary
				return +(Number(inbound_total || 0) - Number(fill_total || 0))
			},
			diffFillSaleRaw() {
				const {
					fill_total,
					sale_total
				} = this.summary
				return +(Number(fill_total || 0) - Number(sale_total || 0))
			},
			diffInboundSaleRaw() {
				const {
					inbound_total,
					sale_total
				} = this.summary
				return +(Number(inbound_total || 0) - Number(sale_total || 0))
			},

			// 皮重预警
                        showTareWarning() {
                                if (!this.lastBottleInfo) return false
                                const tareRef = Number(this.lastBottleInfo.tare_weight)
                                const tareFill = Number(this.form.tare_fill)
                                if (isNaN(tareRef) || isNaN(tareFill)) return false
                                return Math.abs(tareFill - tareRef) >= 3
                        },

                        // 统一“上次回瓶净重”
                        effectiveLastBackNet() {
                                const b = this.lastBottleInfo
                                if (!b) return null
                                if (b.last_back_net_weight != null) return Number(b.last_back_net_weight)
                                if (b.last_net_weight != null) return Number(b.last_net_weight)
                                return null
                        },

                        deliveryNames() {
                                return (this.deliveryList || []).map(item => item.name || item.real_name || item.phone || '')
                                        .filter(Boolean)
                        }
                },

onLoad() {
if (!ensureLogin()) return

this.userInfo = getUserInfo() || {}
this.isAdmin = isAdminRole(this.userInfo)

                        this.resetForm()

                        this.loadDeliveryList()
                        this.initMonthRange()
                        this.fetchAll()

			this.debouncedBottleSuggest = debounce(this.doBottleSuggest, 200)
		},

		onShow() {
			ensureLogin()
		},

                methods: {
                        async callFilling(action, data = {}) {
                                const result = await callCloud('crm-filling', { action, data })
                                if (result.code === 401) return null
                                return result
                        },

                        async loadDeliveryList() {
                                try {
                                        const result = await callCloud('crm-delivery', { action: 'list', data: {} })
                                        if (!result || result.code !== 0) return
                                        this.deliveryList = Array.isArray(result.data) ? result.data : []
                                        this.syncOperatorPicker()
                                } catch (err) {
                                        console.error('load delivery list error', err)
                                }
                        },

                        // ---- 通用 ----
                        bottleStatusText(status) {
                                return this.statusTextMap[status] || '未知状态'
                        },

                        syncOperatorPicker() {
                                this.updateOperatorSuggestions(this.form.operator)
                        },

                        onOperatorInput(e) {
                                const value = e.detail && typeof e.detail.value === 'string' ? e.detail.value : ''
                                this.form.operator = value
                                this.updateOperatorSuggestions(value)
                        },

                        onOperatorFocus() {
                                this.showOperatorDropdown = true
                                this.updateOperatorSuggestions(this.form.operator)
                        },

                        onOperatorBlur() {
                                setTimeout(() => {
                                        this.showOperatorDropdown = false
                                }, 120)
                        },

                        selectOperator(item) {
                                const name = (item && (item.name || item.real_name || item.phone)) || ''
                                this.form.operator = name
                                this.showOperatorDropdown = false
                        },

                        updateOperatorSuggestions(keyword = '') {
                                const list = Array.isArray(this.deliveryList) ? this.deliveryList : []
                                const kw = (keyword || '').trim().toLowerCase()
                                const filtered = list
                                        .map(item => ({
                                                ...item,
                                                display: (item.name || item.real_name || item.phone || '').trim()
                                        }))
                                        .filter(item => item.display)
                                        .filter(item => {
                                                if (!kw) return true
                                                return item.display.toLowerCase().includes(kw)
                                        })
                                        .slice(0, 8)

                                this.operatorSuggestions = filtered
                                this.showOperatorDropdown = this.isAdmin && filtered.length > 0
                        },

                        formatDate(d) {
                                const y = d.getFullYear()
                                const m = (d.getMonth() + 1).toString().padStart(2, '0')
                                const day = d.getDate().toString().padStart(2, '0')
                                return `${y}-${m}-${day}`
                        },

                        todayStr() {
                                return this.formatDate(new Date())
                        },

			formatKg(v) {
				const n = Number(v)
				if (isNaN(n)) return '0.00'
				return n.toFixed(2)
			},

			// ---- 时间预设 ----
			changePreset(preset) {
				if (this.filterPreset === preset && preset !== 'custom') return
				this.filterPreset = preset

				if (preset === 'today') {
					this.initTodayRange()
					this.fetchAll()
				} else if (preset === 'week') {
					this.initWeekRange()
					this.fetchAll()
				} else if (preset === 'month') {
					this.initMonthRange()
					this.fetchAll()
				} else if (
					preset === 'custom' &&
					this.dateRange.start &&
					this.dateRange.end
				) {
					this.fetchAll()
				}
			},

			onDateChange(e, key) {
				const value = e.detail.value
				this.dateRange[key] = value
				if (this.dateRange.start && this.dateRange.end) {
					this.fetchAll()
				}
			},

			initTodayRange() {
				const d = new Date()
				const day = this.formatDate(d)
				this.dateRange.start = day
				this.dateRange.end = day
			},

			initWeekRange() {
				const now = new Date()
				const day = now.getDay() || 7
				const monday = new Date(
					now.getFullYear(),
					now.getMonth(),
					now.getDate() - day + 1
				)
				this.dateRange.start = this.formatDate(monday)
				this.dateRange.end = this.formatDate(now)
			},

			initMonthRange() {
				const now = new Date()
				const first = new Date(now.getFullYear(), now.getMonth(), 1)
				this.dateRange.start = this.formatDate(first)
				this.dateRange.end = this.formatDate(now)
			},

			// ---- 拉数据 ----
                        fetchAll() {
                                this.fetchSummary()
                                this.fetchList()
                        },

                        async fetchSummary() {
                                if (!this.dateRange.start || !this.dateRange.end) return

                                this.loadingSummary = true
                                try {
                                        const result = await this.callFilling('summary', {
                                                start_date: this.dateRange.start,
                                                end_date: this.dateRange.end
                                        })
                                        if (result && result.code === 0 && result.data) {
                                                this.summary = Object.assign({}, this.summary, result.data || {})
                                        }
                                } catch (e) {
                                        console.error('fetchSummary exception:', e)
                                } finally {
                                        this.loadingSummary = false
                                }
                        },

                        async fetchList() {
                                if (!this.dateRange.start || !this.dateRange.end) return

                                this.loadingList = true
                                try {
                                        const result = await this.callFilling('list', {
                                                page: 1,
                                                pageSize: 100,
                                                start_date: this.dateRange.start,
                                                end_date: this.dateRange.end
                                        })
                                        if (result && result.code === 0 && Array.isArray(result.data)) {
                                                this.fillingList = result.data
                                        } else if (result && result.code !== 401) {
                                                console.warn('fetchList error:', result.msg)
                                                this.fillingList = []
                                        }
                                } catch (e) {
                                        console.error('fetchList exception:', e)
                                        this.fillingList = []
				} finally {
					this.loadingList = false
				}
			},

			// ---- 瓶号联想 / 档案 ----
                        async searchBottle(keyword) {
                                const key = (keyword || '').trim()
                                if (!key) return []

				if (this.bottleSearchCache[key]) {
					return this.bottleSearchCache[key]
				}
				if (this.bottleSearchPending[key]) {
					return this.bottleSearchPending[key]
				}

                                const req = callCloud('crm-bottle', {
                                        action: 'search',
                                        data: {
                                                keyword: key,
                                                limit: 20
                                        }
                                })
                                        .then(res => {
                                                if (res && res.code === 401) return []
                                                const list = (res && res.data) || []
                                                this.$set(this.bottleSearchCache, key, list)
                                                delete this.bottleSearchPending[key]
                                                return list
					})
					.catch(err => {
						console.error('searchBottle error', err)
						delete this.bottleSearchPending[key]
						return []
					})

				this.bottleSearchPending[key] = req
				return req
			},

			async doBottleSuggest(keyword) {
				const list = await this.searchBottle(keyword)
				if ((this.form.bottle_no || '').trim() !== (keyword || '').trim()) return
				this.bottleSuggestions = list
			},

			onBottleInput(e) {
				const val = (e.detail.value || '').trim()
				this.form.bottle_no = val
				this.bottleExists = null
				this.lastBottleInfo = null

				if (!val) {
					this.bottleSuggestions = []
					return
				}

				this.debouncedBottleSuggest && this.debouncedBottleSuggest(val)
			},

                        async onSelectBottle(item) {
                                if (!item) return
                                this.form.bottle_no = item.number || ''

				if (item.tare_weight != null && this.form.tare_fill === '') {
					this.form.tare_fill = String(item.tare_weight)
				}

                                this.bottleExists = true
                                this.bottleSuggestions = []

                                try {
                                        const res = await callCloud('crm-bottle', {
                                                action: 'detail',
                                                data: {
                                                        number: item.number
                                                }
                                        })
                                        const doc = res && res.data
                                        if (res && res.code === 401) return
                                        if (doc) {
                                                this.lastBottleInfo = doc
                                        }
                                } catch (err) {
                                        console.error('load bottle detail after select error', err)
				}
			},

			async onBottleBlur() {
				const no = (this.form.bottle_no || '').trim()
				if (!no) return

                                if (this.bottleSuggestions && this.bottleSuggestions.length) {
                                        return
                                }

                                try {
                                        const res = await callCloud('crm-bottle', {
                                                action: 'getByNumber',
                                                data: {
                                                        number: no
                                                }
                                        })
                                        if (res && res.code === 401) return

                                        const found = res && res.data
                                        if (res && res.code === 0 && found) {
                                                this.bottleExists = true
                                                if (!this.form.tare_fill && found.tare_weight != null) {
                                                        this.form.tare_fill = String(found.tare_weight)
                                                }
                                                this.lastBottleInfo = found
                                        } else {
                                                this.bottleExists = false
                                                this.lastBottleInfo = null
                                        }
				} catch (err) {
					console.error('onBottleBlur getByNumber error', err)
				}
			},

			// ---- 编辑：复用左侧表单 ----
			startEdit(item) {
				if (!this.isAdmin) {
					uni.showToast({
						title: '无权限，仅管理员可编辑',
						icon: 'none'
					})
					return
				}
				if (!item || !item._id) return

                                this.isEditing = true
                                this.editingId = item._id

                                this.form = {
                                        bottle_no: item.bottle_no || '',
                                        date: item.date || this.todayStr(),
                                        tare_fill: item.tare_fill != null ? String(item.tare_fill) : '',
                                        gross_fill: item.gross_fill != null ? String(item.gross_fill) : '',
                                        operator: item.operator || '',
                                        remark: item.remark || ''
                                }

				this.bottleSuggestions = []
				this.bottleExists = true
				this.lastBottleInfo = null
			},

			exitEditMode() {
				this.isEditing = false
				this.editingId = null
				this.resetForm()
			},

			// ---- 提交入口：统一做权限 & 新增/编辑分流 ----
			onSubmitClick() {
				if (!this.isAdmin) {
					uni.showToast({
						title: '无权限，仅管理员可录入灌装记录',
						icon: 'none'
					})
					return
				}

				if (this.isEditing) {
					this.submitEdit()
				} else {
					this.submitForm()
				}
			},

			// ---- 新增灌装记录 ----
			async submitForm() {
				if (!this.form.bottle_no) {
					uni.showToast({
						title: '请填写瓶号',
						icon: 'none'
					})
					return
				}

				const tare = Number(this.form.tare_fill)
				const gross = Number(this.form.gross_fill)
                                if (isNaN(tare) || isNaN(gross)) {
                                        uni.showToast({
                                                title: '请正确填写皮重和毛重',
                                                icon: 'none'
                                        })
                                        return
                                }
                                if (gross <= tare) {
                                        uni.showToast({
                                                title: '毛重要大于皮重',
                                                icon: 'none'
                                        })
                                        return
                                }

                                this.submitting = true
                                const bottleNo = (this.form.bottle_no || '').trim()

                                try {
                                        let existsFlag = this.bottleExists
                                        if (existsFlag == null) {
                                                try {
                                                        const checkRes = await callCloud('crm-bottle', {
                                                                action: 'getByNumber',
                                                                data: {
                                                                        number: bottleNo
                                                                }
                                                        })
                                                        if (checkRes && checkRes.code === 401) {
                                                                this.submitting = false
                                                                return
                                                        }
                                                        const found = checkRes && checkRes.data
                                                        existsFlag = !!(checkRes && checkRes.code === 0 && found)
                                                } catch (e) {
                                                        console.error('submitForm getByNumber error', e)
                                                }
                                        }

                                        if (existsFlag) {
                                                const result = await this.doCreateFilling(tare, gross)
						if (result.code === 0) {
							uni.showToast({
								title: '已保存',
								icon: 'success'
							})
							this.resetForm()
							this.fetchAll()
						} else {
							uni.showToast({
								title: result.msg || '保存失败',
								icon: 'none'
							})
						}
						this.submitting = false
						return
					}

					// 不存在 → 提示是否建档
					uni.showModal({
						title: '瓶号未建档',
						content: `瓶号 ${bottleNo} 在瓶子档案中不存在。\n是否根据本次灌装皮重 ${tare}kg 自动创建瓶子并保存灌装记录？`,
						cancelText: '只保存灌装',
						confirmText: '创建并保存',
                                                success: async modalRes => {
                                                        if (modalRes.confirm) {
                                                                try {
                                                                        const qr = await callCloud('crm-bottle', {
                                                                                action: 'quickCreate',
                                                                                data: {
                                                                                        number: bottleNo,
                                                                                        tare_weight: tare,
                                                                                        remark: '由灌装页面自动建档'
                                                                                }
                                                                        })
                                                                        if (!qr || qr.code === 401) return
                                                                        if (qr.code !== 0) {
                                                                                uni.showToast({
                                                                                        title: qr.msg || '建档失败',
                                                                                        icon: 'none'
										})
										this.submitting = false
										return
									}
								} catch (e) {
									console.error('quickCreate from filling error', e)
									uni.showToast({
										title: '建档失败',
										icon: 'none'
									})
									this.submitting = false
									return
								}

                                                        const result = await this.doCreateFilling(tare, gross)
								if (result.code === 0) {
									uni.showToast({
										title: '已建档并保存',
										icon: 'success'
									})
									this.resetForm()
									this.fetchAll()
								} else {
									uni.showToast({
										title: result.msg || '保存失败',
										icon: 'none'
									})
								}
							} else if (modalRes.cancel) {
                                                            const result = await this.doCreateFilling(tare, gross)
								if (result.code === 0) {
									uni.showToast({
										title: '已保存',
										icon: 'success'
									})
									this.resetForm()
									this.fetchAll()
								} else {
									uni.showToast({
										title: result.msg || '保存失败',
										icon: 'none'
									})
								}
							}
							this.submitting = false
						},
						fail: () => {
							this.submitting = false
						}
					})
				} catch (e) {
					console.error('submitForm exception:', e)
					uni.showToast({
						title: '请求出错',
						icon: 'none'
					})
					this.submitting = false
				}
			},

			// ---- 编辑保存 ----
                        async submitEdit() {
                                if (!this.editingId) {
                                        uni.showToast({
                                                title: '无效的编辑记录',
                                                icon: 'none'
                                        })
					return
				}

				const bottleNo = (this.form.bottle_no || '').trim()
				if (!bottleNo) {
					uni.showToast({
						title: '瓶号不能为空',
						icon: 'none'
					})
					return
				}

                                const tare = Number(this.form.tare_fill)
                                const gross = Number(this.form.gross_fill)
                                if (isNaN(tare) || isNaN(gross)) {
                                        uni.showToast({
                                                title: '请正确填写皮重和毛重',
                                                icon: 'none'
                                        })
                                        return
                                }
                                if (gross <= tare) {
                                        uni.showToast({
                                                title: '毛重要大于皮重',
                                                icon: 'none'
                                        })
                                        return
                                }

                                const fillDate = this.form.date || this.todayStr()

                                const net = gross - tare
                                this.submitting = true

                                try {
                                        const result = await this.callFilling('update', {
                                                id: this.editingId,
                                                bottle_no: bottleNo,
                                                date: fillDate,
                                                tare_fill: tare,
                                                gross_fill: gross,
                                                net_fill: net,
                                                operator: this.form.operator || '',
                                                remark: this.form.remark || ''
                                        })
                                        if (result && result.code === 0) {
                                                uni.showToast({
                                                        title: '修改已保存',
                                                        icon: 'success'
                                                })
                                                this.exitEditMode()
                                                this.fetchAll()
                                        } else if (result && result.code !== 401) {
                                                uni.showToast({
                                                        title: result.msg || '保存失败',
                                                        icon: 'none'
                                                })
                                        }
				} catch (e) {
					console.error('submitEdit exception:', e)
					uni.showToast({
						title: '请求出错',
						icon: 'none'
					})
				} finally {
					this.submitting = false
				}
			},

			// ---- 实际写库：创建灌装记录 ----
                        async doCreateFilling(tare, gross) {
                                const net = gross - tare
                                const res = await this.callFilling('create', {
                                        bottle_no: this.form.bottle_no,
                                        date: this.form.date || this.todayStr(),
                                        tare_fill: tare,
                                        gross_fill: gross,
                                        net_fill: net,
                                        operator:
                                                this.form.operator || (this.userInfo && this.userInfo.username) || '',
                                        remark: this.form.remark || ''
                                })
                                return res || {}
                        },

                        async confirmDelete(item) {
                                if (!item || !item._id) return
                                uni.showModal({
                                        title: '删除灌装记录',
                                        content: '确定要删除这条灌装记录吗？删除后不可恢复。',
                                        confirmText: '删除',
                                        confirmColor: '#d9534f',
                                        success: async res => {
                                                if (!res.confirm) return
                                                const result = await this.callFilling('remove', { id: item._id })
                                                if (result && result.code === 0) {
                                                        uni.showToast({
                                                                title: '已删除',
                                                                icon: 'success'
                                                        })
                                                        this.fetchList()
                                                } else if (result && result.code !== 401) {
                                                        uni.showToast({
                                                                title: result.msg || '删除失败',
                                                                icon: 'none'
                                                        })
                                                }
                                        }
                                })
                        },

                        resetForm() {
                                this.form = {
                                        bottle_no: '',
                                        date: this.todayStr(),
                                        tare_fill: '',
                                        gross_fill: '',
                                        operator: (this.userInfo && this.userInfo.real_name) || (this.userInfo && this.userInfo.username) || '',
                                        remark: ''
                                }
                                this.bottleSuggestions = []
                                this.bottleExists = null
                                this.lastBottleInfo = null
                                this.syncOperatorPicker()
                        },

                        // ---- 导出 ----
                        async exportFilling() {
                                if (!this.dateRange.start || !this.dateRange.end) {
                                        uni.showToast({
                                                title: '请先选择导出时间范围',
						icon: 'none'
					})
					return
                                }

                                try {
                                        const result = await this.callFilling('export', {
                                                start_date: this.dateRange.start,
                                                end_date: this.dateRange.end
                                        })
                                        if (!result || result.code === 401) return
                                        const rows = result.data || []

                                        if (!rows.length) {
                                                uni.showToast({
							title: '当前时间段无数据',
							icon: 'none'
						})
						return
					}

					const header = [
						'日期',
						'瓶号',
						'灌装前皮重(kg)',
						'灌装后毛重(kg)',
						'灌装净重(kg)',
						'操作员',
						'备注',
						'铭牌皮重(kg)',
						'上次客户',
						'上次出瓶日期',
						'上次回瓶日期',
						'上次回瓶毛重(kg)',
						'上次回瓶净重(kg)',
						'上次回瓶差值(kg)',
						'本次皮重-上次回瓶毛重(kg)',
						'本次皮重-铭牌皮重(kg)'
					]

					const lines = rows.map(r => {
						const arr = [
							r.date || '',
							r.bottle_no || '',
							r.tare_fill != null ? r.tare_fill : '',
							r.gross_fill != null ? r.gross_fill : '',
							r.net_fill != null ? r.net_fill : '',
							r.operator || '',
							(r.remark || '').replace(/\r?\n/g, ' '),
							r.tare_weight != null ? r.tare_weight : '',
							r.last_customer_name || '',
							r.last_out_date || '',
							r.last_back_date || '',
							r.last_gross_weight != null ? r.last_gross_weight : '',
							r.last_net_weight != null ? r.last_net_weight : '',
							r.last_return_diff != null ? r.last_return_diff : '',
							r.diff_tare_vs_last_gross != null ?
							r.diff_tare_vs_last_gross :
							'',
							r.diff_tare_vs_tare_weight != null ?
							r.diff_tare_vs_tare_weight :
							''
						]
						return arr
							.map(v => {
								const s = String(v)
								if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1) {
									return '"' + s.replace(/"/g, '""') + '"'
								}
								return s
							})
							.join(',')
					})

					const csvContent = [header.join(','), ...lines].join('\n')
					const fileName = `灌装记录导出_${this.dateRange.start}_${this.dateRange.end}.csv`

					// #ifdef H5
					const blob = new Blob([csvContent], {
						type: 'text/csv;charset=utf-8;'
					})
					const url = window.URL.createObjectURL(blob)
					const link = document.createElement('a')
					link.href = url
					link.download = fileName
					document.body.appendChild(link)
					link.click()
					document.body.removeChild(link)
					window.URL.revokeObjectURL(url)
					uni.showToast({
						title: '导出成功',
						icon: 'success'
					})
					// #endif

					// #ifndef H5
					console.log('filling export rows:', rows)
					uni.showToast({
						title: '已生成导出数据，请在电脑浏览器端使用导出功能',
						icon: 'none'
					})
					// #endif
				} catch (e) {
					console.error('exportFilling exception:', e)
					uni.showToast({
						title: '导出失败',
						icon: 'none'
					})
				}
			}
		}
	}
</script>

<style scoped>
	.filling-page {
		min-height: 100vh;
		box-sizing: border-box;
		padding: 24rpx 0 40rpx;
		background: linear-gradient(180deg,
				#f9fbff 0%,
				#f3f6fc 130rpx,
				#f2f4f9 100%);
	}

	.filling-inner {
		width: 100%;
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 24rpx;
		box-sizing: border-box;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin: 12rpx 0 16rpx;
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

	.card {
		background: #ffffff;
		border-radius: 26rpx;
		box-shadow: 0 12rpx 32rpx rgba(15, 35, 52, 0.04);
		padding: 28rpx 32rpx;
		box-sizing: border-box;
		margin-bottom: 24rpx;
		border: 1rpx solid rgba(240, 242, 247, 0.9);
	}

	/* 非管理员灰化效果 */
	.card-disabled {
		opacity: 0.45;
		pointer-events: none;
	}

	.card-header {
		display: flex;
		flex-direction: column;
		margin-bottom: 14rpx;
	}

	.card-header-with-actions {
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
	}

	.card-header-main {
		display: flex;
		flex-direction: column;
	}

	.card-title {
		font-size: 28rpx;
		font-weight: 600;
		color: #222;
	}

	.card-sub {
		margin-top: 4rpx;
		font-size: 22rpx;
		color: #9aa0ae;
	}

	.card-summary {
		margin-bottom: 24rpx;
	}

        .edit-btn-cell {
                flex: 0.8;
                padding-left: 12rpx;
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                gap: 10rpx;
        }

        .btn-edit,
        .btn-danger {
                width: 140rpx;
                text-align: center;
                padding: 8rpx 12rpx;
                font-size: 22rpx;
                border-radius: 14rpx;
                transition: all 0.15s ease;
        }

        .btn-edit {
                background: #f3f4f6;
                border: 1rpx solid #e5e7eb;
                color: #4b5563;
        }

        .btn-edit:active {
                background: #e5e7eb;
        }

        .btn-danger {
                background: #fff5f5;
                border: 1rpx solid #fecdd3;
                color: #d92d20;
        }

        .btn-danger:active {
                background: #ffe4e6;
        }

	.filter-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16rpx;
	}

	.filter-tabs {
		display: flex;
		padding: 4rpx;
		border-radius: 999rpx;
		background: #f3f4ff;
	}

	.filter-tab {
		min-width: 96rpx;
		padding: 8rpx 16rpx;
		border-radius: 999rpx;
		font-size: 22rpx;
		color: #4b5563;
		text-align: center;
	}

	.filter-tab.active {
		background: #ffffff;
		color: #1f2937;
		font-weight: 600;
		box-shadow: 0 4rpx 10rpx rgba(125, 140, 255, 0.2);
	}

	.filter-dates {
		display: flex;
		align-items: center;
	}

	.date-input {
		min-width: 180rpx;
		padding: 8rpx 14rpx;
		border-radius: 999rpx;
		background: #f9fafb;
		border: 1rpx solid #e5e7eb;
		display: flex;
		align-items: center;
	}

	.date-label {
		font-size: 22rpx;
		color: #9ca3af;
		margin-right: 4rpx;
	}

	.date-value {
		font-size: 22rpx;
		color: #374151;
	}

	.date-sep {
		margin: 0 8rpx;
		font-size: 22rpx;
		color: #9ca3af;
	}

	.summary-row {
		display: flex;
		flex-wrap: wrap;
		column-gap: 24rpx;
		row-gap: 16rpx;
	}

	.summary-row.loading {
		padding: 16rpx 0 4rpx;
	}

	.loading-text {
		font-size: 24rpx;
		color: #9aa0ae;
	}

	.summary-card {
		flex: 1;
		min-width: 0;
		padding: 18rpx 20rpx;
		border-radius: 20rpx;
		background: #f8faff;
		border: 1rpx solid rgba(235, 238, 245, 0.9);
	}

	.summary-label {
		font-size: 24rpx;
		color: #4b5563;
	}

	.summary-value-row {
		display: flex;
		align-items: baseline;
		margin: 4rpx 0 2rpx;
	}

	.summary-value {
		font-size: 36rpx;
		font-weight: 700;
		color: #111827;
	}

	.summary-unit {
		font-size: 22rpx;
		color: #9ca3af;
		margin-left: 4rpx;
	}

	.summary-tip {
		font-size: 22rpx;
		color: #9aa0ae;
	}

	.diff-row {
		margin-top: 14rpx;
		padding-top: 12rpx;
		border-top: 1rpx solid #e5e7eb;
		display: flex;
		flex-wrap: wrap;
		row-gap: 6rpx;
	}

	.diff-item {
		margin-right: 24rpx;
	}

	.diff-label {
		font-size: 22rpx;
		color: #6b7280;
		margin-right: 4rpx;
	}

	.diff-value {
		font-size: 24rpx;
		color: #111827;
	}

	.diff-value.danger {
		color: #dc2626;
	}

	.layout-main {
		margin-top: 8rpx;
		display: flex;
		align-items: flex-start;
	}

	.col-left {
		width: 420rpx;
		flex-shrink: 0;
	}

	.col-right {
		flex: 1;
		margin-left: 24rpx;
	}

	.form-body {
		margin-top: 6rpx;
	}

.form-row {
                margin-bottom: 16rpx;
}

.operator-row {
                position: relative;
}

.operator-autocomplete {
                flex: 1;
                position: relative;
}

.operator-suggestions {
                position: absolute;
                top: 78rpx;
                left: 0;
                right: 0;
                background: #ffffff;
                border: 1rpx solid #e5e7eb;
                border-radius: 14rpx;
                box-shadow: 0 10rpx 30rpx rgba(0, 0, 0, 0.04);
                max-height: 320rpx;
                overflow: auto;
                z-index: 10;
}

.suggestion-item,
.suggestion-empty {
                padding: 18rpx 20rpx;
                font-size: 26rpx;
                color: #111827;
}

.suggestion-item + .suggestion-item {
                border-top: 1rpx solid #f3f4f6;
}

.suggestion-item:hover,
.suggestion-item:active {
                background: #f3f4f6;
}

        .picker-display {
                padding: 12rpx 14rpx;
                border: 1rpx solid #e5e7eb;
                border-radius: 12rpx;
                background: #fff;
                color: #111827;
                min-height: 72rpx;
                display: flex;
                align-items: center;
        }

	.form-label {
		display: block;
		font-size: 24rpx;
		color: #4b5563;
		margin-bottom: 6rpx;
	}

	.form-input {
		width: 100%;
		height: 72rpx;
		padding: 0 18rpx;
		border-radius: 16rpx;
		border: 1rpx solid #e5e7eb;
		box-sizing: border-box;
		font-size: 24rpx;
		color: #111827;
		background: #f9fafb;
	}

	.form-input::placeholder {
		color: #9ca3af;
	}

	.input-with-suggest {
		position: relative;
	}

	.bottle-suggest {
		position: absolute;
		left: 0;
		right: 0;
		top: 78rpx;
		z-index: 20;
		background: #ffffff;
		border-radius: 16rpx;
		box-shadow: 0 8rpx 24rpx rgba(15, 35, 52, 0.16);
		padding: 6rpx 4rpx;
		max-height: 360rpx;
		overflow-y: auto;
	}

	.suggest-item {
		padding: 8rpx 12rpx;
		border-radius: 12rpx;
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 24rpx;
	}

	.suggest-item+.suggest-item {
		margin-top: 4rpx;
	}

	.suggest-no {
		color: #111827;
	}

	.suggest-sub {
		color: #9aa0b2;
		margin-left: 12rpx;
		font-size: 22rpx;
	}

	.last-bottle-info {
		margin-top: -6rpx;
		margin-bottom: 10rpx;
	}

	.last-info-text {
		font-size: 22rpx;
		color: #6b7280;
	}

	.form-textarea {
		width: 100%;
		min-height: 120rpx;
		padding: 12rpx 18rpx;
		border-radius: 16rpx;
		border: 1rpx solid #e5e7eb;
		box-sizing: border-box;
		font-size: 24rpx;
		color: #111827;
		background: #f9fafb;
	}

	.form-static {
		min-height: 72rpx;
		padding: 18rpx;
		border-radius: 16rpx;
		background: #f9fafb;
		border: 1rpx solid #e5e7eb;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.net-value {
		font-size: 28rpx;
		font-weight: 600;
		color: #111827;
	}

	.net-value.danger {
		color: #dc2626;
	}

	.form-hint {
		margin-top: 4rpx;
		font-size: 22rpx;
		color: #9ca3af;
	}

	.form-actions {
		margin-top: 8rpx;
		display: flex;
		justify-content: flex-end;
	}

	.btn-primary {
		min-width: 220rpx;
		height: 72rpx;
		line-height: 72rpx;
		border-radius: 999rpx;
		background: linear-gradient(135deg, #4f46e5, #6366f1);
		color: #ffffff;
		font-size: 26rpx;
		border: none;
	}

	.btn-secondary {
		min-width: 150rpx;
		height: 60rpx;
		line-height: 60rpx;
		border-radius: 999rpx;
		border: 1rpx solid #e5e7eb;
		font-size: 24rpx;
		color: #374151;
		background: #f9fafb;
	}

	.btn-export {
		padding: 0 24rpx;
	}

	.list-empty {
		padding: 24rpx 0;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.empty-text {
		font-size: 24rpx;
		color: #9ca3af;
	}

	.filling-list {
		margin-top: 4rpx;
	}

	/* 仅让右侧灌装记录表格所有列内容居中 */
	.filling-list .list-header text,
	.filling-list .list-row text {
		text-align: center !important;
	}

	.list-header,
	.list-row {
		display: flex;
		align-items: center;
		padding: 10rpx 4rpx;
	}


	.list-header {
		border-radius: 16rpx;
		background: #f3f4f6;
		margin-bottom: 6rpx;
	}

	.list-row:nth-child(2n) {
		background: #f9fafb;
		border-radius: 14rpx;
	}

	/* 日期、瓶号列：稍宽，但内容居中 */
	.col-time,
	.col-bottle,
	.col-num,
	.col-operator,
	.col-action {
		display: flex;
		justify-content: center;
		align-items: center;
		text-align: center;
	}

	/* 各列宽度比例，按你之前的来 */
	.col-time {
		flex: 1.4;
		font-size: 24rpx;
		color: #111827;
	}

	.col-bottle {
		flex: 1.1;
		font-size: 24rpx;
		color: #111827;
	}

	/* 数值列 */
	.col-num {
		flex: 1;
		font-size: 24rpx;
		color: #4b5563;
	}

	/* 操作员列 */
	.col-operator {
		flex: 1;
		font-size: 24rpx;
		color: #4b5563;
	}

	/* 操作按钮列（如果你有加） */
	.col-action {
		flex: 0.9;
		/* 可以按需要调，比如 0.8 / 1 */
	}

	@media screen and (max-width: 768px) {
		.filling-inner {
			padding: 0 16rpx;
		}

		.layout-main {
			flex-direction: column;
		}

		.col-left {
			width: 100%;
			margin-bottom: 16rpx;
		}

		.col-right {
			margin-left: 0;
		}

		.card {
			padding: 24rpx 22rpx;
			border-radius: 22rpx;
		}

		.summary-card {
			margin-bottom: 6rpx;
		}

		.list-header,
		.list-row {
			padding: 8rpx 2rpx;
		}
	}
</style>