<template>
	<view class="page">
		<view class="inner">

			<!-- 返回顶部栏 -->
			<BackToDashboardBar back-to="/pages/bill/monthly" text="返回" />

			<!-- 顶部标题 -->
			<view class="page-header">
				<view class="page-header-left">
					<view class="page-icon">
						<text class="page-icon-text">日</text>
					</view>

					<view class="page-header-text">
						<text class="page-title">
							{{ customerName || '未知客户' }} · {{ dateFrom }} ~ {{ dateTo }}
						</text>

						<text class="page-sub">
							时间范围内所有销售记录明细（含瓶号、金额、抹零与收款状态）
						</text>
					</view>
				</view>
			</view>

			<!-- 汇总卡片 -->
			<view class="card card-summary">
				<view class="summary-row">

					<view class="summary-item">
						<text class="summary-label">应收合计</text>
						<view class="summary-value-row">
							<text class="summary-value">{{ stats.totalShould | money }}</text>
							<text class="summary-unit">元</text>
						</view>
					</view>

					<view class="summary-item">
						<text class="summary-label">实收合计</text>
						<view class="summary-value-row">
							<text class="summary-value">{{ stats.totalReceived | money }}</text>
							<text class="summary-unit">元</text>
						</view>
					</view>

					<view class="summary-item">
						<text class="summary-label">抹零合计</text>
						<view class="summary-value-row">
							<text class="summary-value">{{ stats.totalWriteOff | money }}</text>
							<text class="summary-unit">元</text>
						</view>
					</view>

					<view class="summary-item">
						<text class="summary-label">未收合计</text>
						<view class="summary-value-row">
							<text class="summary-value" :class="stats.totalUnpaid > 0 ? 'text-danger' : 'text-normal'">
								{{ stats.totalUnpaid | money }}
							</text>
							<text class="summary-unit">元</text>
						</view>
					</view>

					<view class="summary-item">
						<text class="summary-label">记录条数</text>
						<view class="summary-value-row">
							<text class="summary-value">{{ records.length }}</text>
							<text class="summary-unit">条</text>
						</view>
					</view>

				</view>
			</view>

			<!-- 主卡片：销售记录列表 -->
			<view class="card card-table">

				<view class="card-header">
					<text class="card-title">销售记录明细</text>

					<text class="card-sub">
						点击瓶号可查看瓶子详情；可通过智能分配调整实收；支持导出 Excel
						<text v-if="hasFlowRecords" class="tag-flow">
							（含流量结算记录）
						</text>
					</text>
				</view>

				<!-- 智能分配 + 导出区域 -->
				<view class="auto-card" v-if="records.length">
					<view class="auto-row">
						<view class="auto-field">
							<text class="auto-label">本次收款金额</text>
							<view class="auto-input-wrapper">
								<input class="auto-input" v-model="payAmountInput" type="digit" placeholder="例如 3310" />
							</view>
						</view>

						<view class="auto-field">
							<text class="auto-label">本次抹零</text>
							<view class="auto-input-wrapper">
								<input class="auto-input" v-model="writeOffInput" type="digit" placeholder="例如 8" />
							</view>
						</view>
					</view>

					<view class="auto-row auto-row-bottom">
						<button class="btn-soft btn-export" :disabled="exporting" @click="onExport">
							<text v-if="!exporting">导出 Excel</text>
							<text v-else>导出中…</text>
						</button>

						<button v-if="isAdmin" class="btn-primary" :disabled="distributing" @click="onAutoDistribute">
							<text v-if="!distributing">智能分配到下方记录</text>
							<text v-else>分配中…</text>
						</button>
					</view>
				</view>

				<!-- loading -->
				<view v-if="loading" class="list-loading">
					<text class="loading-text">加载中…</text>
				</view>

				<!-- 空状态 -->
				<view v-else-if="records.length === 0" class="empty">
					<text class="empty-main">该时间段暂无销售记录</text>
					<text class="empty-sub">可返回上一页选择其他日期或客户</text>
				</view>

				<!-- 明细表：主销售记录表（非流量）-->
				<view v-else class="table-wrapper">

					<!-- 表头 -->
					<view class="table-header">
						<text class="th col-date">日期</text>
						<text class="th col-bottle">出瓶号</text>
						<text class="th col-bottle">回瓶号</text>
						<text class="th col-deposit">存瓶号</text>
						<text class="th col-weight">出瓶净重</text>
						<text class="th col-weight">回瓶净重</text>
						<text class="th col-price">单价</text>
						<text class="th col-amount">应收</text>
						<text class="th col-amount">实收</text>
						<text class="th col-amount">抹零</text>
						<text class="th col-amount">未收</text>
						<text class="th col-delivery">配送员</text>
						<text class="th col-car">车号</text>
						<text class="th col-status">收款状态</text>
						<text class="th col-op">详情</text>
					</view>

					<!-- 每行 -->
					<view
						v-for="item in records"
						:key="item._id"
						class="table-row"
						:class="{
              'row-unpaid': item.unpaid > 0,
              'row-partial': item.amount_received > 0 && item.unpaid > 0
            }">
						<!-- 日期 -->
						<text class="td col-date">
							{{ item.date || '-' }}
						</text>

						<!-- 出瓶号：显示前三个 + “…”（可点击弹出全部） -->
						<view class="td col-bottle">
							<block v-for="(no, idx) in getBottleList(item, 'out').slice(0, 2)" :key="'o'+idx">
								<text class="td-link" @tap.stop="goBottleDetail(no)">{{ no }}</text>
								<text v-if="idx < getBottleList(item,'out').slice(0,2).length - 1"> / </text>
							</block>
							<text
								v-if="getBottleList(item,'out').length > 2"
								class="td-link"
								@tap.stop="onBottleCellClick(item, 'out')"
							>
								 / …
							</text>
							<text v-if="getBottleList(item,'out').length === 0">-</text>
						</view>

						<!-- 回瓶号：显示前三个 + “…” -->
						<view class="td col-bottle">
							<block v-for="(no, idx) in getBottleList(item, 'back').slice(0, 2)" :key="'b'+idx">
								<text class="td-link" @tap.stop="goBottleDetail(no)">{{ no }}</text>
								<text v-if="idx < getBottleList(item,'back').slice(0,2).length - 1"> / </text>
							</block>
							<text
								v-if="getBottleList(item,'back').length > 2"
								class="td-link"
								@tap.stop="onBottleCellClick(item, 'back')"
							>
								 / …
							</text>
							<text v-if="getBottleList(item,'back').length === 0">-</text>
						</view>

						<!-- 存瓶号：显示前三个 + “…” -->
						<view class="td col-deposit">
							<block v-for="(no, idx) in getBottleList(item, 'deposit').slice(0, 2)" :key="'d'+idx">
								<text class="td-link" @tap.stop="goBottleDetail(no)">{{ no }}</text>
								<text v-if="idx < getBottleList(item,'deposit').slice(0,2).length - 1"> / </text>
							</block>
							<text
								v-if="getBottleList(item,'deposit').length > 2"
								class="td-link"
								@tap.stop="onBottleCellClick(item, 'deposit')"
							>
								 / …
							</text>
							<text v-if="getBottleList(item,'deposit').length === 0">-</text>
						</view>

						<!-- 出瓶净重 -->
						<text class="td col-weight">
							{{ formatNumber(item.out_net_total ?? item.net_weight_out) }}kg
						</text>

						<!-- 回瓶净重 -->
						<text class="td col-weight">
							{{ formatNumber(item.back_net_total ?? item.net_weight_back) }}kg
						</text>

						<!-- 单价 -->
						<text class="td col-price">
							<text v-if="item.unit_price != null">
								{{ Number(item.unit_price).toFixed(2) }}
								元/{{ item.price_unit === 'bottle' ? '瓶' : item.price_unit === 'm3' ? 'm³' : 'kg' }}
							</text>
							<text v-else>-</text>
						</text>

						<!-- 金额 -->
						<text class="td col-amount">{{ item.amount | money }}</text>
						<text class="td col-amount">{{ item.amount_received | money }}</text>
						<text class="td col-amount">{{ item.write_off | money }}</text>
						<text class="td col-amount" :class="item.unpaid>0 ? 'text-danger':'text-normal'">
							{{ item.unpaid | money }}
						</text>

						<!-- 配送员 -->
						<text class="td col-delivery">{{ item.delivery_man || '—' }}</text>

						<!-- 车号 -->
						<text class="td col-car">{{ item.car_no || '—' }}</text>

						<!-- 收款状态 -->
						<text class="td col-status">
							{{ item.payment_status || '—' }}
						</text>

						<!-- 详情 -->
						<view class="td col-op">
							<text class="td-link" @tap="goSaleDetail(item)">详情</text>
						</view>
					</view>

				</view> <!-- end 主表 -->

				<!-- 流量结算明细 -->
				<view v-if="hasFlowRecords && flowRecords.length" class="card card-table card-flow">
                                                <view class="card-header">
                                                        <text class="card-title">流量结算明细</text>
                                                        <text class="card-sub">按抄表区间计算，仅展示单价为元/m³的记录</text>
                                                </view>

					<view class="table-wrapper">
						<!-- 表头 -->
						<view class="table-header">
                                                        <text class="th col-date">抄表日期（区间结束）</text>
                                                        <text class="th col-flow-index">上次表数</text>
                                                        <text class="th col-flow-index">本次表数</text>
                                                        <text class="th col-flow-volume">用气量(m³)</text>
                                                        <text class="th col-flow-volume">理论用气量(m³)</text>
                                                        <text class="th col-flow-amount">单价</text>
                                                        <text class="th col-flow-amount">理论应收</text>
                                                        <text class="th col-flow-amount">实收</text>
							<text class="th col-flow-amount">抹零</text>
							<text class="th col-flow-amount">未收</text>
							<text class="th col-flow-status">状态</text>
						</view>

						<!-- 记录 -->
                                                <view v-for="item in flowRecords" :key="'f'+item._id" class="table-row">

                                                        <text class="td col-date">{{ item.record_date }}</text>

                                                        <text class="td col-flow-index">{{ formatNumber(item.period_start_reading) }}</text>
                                                        <text class="td col-flow-index">{{ formatNumber(item.period_end_reading) }}</text>

                                                        <text class="td col-flow-volume">{{ formatNumber(item.consumption_m3) }}</text>
                                                        <text class="td col-flow-volume">{{ formatNumber(item.theoretical_m3) }}</text>

                                                        <text class="td col-flow-amount">{{ item._display_unit_price != null ? item._display_unit_price.toFixed(2) : '-' }}</text>

                                                        <text class="td col-flow-amount">{{ item._display_should | money }}</text>
                                                        <text class="td col-flow-amount">{{ item._display_received | money }}</text>

                                                        <text class="td col-flow-amount">{{ item._display_write_off | money }}</text>

                                                        <text class="td col-flow-amount"
                                                                :class="item._display_unpaid > 0 ? 'text-danger' : 'text-normal'">
                                                                {{ item._display_unpaid | money }}
                                                        </text>

                                                        <text class="td col-flow-status">
                                                                {{ item.payment_status || '—' }}
                                                        </text>

                                                </view>
                                        </view>
                                </view>

			</view>

			<!-- 底部汇总注脚 -->
			<view v-if="!loading && records.length > 0" class="footer-note">
				<text class="footer-text">
					共 {{ records.length }} 条，应收 {{ stats.totalShould | money }} 元，
					实收 {{ stats.totalReceived | money }} 元，抹零 {{ stats.totalWriteOff | money }} 元，
					未收
					<text :class="stats.totalUnpaid > 0 ? 'text-danger' : 'text-normal'">
						{{ stats.totalUnpaid | money }}
					</text>
					元。
				</text>
			</view>

		</view>
	</view>
</template>

<script>
import BackToDashboardBar from '@/components/BackToDashboardBar.vue'
import {
  ensureLogin,
  getToken,
  getTokenMeta,
  getUserInfo,
  isTokenExpired,
  isAdminRole
} from '@/common/auth.js'

export default {
  components: {
    BackToDashboardBar
  },

  data() {
    return {
      loading: false,
      canLoad: true,
      customerId: '',
      customerName: '',
      dateFrom: '',
      dateTo: '',
      records: [],
      flowRecords: [],

      // 当前用户，用于权限判断
      userInfo: {},

      // 智能分配输入
      payAmountInput: '',
      writeOffInput: '',
      distributing: false,

      // 导出中
      exporting: false,

      // 是否存在 price_unit === 'm3' 的记录
      hasFlowRecords: false
    }
  },

  filters: {
    money(v) {
      const n = Number(v)
      if (isNaN(n)) return '0.00'
      return n.toFixed(2)
    }
  },

  computed: {
    stats() {
      let totalShould = 0
      let totalReceived = 0
      let totalUnpaid = 0
      let totalWriteOff = 0

      this.records.forEach(r => {
        const a = Number(r.amount) || 0
        const ar = Number(r.amount_received) || 0
        const w = Number(r.write_off || 0)
        totalShould += a
        totalReceived += ar
        totalWriteOff += w
        totalUnpaid += Math.max(a - ar - w, 0)
      })

      return {
        totalShould,
        totalReceived,
        totalUnpaid,
        totalWriteOff
      }
    },

    // 只有 role === 'user' 视为普通用户，其余当 admin（兼容老账号）
    isAdmin() {
      return isAdminRole(this.userInfo)
    },

  },

  onLoad(options) {
    // 读用户信息做权限判断
    this.userInfo = getUserInfo() || {}

    if (!ensureLogin()) return

    this.customerId = options.customer_id || ''
    this.customerName = decodeURIComponent(options.customer_name || '')
    this.dateFrom = options.date_from || ''
    this.dateTo = options.date_to || ''

    if ((!this.customerId && !this.customerName) || !this.dateFrom || !this.dateTo) {
      uni.showToast({
        title: '缺少客户或日期参数',
        icon: 'none'
      })
      this.canLoad = false
      return
    }

    this.loadDetail()
  },

  methods: {
    getValidToken() {
      const token = getToken()
      const meta = getTokenMeta()

      if (!token || isTokenExpired(meta)) {
        uni.showToast({
          title: '登录已过期，请重新登录',
          icon: 'none'
        })
        ensureLogin()
        return ''
      }

      return token
    },

    // ====== 工具：多瓶号解析 & 显示 ======
    getBottleList(item, type) {
      const trim = s => String(s || '').trim()
      let list = []

      if (type === 'out') {
        if (Array.isArray(item.out_items) && item.out_items.length) {
          list = item.out_items
            .map(r => trim(r.bottle_no))
            .filter(Boolean)
        } else if (item.bottle_no) {
          list = [trim(item.bottle_no)]
        }
      } else if (type === 'back') {
        if (Array.isArray(item.back_items) && item.back_items.length) {
          list = item.back_items
            .map(r => trim(r.bottle_no))
            .filter(Boolean)
        } else if (item.return_bottle_no) {
          list = [trim(item.return_bottle_no)]
        }
      } else if (type === 'deposit') {
        if (Array.isArray(item.deposit_items) && item.deposit_items.length) {
          list = item.deposit_items
            .map(r => trim(r.bottle_no))
            .filter(Boolean)
        } else if (item.deposit_bottles_raw) {
          list = item.deposit_bottles_raw
            .split(/[\/、,，\s]+/)
            .map(s => trim(s))
            .filter(Boolean)
        }
      }

      return list
    },

    displayOutBottles(item) {
      const nos = this.getBottleList(item, 'out')
      return nos.length ? nos.join(' / ') : '-'
    },

    displayBackBottles(item) {
      const nos = this.getBottleList(item, 'back')
      return nos.length ? nos.join(' / ') : '-'
    },

    displayDepositBottles(item) {
      const nos = this.getBottleList(item, 'deposit')
      return nos.length ? nos.join(' / ') : '-'
    },

    // 点击某个瓶号单元格（“/ …”）
    onBottleCellClick(item, type) {
      const nos = this.getBottleList(item, type)
      if (!nos.length) return

      if (nos.length === 1) {
        this.goBottleDetail(nos[0])
        return
      }

      uni.showActionSheet({
        itemList: nos,
        success: (res) => {
          const idx = res.tapIndex
          if (idx >= 0 && idx < nos.length) {
            this.goBottleDetail(nos[idx])
          }
        }
      })
    },

    // ====== 用 crm-vehicle.list 补全 car_no，兼容老数据 ======
    async enrichCarNoFromVehicle() {
      const idsSet = new Set()
      this.records.forEach(r => {
        if (!r.car_no && r.vehicle_id) {
          idsSet.add(r.vehicle_id)
        }
      })

      const ids = Array.from(idsSet)
      if (!ids.length) return

      try {
        const token = this.getValidToken()
        if (!token) return

        const res = await uniCloud.callFunction({
          name: 'crm-vehicle',
          data: {
            action: 'list',
            token
            // 如果后端支持按 ids 过滤，可以加上：
            // data: { ids }
          }
        })

        const result = res.result || {}
        if (result.code !== 0 || !Array.isArray(result.data)) {
          console.warn('crm-vehicle list failed: ', result)
          return
        }

        const vehicles = result.data || []
        const vehicleMap = {}
        vehicles.forEach(v => {
          if (!v || !v._id) return
          vehicleMap[v._id] = v.plate_no || v.car_no || ''
        })

        this.records = this.records.map(r => {
          if (!r.car_no && r.vehicle_id && vehicleMap[r.vehicle_id]) {
            return {
              ...r,
              car_no: vehicleMap[r.vehicle_id]
            }
          }
          return r
        })
      } catch (e) {
        console.error('enrichCarNoFromVehicle error', e)
      }
    },

    // 拉取明细数据
    async loadDetail() {
      if (!this.canLoad) return

      const token = this.getValidToken()
      if (!token) return

      this.loading = true
      try {
        const res = await uniCloud.callFunction({
          name: 'crm-bill',
          data: {
            action: 'customerDailyDetailByRange',
            token,
            data: {
              customer_id: this.customerId || '',
              customer_name: this.customerName || '',
              date_from: this.dateFrom,
              date_to: this.dateTo
            }
          }
        })

        const result = res.result || {}

        if (result.code !== 0) {
          uni.showToast({
            title: result.msg || '加载明细失败',
            icon: 'none'
          })
          return
        }

        const list = result.data || []
        this.records = list.map(doc => {
          const a = Number(doc.amount) || 0
          const ar = Number(doc.amount_received) || 0
          const w = Number(doc.write_off || 0)
          const unpaid = Math.max(a - ar - w, 0)
          return {
            ...doc,
            unpaid
          }
        })

        const flowIntervals = Array.isArray(result.flow_intervals) ? result.flow_intervals : []
        this.flowRecords = flowIntervals.map(item => {
          const unitPrice = item.unit_price != null ? Number(item.unit_price) : null
          const should = item.amount_should != null ? Number(item.amount_should) : 0
          const received = item.amount_received != null ? Number(item.amount_received) : 0
          const writeOff = Number(item.write_off || 0)
          const unpaid = item.unpaid != null ? Number(item.unpaid) : Math.max((should || 0) - (received || 0) - writeOff, 0)

          return {
            ...item,
            _display_unit_price: unitPrice,
            _display_should: should,
            _display_received: received,
            _display_write_off: writeOff,
            _display_unpaid: unpaid
          }
        })
        this.hasFlowRecords = this.flowRecords.length > 0

        await this.enrichCarNoFromVehicle()
      } catch (e) {
        console.error('loadDetail error', e)
        uni.showToast({
          title: '加载明细失败',
          icon: 'none'
        })
      } finally {
        this.loading = false
      }
    },

    formatNumber(v) {
      const n = Number(v)
      if (isNaN(n)) return '-'
      return n.toFixed(2)
    },

    // 智能分配按钮
    async onAutoDistribute() {
      // 权限守卫（双保险）
      if (!this.isAdmin) {
        uni.showToast({
          title: '当前账号无权进行智能分配',
          icon: 'none'
        })
        return
      }

      if (!this.records.length) {
        uni.showToast({
          title: '没有可分配的记录',
          icon: 'none'
        })
        return
      }

      const pay = Number(this.payAmountInput || 0)
      const writeOff = Number(this.writeOffInput || 0)

      if (isNaN(pay) || pay < 0) {
        uni.showToast({
          title: '请输入正确的收款金额',
          icon: 'none'
        })
        return
      }
      if (isNaN(writeOff) || writeOff < 0) {
        uni.showToast({
          title: '抹零不能为负数',
          icon: 'none'
        })
        return
      }
      if (pay === 0 && writeOff === 0) {
        uni.showToast({
          title: '金额和抹零不能都为 0',
          icon: 'none'
        })
        return
      }

      const ids = this.records.map(r => r._id).filter(Boolean)
      if (!ids.length) {
        uni.showToast({
          title: '记录缺少 ID，无法分配',
          icon: 'none'
        })
        return
      }

      const token = this.getValidToken()
      if (!token) return

      this.distributing = true
      try {
        const res = await uniCloud.callFunction({
          name: 'crm-bill',
          data: {
            action: 'autoDistributePayment',
            token,
            data: {
              record_ids: ids,
              pay_amount: pay,
              write_off_amount: writeOff
            }
          }
        })

        const result = res.result || {}
        if (result.code !== 0) {
          uni.showToast({
            title: result.msg || '分配失败',
            icon: 'none'
          })
          return
        }

        uni.showToast({
          title: '分配完成',
          icon: 'success'
        })

        this.payAmountInput = ''
        this.writeOffInput = ''
        this.loadDetail()
      } catch (e) {
        console.error('autoDistributePayment error', e)
        uni.showToast({
          title: '分配失败，请稍后重试',
          icon: 'none'
        })
      } finally {
        this.distributing = false
      }
    },

    // 导出 Excel
    async onExport() {
      if (!this.records.length) {
        uni.showToast({
          title: '没有可导出的数据',
          icon: 'none'
        })
        return
      }

      const token = this.getValidToken()
      if (!token) return

      this.exporting = true
      try {
        const res = await uniCloud.callFunction({
          name: 'crm-bill',
          data: {
            action: 'exportCustomerDailyDetailExcel',
            token,
            data: {
              customer_id: this.customerId || '',
              customer_name: this.customerName || '',
              date_from: this.dateFrom,
              date_to: this.dateTo
            }
          }
        })

        const result = res.result || {}
        if (result.code !== 0 || !result.url) {
          uni.showToast({
            title: result.msg || '导出失败',
            icon: 'none'
          })
          return
        }

        const url = result.url

        uni.downloadFile({
          url,
          success: (res2) => {
            if (res2.statusCode === 200) {
              if (uni.openDocument) {
                uni.openDocument({
                  filePath: res2.tempFilePath,
                  success: () => {}
                })
              } else {
                uni.showToast({
                  title: '已下载，可在本机查看',
                  icon: 'none'
                })
              }
            } else {
              uni.showToast({
                title: '下载失败',
                icon: 'none'
              })
            }
          },
          fail: () => {
            uni.showToast({
              title: '下载失败',
              icon: 'none'
            })
          }
        })
      } catch (e) {
        console.error('exportCustomerDailyDetailExcel error', e)
        uni.showToast({
          title: '导出失败',
          icon: 'none'
        })
      } finally {
        this.exporting = false
      }
    },

    goBottleDetail(number) {
      const no = (number || '').trim()
      if (!no) return
      uni.navigateTo({
        url: `/pages/bottle/detail?number=${encodeURIComponent(no)}`
      })
    },

    // 跳转销售详情
    goSaleDetail(row) {
      const id = row._id || row.sale_id
      if (!id) {
        return uni.showToast({
          title: '缺少销售记录ID',
          icon: 'none'
        })
      }
      uni.navigateTo({
        url: `/pages/sale/detail?id=${id}`
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
		width: 85%;
		max-width: 100%;
		margin: 0 auto;
	}

	/* 顶部标题区 */
	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20rpx;
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
		font-size: 30rpx;
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
	}

	/* 卡片通用 */
	.card {
		background-color: #ffffff;
		border-radius: 20rpx;
		padding: 22rpx 24rpx;
		margin-bottom: 20rpx;
		box-shadow: 0 8rpx 22rpx rgba(15, 35, 52, 0.04);
		box-sizing: border-box;
		width: auto;
		max-width: 100%;
	}

	.card-table {
		padding-bottom: 18rpx;
	}

	.card-header {
		margin-bottom: 10rpx;
	}

	.card-title {
		font-size: 28rpx;
		font-weight: 600;
		color: #222;
	}

	.card-sub {
		margin-top: 2rpx;
		font-size: 22rpx;
		color: #9aa0ae;
	}

	/* 汇总卡片 */
	.card-summary {
		margin-bottom: 18rpx;
	}

	.summary-row {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		row-gap: 12rpx;
	}

	.summary-item {
		width: 48%;
		margin-bottom: 4rpx;
	}

	.summary-label {
		font-size: 24rpx;
		color: #6b7280;
	}

	.summary-value-row {
		display: flex;
		align-items: baseline;
		margin-top: 4rpx;
	}

	.summary-value {
		font-size: 32rpx;
		font-weight: 700;
		color: #111827;
	}

	.summary-unit {
		font-size: 22rpx;
		color: #9ca3af;
		margin-left: 4rpx;
	}

	/* 智能分配表单 */
	.auto-card {
		margin-bottom: 12rpx;
		padding: 16rpx 14rpx 12rpx;
		border-radius: 18rpx;
		background: #f9fafb;
		border-width: 1rpx;
		border-style: solid;
		border-color: #e5e7eb;
	}

	.auto-row {
		display: flex;
		flex-wrap: wrap;
		column-gap: 16rpx;
		row-gap: 10rpx;
	}

	.auto-field {
		flex: 1;
		min-width: 40%;
	}

	.auto-label {
		font-size: 24rpx;
		color: #6b7280;
		margin-bottom: 4rpx;
		display: block;
	}

	.auto-input-wrapper {
		height: 70rpx;
		border-radius: 16rpx;
		padding: 0 18rpx;
		border-width: 1rpx;
		border-style: solid;
		border-color: #d1d5db;
		background: #ffffff;
		display: flex;
		align-items: center;
		box-shadow: 0 6rpx 18rpx rgba(15, 23, 42, 0.04);
	}

	.auto-input {
		flex: 1;
		font-size: 26rpx;
		border: none;
		background-color: transparent;
		color: #111827;
	}

	.auto-row-bottom {
		margin-top: 12rpx;
		justify-content: flex-end;
		column-gap: 16rpx;
	}

	/* 表格 */
	.table-wrapper {
		margin-top: 8rpx;
	}

	.table-header {
		display: flex;
		align-items: center;
		padding: 10rpx 6rpx;
		border-bottom-width: 1rpx;
		border-bottom-style: solid;
		border-bottom-color: #e5e7eb;
		width: 100%;
	}

	.table-row {
		display: flex;
		align-items: center;
		padding: 12rpx 6rpx;
		border-radius: 10rpx;
		width: 100%;
	}

	.table-row:nth-child(odd) {
		background: #f9fafb;
	}

	.row-unpaid {
		border-left-width: 6rpx;
		border-left-style: solid;
		border-left-color: #f97316;
	}

	.row-partial {
		background: #fff7ed;
	}

	.th,
	.td {
		font-size: 22rpx;
		color: #111827;
		padding: 0 6rpx;
		box-sizing: border-box;
		display: flex;
		justify-content: center;
		align-items: center;
		text-align: center;
		white-space: nowrap;
		overflow: visible;
		text-overflow: clip;
	}

	.th+.th,
	.td+.td {
		border-left-width: 1rpx;
		border-left-style: solid;
		border-left-color: #e5e7eb;
	}

	.col-date {
		flex: 1.1;
	}

	.col-bottle,
	.col-deposit,
	.col-weight,
	.col-price,
	.col-amount,
	.col-car,
	.col-status {
		flex: 1;
	}

	.col-delivery {
		flex: 1.6;
	}

	.col-op {
		flex: 0.8;
	}

	.td-link {
		color: #2563eb;
	}

	.td-link:active {
		opacity: 0.7;
	}

	.footer-note {
		margin-top: 14rpx;
		padding-top: 10rpx;
		border-top-width: 1rpx;
		border-top-style: solid;
		border-top-color: #e5e7eb;
	}

	.footer-text {
		font-size: 22rpx;
		color: #6b7280;
	}

	.list-loading,
	.empty {
		padding: 24rpx 6rpx;
		text-align: center;
	}

	.loading-text {
		font-size: 24rpx;
		color: #6b7280;
	}

	.empty-main {
		font-size: 26rpx;
		color: #4b5563;
	}

	.empty-sub {
		margin-top: 4rpx;
		font-size: 22rpx;
		color: #9ca3af;
	}

	.btn-soft {
		min-width: 140rpx;
		padding: 12rpx 22rpx;
		border-radius: 999rpx;
		font-size: 24rpx;
		background: rgba(244, 247, 255, 0.9);
		color: #4d5cff;
		border: 1rpx solid rgba(212, 220, 255, 0.9);
	}

	.btn-soft::after {
		border: none;
	}

	.btn-export {
		min-width: 180rpx;
	}

	.btn-primary {
		min-width: 220rpx;
		padding: 14rpx 26rpx;
		border-radius: 999rpx;
		font-size: 26rpx;
		background: linear-gradient(135deg, #2979ff, #1a98ff);
		color: #ffffff;
		box-shadow: 0 14rpx 30rpx rgba(26, 120, 255, 0.32);
		border: none;
	}

	.btn-primary::after {
		border: none;
	}

	.text-danger {
		color: #dc2626;
	}

	.text-normal {
		color: #111827;
	}

	.tag-flow {
		margin-left: 6rpx;
		font-size: 22rpx;
		color: #10b981;
	}

	.card-flow {
		margin-top: 12rpx;
	}

	.col-flow-index,
	.col-flow-volume,
	.col-flow-amount,
	.col-flow-status {
		flex: 1;
	}
</style>