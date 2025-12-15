<template>
	<view class="page">
		<view class="inner">
			<BackToDashboardBar back-to="/pages/dashboard/index" text="返回工作台" />

			<!-- 顶部标题 -->
			<view class="page-header">
				<view class="page-header-left">
					<view class="page-icon">
						<text class="page-icon-text">气</text>
					</view>
					<view class="page-header-text">
						<text class="page-title">天然气入库台账</text>
						<text class="page-sub">
							记录每车罐装天然气的入库净重、亏损和金额
						</text>
					</view>
				</view>

				<view class="page-header-right">
					<!-- 导出按钮：只有管理员 -->
					<button class="btn-soft btn-export" v-if="isAdmin" @click="handleExport" :disabled="exporting">
						{{ exporting ? '导出中…' : '导出 CSV / Excel' }}
					</button>
					<!-- 新增按钮：只有管理员 -->
					<button class="btn-primary btn-add" v-if="isAdmin" @click="openEdit(null)">
						+ 新增入库记录
					</button>
				</view>
			</view>

			<!-- 查询 & 筛选 -->
			<view class="card card-filter">
				<view class="filter-row">
					<view class="filter-item date-from">
						<text class="label">开始日期</text>
						<picker mode="date" :value="filters.date_from" @change="onDateFromChange">
							<view class="input-wrapper">
								<view class="picker">
									<text>{{ filters.date_from || '选择开始日期' }}</text>
								</view>
							</view>
						</picker>
					</view>

					<view class="filter-item date-to">
						<text class="label">结束日期</text>
						<picker mode="date" :value="filters.date_to" @change="onDateToChange">
							<view class="input-wrapper">
								<view class="picker">
									<text>{{ filters.date_to || '选择结束日期' }}</text>
								</view>
							</view>
						</picker>
					</view>

					<view class="filter-item keyword">
						<text class="label">关键词</text>
						<view class="input-wrapper">
							<input
								class="input"
								v-model="filters.keyword"
								placeholder="按车牌 / 罐车号 / 液厂搜索"
								confirm-type="search"
								@confirm="loadList"
							/>
						</view>
					</view>

					<view class="filter-item btns">
						<button class="btn-soft" @click="resetFilter">重置</button>
						<button class="btn-primary btn-query" @click="loadList">
							查询
						</button>
					</view>
				</view>
			</view>

			<!-- 汇总 -->
			<view class="card card-summary" v-if="list.length">
				<view class="summary-row">
					<view class="summary-item">
						<text class="summary-label">净重合计</text>
						<view class="summary-value-row">
							<text class="summary-value">{{ format2(stats.totalNet) }}</text>
							<text class="summary-unit">吨</text>
						</view>
					</view>

					<view class="summary-item">
						<text class="summary-label">亏损合计</text>
						<view class="summary-value-row">
							<text class="summary-value">{{ format2(stats.totalLoss) }}</text>
							<text class="summary-unit">吨</text>
						</view>
					</view>

					<view class="summary-item">
						<text class="summary-label">金额合计</text>
						<view class="summary-value-row">
							<text class="summary-value">{{ format2(stats.totalAmount) }}</text>
							<text class="summary-unit">元</text>
						</view>
					</view>

					<view class="summary-item">
						<text class="summary-label">记录条数</text>
						<view class="summary-value-row">
							<text class="summary-value">{{ list.length }}</text>
							<text class="summary-unit">条</text>
						</view>
					</view>
				</view>
			</view>

			<!-- 列表 -->
			<view class="card">
				<view class="card-header">
					<text class="card-title">入库记录</text>
					<text class="card-sub">
						按日期倒序展示，可编辑或删除单条记录
					</text>
				</view>

				<view class="card-body">
					<view v-if="loading" class="list-empty">
						<text class="empty-text">加载中…</text>
					</view>

					<view v-else-if="!list.length" class="list-empty">
						<text class="empty-text">
							当前条件下暂无入库记录，可以先点击右上角「新增入库记录」
						</text>
					</view>

					<view v-else class="table">
						<!-- 表头 -->
						<view class="table-header">
							<text class="th col-date">日期</text>
							<text class="th col-text">品名</text>
							<text class="th col-num">装车</text>
							<text class="th col-num">毛重</text>
							<text class="th col-num">皮重</text>
							<text class="th col-num">净重</text>
							<text class="th col-num">亏损</text>
							<text class="th col-num">单价</text>
							<text class="th col-num">金额</text>
							<text class="th col-text">车牌</text>
							<text class="th col-text">罐车号</text>
							<text class="th col-text">送货人员</text>
							<text class="th col-text">液厂</text>
							<text class="th col-op">操作</text>
						</view>

						<!-- 行 -->
						<view v-for="item in list" :key="item._id" class="table-row">
							<text class="td col-date">{{ item.date || '-' }}</text>
							<text class="td col-text">{{ item.product_name || 'LNG' }}</text>

							<text class="td col-num">{{ format2(item.load_weight) }}</text>
							<text class="td col-num">{{ format2(item.gross_weight) }}</text>
							<text class="td col-num">{{ format2(item.tare_weight) }}</text>
							<text class="td col-num">{{ format2(item.net_weight) }}</text>
							<text class="td col-num">{{ format2(item.loss_amount) }}</text>
							<text class="td col-num">{{ format2(item.unit_price) }}</text>
							<text class="td col-num">{{ format2(item.amount) }}</text>

							<text class="td col-text">{{ item.plate_no || '-' }}</text>
							<text class="td col-text">{{ item.tanker_no || '-' }}</text>
							<text class="td col-text">{{ item.sender || '-' }}</text>
							<text class="td col-text">{{ item.factory || '-' }}</text>

							<view class="td col-op">
								<!-- 管理员可以编辑删除 -->
								<block v-if="isAdmin">
									<text class="op-link" @click="openEdit(item)">编辑</text>
									<text class="op-link danger" @click="confirmRemove(item)">删除</text>
								</block>
								<!-- 非管理员只读 -->
								<text v-else class="op-link-disabled">-</text>
							</view>
						</view>
					</view>
				</view>
			</view>

			<!-- 编辑弹层 -->
			<view v-if="showEdit" class="edit-mask">
				<view class="edit-dialog">
					<view class="edit-header">
						<text class="edit-title">
							{{ form._id ? '编辑入库记录' : '新增入库记录' }}
						</text>
					</view>

					<view class="edit-body">
						<!-- 日期 + 品名 -->
						<view class="form-row">
							<view class="form-item half">
								<text class="label">* 日期</text>
								<picker mode="date" :value="form.date" @change="onFormDateChange">
									<view class="input-wrapper">
										<view class="picker">
											<text>{{ form.date || '请选择日期' }}</text>
										</view>
									</view>
								</picker>
							</view>

							<view class="form-item half">
								<text class="label">品名</text>
								<view class="input-wrapper">
									<input class="input" v-model="form.product_name" placeholder="例如：LNG" />
								</view>
							</view>
						</view>

						<!-- 装车 / 毛重 / 皮重 -->
						<view class="form-row">
							<view class="form-item third">
								<text class="label">装车重量</text>
								<view class="input-wrapper">
									<input
										class="input"
										v-model="form.load_weight"
										type="digit"
										placeholder="吨"
										@blur="autoCalcNet"
									/>
								</view>
							</view>

							<view class="form-item third">
								<text class="label">毛重</text>
								<view class="input-wrapper">
									<input
										class="input"
										v-model="form.gross_weight"
										type="digit"
										placeholder="吨"
										@blur="autoCalcNet"
									/>
								</view>
							</view>

							<view class="form-item third">
								<text class="label">皮重</text>
								<view class="input-wrapper">
									<input
										class="input"
										v-model="form.tare_weight"
										type="digit"
										placeholder="吨"
										@blur="autoCalcNet"
									/>
								</view>
							</view>
						</view>

<<<<<<< HEAD
						<!-- 净重 / 亏损 -->
						<view class="form-row">
							<view class="form-item half">
								<text class="label">净重（可自动计算）</text>
=======
                                                <!-- 净重 / 亏损 -->
                                                <view class="form-row">
                                                        <view class="form-item half">
                                                                <text class="label">净重（可自动计算）</text>
>>>>>>> 25fda4a (init project)
								<view class="input-wrapper">
									<input
										class="input"
										v-model="form.net_weight"
										type="digit"
										placeholder="毛重 - 皮重"
									/>
								</view>
<<<<<<< HEAD
							</view>

							<view class="form-item half">
								<text class="label">亏损数量</text>
								<view class="input-wrapper">
									<input
										class="input"
										v-model="form.loss_amount"
										type="digit"
										placeholder="吨，可为 0"
									/>
								</view>
							</view>
						</view>
=======
                                                        </view>

                                                        <view class="form-item half">
                                                                <text class="label">亏损数量（自动=装车-净重）</text>
                                                                <view class="input-wrapper readonly-input">
                                                                        <input
                                                                                class="input"
                                                                                :value="form.loss_amount"
                                                                                disabled
                                                                                placeholder="自动计算"
                                                                        />
                                                                </view>
                                                        </view>
                                                </view>
>>>>>>> 25fda4a (init project)

						<!-- 单价 / 金额 -->
						<view class="form-row">
							<view class="form-item half">
								<text class="label">单价</text>
								<view class="input-wrapper">
									<input
										class="input"
										v-model="form.unit_price"
										type="digit"
										placeholder="元/吨"
										@blur="autoCalcAmount"
									/>
								</view>
							</view>

							<view class="form-item half">
								<text class="label">金额</text>
								<view class="input-wrapper">
									<input
										class="input"
										v-model="form.amount"
										type="digit"
										placeholder="可自动=净重×单价"
									/>
								</view>
							</view>
						</view>

						<!-- 车牌 / 罐车号 -->
						<view class="form-row">
							<view class="form-item half">
								<text class="label">车牌</text>
								<view class="input-wrapper">
									<input class="input" v-model="form.plate_no" placeholder="例如 冀A12345" />
								</view>
							</view>

							<view class="form-item half">
								<text class="label">罐车号</text>
								<view class="input-wrapper">
									<input class="input" v-model="form.tanker_no" placeholder="液罐车编号" />
								</view>
							</view>
						</view>

						<!-- 送货人员 / 液厂 -->
						<view class="form-row">
							<view class="form-item half">
								<text class="label">送货人员</text>
								<view class="input-wrapper">
									<input class="input" v-model="form.sender" placeholder="司机或送货人" />
								</view>
							</view>

							<view class="form-item half">
								<text class="label">液厂</text>
								<view class="input-wrapper">
									<input class="input" v-model="form.factory" placeholder="例如：XX 液厂" />
								</view>
							</view>
						</view>

						<!-- 备注 -->
						<view class="form-item">
							<text class="label">备注</text>
							<textarea
								class="textarea"
								v-model="form.remark"
								placeholder="可记录票号、上下游结算说明等"
							/>
						</view>
					</view>

					<view class="edit-footer">
						<button class="btn-soft" @click="closeEdit" :disabled="saving">
							取消
						</button>
						<button class="btn-primary" @click="submitEdit" :disabled="saving">
							{{ saving ? '保存中…' : '保存' }}
						</button>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
import BackToDashboardBar from '@/components/BackToDashboardBar.vue'
import { callApi } from '@/common/api.js'
import { ensureLogin, getUserInfo, isAdminRole } from '@/common/auth.js'

export default {
  components: {
    BackToDashboardBar
  },
  data() {
    return {
      loading: false,
      exporting: false,
      list: [],
      filters: {
        date_from: '',
        date_to: '',
        keyword: ''
      },

      showEdit: false,
      saving: false,
      form: {
        _id: '',
        date: '',
        product_name: 'LNG',
        load_weight: '',
        gross_weight: '',
        tare_weight: '',
        net_weight: '',
        loss_amount: '',
        unit_price: '',
        amount: '',
        plate_no: '',
        tanker_no: '',
        sender: '',
        factory: '',
        remark: ''
      },

      // 当前登录用户信息（用于权限）
      userInfo: {}
    }
  },

  computed: {
    stats() {
      let totalNet = 0
      let totalLoss = 0
      let totalAmount = 0
      this.list.forEach(row => {
        totalNet += Number(row.net_weight) || 0
<<<<<<< HEAD
        totalLoss += Number(row.loss_amount) || 0
=======
        const loss =
          row.loss_amount != null
            ? Number(row.loss_amount) || 0
            : Number(row.load_weight || 0) - Number(row.net_weight || 0)
        totalLoss += loss
>>>>>>> 25fda4a (init project)
        totalAmount += Number(row.amount) || 0
      })
      return {
        totalNet,
        totalLoss,
        totalAmount
      }
    },

    // 是否为管理员：admin / superadmin 都具备
    isAdmin() {
      return isAdminRole(this.userInfo)
    }
  },

<<<<<<< HEAD
=======
  watch: {
    'form.load_weight'() {
      this.autoCalcLoss()
    },
    'form.net_weight'() {
      this.autoCalcLoss()
    }
  },

>>>>>>> 25fda4a (init project)
  onLoad() {
    // 登录校验（和其它页面对齐）
    if (!ensureLogin()) return

    // 先读取当前登录用户
    this.userInfo = getUserInfo() || {}

    // 默认填充最近 7 天
    const today = new Date()
    const end = this.formatDate(today)
    const startDate = new Date(today.getTime() - 6 * 24 * 3600 * 1000)
    const start = this.formatDate(startDate)
    this.filters.date_from = start
    this.filters.date_to = end

    this.loadList()
  },

  onShow() {
    // 从后台回来再校验一次 token
    ensureLogin()
  },

  methods: {
    // 统一两位小数
    format2(v) {
      const n = Number(v)
      if (Number.isNaN(n)) return '0.00'
      return n.toFixed(2)
    },

    formatDate(d) {
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    },

    onDateFromChange(e) {
      this.filters.date_from = e.detail.value
    },
    onDateToChange(e) {
      this.filters.date_to = e.detail.value
    },

    resetFilter() {
      this.filters.keyword = ''
      const today = new Date()
      const end = this.formatDate(today)
      const startDate = new Date(today.getTime() - 6 * 24 * 3600 * 1000)
      const start = this.formatDate(startDate)
      this.filters.date_from = start
      this.filters.date_to = end
      this.loadList()
    },

    async loadList() {
      this.loading = true
      try {
        const res = await callApi('crm-gas-in', 'list', {
          date_from: this.filters.date_from || undefined,
          date_to: this.filters.date_to || undefined,
          keyword: this.filters.keyword || undefined
        })

        if (res.code !== 0) {
          uni.showToast({
            title: res.msg || '加载失败',
            icon: 'none'
          })
          this.list = []
          return
        }

        // 转成吨再给前端展示（后端存 kg）
        const kg2ton = v => Number(v || 0) / 1000
        const rawList = res.data || res.list || []

<<<<<<< HEAD
        this.list = rawList.map(row => ({
          ...row,
          load_weight: kg2ton(row.load_weight),
          gross_weight: kg2ton(row.gross_weight),
          tare_weight: kg2ton(row.tare_weight),
          net_weight: kg2ton(row.net_weight),
          loss_amount: kg2ton(row.loss_amount)
          // unit_price / amount 保持原样，单位本来就是 元/吨、元
        }))
=======
        this.list = rawList.map(row => {
          const loadTon = kg2ton(row.load_weight)
          const netTon = kg2ton(row.net_weight)
          const lossTon =
            row.loss_amount != null ? kg2ton(row.loss_amount) : Number((loadTon - netTon).toFixed(3))

          return {
            ...row,
            load_weight: loadTon,
            gross_weight: kg2ton(row.gross_weight),
            tare_weight: kg2ton(row.tare_weight),
            net_weight: netTon,
            loss_amount: lossTon,
            // unit_price / amount 保持原样，单位本来就是 元/吨、元
          }
        })
>>>>>>> 25fda4a (init project)
      } catch (e) {
        console.error('loadList error', e)
        uni.showToast({
          title: '加载异常',
          icon: 'none'
        })
        this.list = []
      } finally {
        this.loading = false
      }
    },

    // ===== 导出 CSV / Excel =====
    handleExport() {
      if (this.exporting) return

      // 权限校验：只有管理员可以导出
      if (!this.isAdmin) {
        return uni.showToast({
          title: '当前账号无权限导出台账',
          icon: 'none'
        })
      }

      if (!this.list.length) {
        uni.showToast({
          title: '当前没有可导出的数据',
          icon: 'none'
        })
        return
      }

      this.exporting = true

      try {
        // 表头
        const header = [
          '日期',
          '品名',
          '装车重量(吨)',
          '毛重(吨)',
          '皮重(吨)',
          '净重(吨)',
          '亏损(吨)',
          '单价(元/吨)',
          '金额(元)',
          '车牌',
          '罐车号',
          '送货人员',
          '液厂',
          '备注'
        ]

        const rows = this.list.map(item => [
          item.date || '',
          item.product_name || 'LNG',
          this.format2(item.load_weight),
          this.format2(item.gross_weight),
          this.format2(item.tare_weight),
          this.format2(item.net_weight),
          this.format2(item.loss_amount),
          this.format2(item.unit_price),
          this.format2(item.amount),
          item.plate_no || '',
          item.tanker_no || '',
          item.sender || '',
          item.factory || '',
          (item.remark || '').replace(/\n/g, ' ')
        ])

        const all = [header, ...rows]

        // 简单 CSV 转义
        const csvLines = all.map(cols =>
          cols
            .map(col => {
              const v = String(col).replace(/"/g, '""')
              return `"${v}"`
            })
            .join(',')
        )

        // 加 BOM 防止 Excel 乱码
        const csvContent = '\ufeff' + csvLines.join('\n')

        // H5 端：下载 CSV 文件
        // #ifdef H5
        const blob = new Blob([csvContent], {
          type: 'text/csv;charset=utf-8;'
        })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        const from = this.filters.date_from || ''
        const to = this.filters.date_to || ''
        link.href = url
        link.download = `天然气入库台账_${from}_${to}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        uni.showToast({
          title: '已导出 CSV',
          icon: 'success'
        })
        // #endif

        // 非 H5 端：复制 CSV 内容，方便在电脑粘贴到 Excel
        // #ifndef H5
        uni.setClipboardData({
          data: csvContent,
          success: () => {
            uni.showToast({
              title: '已复制 CSV，可在电脑粘贴到 Excel',
              icon: 'none'
            })
          },
          fail: () => {
            uni.showToast({
              title: '导出失败',
              icon: 'none'
            })
          }
        })
        // #endif
      } catch (e) {
        console.error(e)
        uni.showToast({
          title: '导出失败',
          icon: 'none'
        })
      } finally {
        this.exporting = false
      }
    },

    // ===== 编辑弹层 =====
    openEdit(item) {
      // 权限：非管理员不能新增/编辑
      if (!this.isAdmin) {
        return uni.showToast({
          title: '当前账号无权限新增/编辑入库记录',
          icon: 'none'
        })
      }

      if (item) {
        this.form = {
          _id: item._id,
          date: item.date || '',
          product_name: item.product_name || 'LNG',
          load_weight: item.load_weight != null ? String(item.load_weight) : '',
          gross_weight: item.gross_weight != null ? String(item.gross_weight) : '',
          tare_weight: item.tare_weight != null ? String(item.tare_weight) : '',
          net_weight: item.net_weight != null ? String(item.net_weight) : '',
          loss_amount: item.loss_amount != null ? String(item.loss_amount) : '',
          unit_price: item.unit_price != null ? String(item.unit_price) : '',
          amount: item.amount != null ? String(item.amount) : '',
          plate_no: item.plate_no || '',
          tanker_no: item.tanker_no || '',
          sender: item.sender || '',
          factory: item.factory || '',
          remark: item.remark || ''
        }
      } else {
        this.form = {
          _id: '',
          date: this.filters.date_to || this.formatDate(new Date()),
          product_name: 'LNG',
          load_weight: '',
          gross_weight: '',
          tare_weight: '',
          net_weight: '',
          loss_amount: '',
          unit_price: '',
          amount: '',
          plate_no: '',
          tanker_no: '',
          sender: '',
          factory: '',
          remark: ''
        }
      }
<<<<<<< HEAD
=======
      this.autoCalcLoss()
>>>>>>> 25fda4a (init project)
      this.showEdit = true
    },

    closeEdit() {
      if (this.saving) return
      this.showEdit = false
    },

    onFormDateChange(e) {
      this.form.date = e.detail.value
    },

    autoCalcNet() {
      const gross = Number(this.form.gross_weight) || 0
      const tare = Number(this.form.tare_weight) || 0
      if (gross && tare) {
        const net = gross - tare
        this.form.net_weight = net ? net.toFixed(2) : ''
<<<<<<< HEAD
=======
        this.autoCalcLoss()
>>>>>>> 25fda4a (init project)
        this.autoCalcAmount()
      }
    },

<<<<<<< HEAD
=======
    autoCalcLoss() {
      const load = Number(this.form.load_weight)
      const net = Number(this.form.net_weight)
      if (!Number.isFinite(load) || !Number.isFinite(net) || !load || net < 0) {
        this.form.loss_amount = ''
        return
      }
      const loss = load - net
      this.form.loss_amount = Number.isFinite(loss) ? loss.toFixed(3) : ''
    },

>>>>>>> 25fda4a (init project)
    autoCalcAmount() {
      const net = Number(this.form.net_weight) || 0
      const price = Number(this.form.unit_price) || 0
      if (net && price) {
        const amt = net * price
        this.form.amount = amt.toFixed(2)
      }
    },

    normalizeTonNumber(value, label, { required = false } = {}) {
      const str = value != null ? String(value).trim() : ''
      if (!str) {
        if (required) {
          uni.showToast({ title: `请填写${label}`, icon: 'none' })
          return false
        }
        return null
      }

      const n = Number(str)
      if (!Number.isFinite(n) || n < 0) {
        uni.showToast({ title: `${label}需为非负数字`, icon: 'none' })
        return false
      }
      return Number(n.toFixed(3))
    },

    normalizePrice(value, label, { required = false } = {}) {
      const str = value != null ? String(value).trim() : ''
      if (!str) {
        if (required) {
          uni.showToast({ title: `请填写${label}`, icon: 'none' })
          return false
        }
        return null
      }
      const n = Number(str)
      if (!Number.isFinite(n) || n < 0) {
        uni.showToast({ title: `${label}需为非负数字`, icon: 'none' })
        return false
      }
      return Number(n.toFixed(2))
    },

    async submitEdit() {
      if (this.saving) return

      // 权限：双保险
      if (!this.isAdmin) {
        return uni.showToast({
          title: '当前账号无权限保存入库记录',
          icon: 'none'
        })
      }

      if (!this.form.date) {
        return uni.showToast({
          title: '请选择日期',
          icon: 'none'
        })
      }

      const loadWeight = this.normalizeTonNumber(this.form.load_weight, '装车重量')
      if (loadWeight === false) return

      const gross = this.normalizeTonNumber(this.form.gross_weight, '毛重', { required: true })
      if (gross === false) return
      const tare = this.normalizeTonNumber(this.form.tare_weight, '皮重', { required: true })
      if (tare === false) return

      let net = this.normalizeTonNumber(this.form.net_weight, '净重')
      if (net === false) return
      if (net === null && gross != null && tare != null) {
        net = Number((gross - tare).toFixed(3))
      }
      if (net != null && gross != null && tare != null && net < 0) {
        return uni.showToast({ title: '净重不能为负，请检查毛重/皮重', icon: 'none' })
      }

<<<<<<< HEAD
      const lossAmount = this.normalizeTonNumber(this.form.loss_amount, '亏损')
      if (lossAmount === false) return

=======
>>>>>>> 25fda4a (init project)
      const unitPrice = this.normalizePrice(this.form.unit_price, '单价', { required: true })
      if (unitPrice === false) return

      let amount = this.normalizePrice(this.form.amount, '金额')
      if (amount === false) return
      if (amount === null && net != null) {
        amount = Number((net * unitPrice).toFixed(2))
      }

<<<<<<< HEAD
=======
      const lossAmount =
        loadWeight != null && net != null ? Number((loadWeight - net).toFixed(3)) : null

>>>>>>> 25fda4a (init project)
      const ton2kg = v => (v == null ? 0 : Math.round(v * 1000))

      const payload = {
        date: this.form.date,
        product_name: this.form.product_name || 'LNG',
        load_weight: ton2kg(loadWeight),
        gross_weight: ton2kg(gross),
        tare_weight: ton2kg(tare),
        net_weight: ton2kg(net),
        loss_amount: ton2kg(lossAmount),
        unit_price: unitPrice,
        amount: amount == null ? 0 : amount,
        plate_no: (this.form.plate_no || '').trim(),
        tanker_no: (this.form.tanker_no || '').trim(),
        sender: (this.form.sender || '').trim(),
        factory: (this.form.factory || '').trim(),
        remark: (this.form.remark || '').trim()
      }

      const action = this.form._id ? 'update' : 'create'
      if (this.form._id) {
        payload.id = this.form._id
      }

      this.saving = true
      const res = await callApi('crm-gas-in', action, payload, {
        showLoading: true,
        loadingText: '保存中…'
      })
      this.saving = false

      if (res.code !== 0) {
        uni.showToast({
          title: res.msg || '保存失败',
          icon: 'none'
        })
        return
      }

      uni.showToast({
        title: '保存成功',
        icon: 'success'
      })

      this.showEdit = false
      this.loadList()
    },

    confirmRemove(item) {
      // 权限：删除前也拦一下
      if (!this.isAdmin) {
        return uni.showToast({
          title: '当前账号无权限删除入库记录',
          icon: 'none'
        })
      }

      uni.showModal({
        title: '删除确认',
        content: `确定要删除 ${item.date || ''} 的入库记录吗？`,
        confirmColor: '#e11d48',
        success: async res => {
          if (!res.confirm) return
          const r = await callApi(
            'crm-gas-in',
            'remove',
            {
              id: item._id
            },
            {
              showLoading: true,
              loadingText: '删除中…'
            }
          )
          if (r.code !== 0) {
            uni.showToast({
              title: r.msg || '删除失败',
              icon: 'none'
            })
            return
          }
          uni.showToast({
            title: '已删除',
            icon: 'success'
          })
          this.loadList()
        }
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
	}

	/* 卡片 */
	.card {
		background-color: #ffffff;
		border-radius: 20rpx;
		padding: 22rpx 24rpx;
		margin-bottom: 20rpx;
		box-shadow: 0 8rpx 22rpx rgba(15, 35, 52, 0.04);
		box-sizing: border-box;
	}

	/* 筛选 */
	.card-filter {
		padding-bottom: 18rpx;
	}

	.filter-row {
		display: flex;
		flex-wrap: wrap;
		margin: 0 -8rpx;
	}

	.filter-item {
		padding: 0 8rpx;
		margin-bottom: 12rpx;
	}

	.filter-item.date-from,
	.filter-item.date-to {
		width: 220rpx;
	}

	.filter-item.keyword {
		flex: 1;
		min-width: 40%;
	}

	.filter-item.btns {
		display: flex;
		align-items: flex-end;
		justify-content: flex-end;
		column-gap: 10rpx;
	}

	.label {
		display: block;
		font-size: 24rpx;
		color: #555;
		margin-bottom: 6rpx;
	}

	.input-wrapper {
		width: 100%;
		height: 80rpx;
		background: #ffffff;
		border-radius: 18rpx;
		box-sizing: border-box;
		border: 1rpx solid #e0e0e0;
		padding: 0 20rpx;
		display: flex;
		align-items: center;
		box-shadow: 0 8rpx 20rpx rgba(16, 46, 90, 0.04);
	}

<<<<<<< HEAD
	.input {
		flex: 1;
		border: none;
		background: transparent;
		font-size: 26rpx;
		color: #222;
	}
=======
        .input {
                flex: 1;
                border: none;
                background: transparent;
                font-size: 26rpx;
                color: #222;
        }

        .readonly-input .input {
                color: #6b7280;
                background-color: #f3f4f6;
        }
>>>>>>> 25fda4a (init project)

	.picker {
		flex: 1;
		display: flex;
		align-items: center;
		font-size: 26rpx;
		color: #222;
	}

	/* 汇总 */
	.card-summary .summary-row {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		row-gap: 12rpx;
	}

	.summary-item {
		width: 48%;
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

	/* 列表/表格 */
	.table {
		margin-top: 8rpx;
	}

	.table-header,
	.table-row {
		display: flex;
		align-items: center;
	}

	.table-header {
		padding: 8rpx 6rpx;
		border-bottom: 1rpx solid #e5e7eb;
	}

	.table-row {
		padding: 10rpx 6rpx;
	}

	.table-row:nth-child(odd) {
		background: #f9fafb;
	}

	.th,
	.td {
		font-size: 22rpx;
		padding: 0 4rpx;
		box-sizing: border-box;
		text-align: center;
	}

	.col-date {
		flex: 1.1;
	}

	.col-text {
		flex: 1.2;
	}

	.col-num {
		flex: 1;
	}

	.col-op {
		flex: 0.8;
	}

	.op-link {
		margin: 0 4rpx;
		font-size: 22rpx;
		color: #2563eb;
	}

	.op-link.danger {
		color: #dc2626;
	}

	/* 非管理员操作列占位 */
	.op-link-disabled {
		font-size: 22rpx;
		color: #d1d5db;
	}

	/* 空态 */
	.list-empty {
		padding: 24rpx 8rpx;
		text-align: center;
	}

	.empty-text {
		font-size: 24rpx;
		color: #9ca3af;
	}

	/* 编辑弹层 */
	.edit-mask {
		position: fixed;
		left: 0;
		top: 0;
		right: 0;
		bottom: 0;
		background: rgba(15, 23, 42, 0.35);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 999;
	}

	.edit-dialog {
		width: 92%;
		max-width: 680rpx;
		background: #ffffff;
		border-radius: 24rpx;
		box-shadow: 0 18rpx 46rpx rgba(15, 23, 42, 0.4);
		padding: 24rpx 26rpx 18rpx;
		box-sizing: border-box;
	}

	.edit-header {
		margin-bottom: 10rpx;
	}

	.edit-title {
		font-size: 30rpx;
		font-weight: 600;
		color: #111827;
	}

	.edit-body {
		margin-top: 6rpx;
	}

	.form-row {
		display: flex;
		justify-content: space-between;
		column-gap: 16rpx;
	}

	.form-item {
		margin-bottom: 18rpx;
	}

	.form-item.half {
		flex: 1;
	}

	.form-item.third {
		flex: 1;
	}

	.textarea {
		width: 100%;
		min-height: 140rpx;
		padding: 16rpx 24rpx;
		box-sizing: border-box;
		border-radius: 18rpx;
		border: 1rpx solid #e0e0e0;
		background: #ffffff;
		font-size: 26rpx;
		color: #222;
	}

	.edit-footer {
		margin-top: 10rpx;
		display: flex;
		justify-content: flex-end;
		column-gap: 12rpx;
	}

	/* 按钮：整体缩小一点 */
	.btn-soft,
	.btn-primary {
		min-width: 140rpx;
		padding: 10rpx 18rpx;
		border-radius: 999rpx;
		font-size: 24rpx;
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

	.btn-query {
		min-width: 140rpx;
	}

	/* 顶部按钮组合大小 */
	.page-header-right .btn-add {
		min-width: 160rpx;
		margin-left: 12rpx;
	}

	.btn-export {
		min-width: 160rpx;
	}

	/* 小屏适配：按钮更紧凑，标题区换行 */
	@media screen and (max-width: 768px) {
		.page-header {
			flex-direction: column;
			align-items: flex-start;
			row-gap: 10rpx;
		}

		.page-header-right {
			margin-top: 8rpx;
		}

		.btn-soft,
		.btn-primary {
			min-width: auto;
			padding: 8rpx 14rpx;
			font-size: 22rpx;
		}

		.page-header-right .btn-add {
			margin-left: 8rpx;
		}

		.btn-export {
			margin-left: 0;
		}
	}
</style>