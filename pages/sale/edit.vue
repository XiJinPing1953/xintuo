<template>
	<view class="sale-page">
		<view class="sale-inner">
			<BackToDashboardBar back-to="/pages/dashboard/index" text="返回工作台" />
			<!-- 顶部提示 / 标题 -->
			<view class="page-header">
				<view class="page-header-left">
					<view class="page-icon">
						<text class="page-icon-text">记</text>
					</view>
					<view class="page-header-text">
						<text class="page-title">新增销售记录</text>
						<text class="page-sub">
							分别记录出瓶、回瓶、存瓶与结算信息，方便后续统计与对账
						</text>
					</view>
				</view>
				<view class="page-header-right">
					<view class="tag-soft">
						<text class="tag-dot"></text>
						<text class="tag-text">今日 · {{ todayText }}</text>
					</view>
				</view>
			</view>

			<!-- 卡片：基础信息（含业务模式 pill 的子组件） -->
			<SaleBasicInfoCard :value="header" @input="header = $event" :customers="customers"
				:deliveryList="deliveryList" :vehicleList="vehicleList" @vehicle-select="onVehicleSelected" />

			<!-- 卡片行：出瓶 + 回瓶（大屏横向排布，truck 模式下整体隐藏） -->
			<view class="card-row" v-if="showBottleCards">
				<!-- 卡片：出瓶 -->
				<view class="card">
					<view class="card-header">
						<text class="card-title">出瓶</text>
						<text class="card-sub">本次送出去的瓶子，可添加多行</text>
					</view>
					<view class="card-body">
						<view v-for="(row, index) in outBottles" :key="'out-' + index" class="bottle-row">
							<!-- 瓶号 + 删除 -->
							<view class="row-header">
								<view class="row-header-left">
									<text class="label">瓶号</text>
								</view>
								<view class="row-header-right" v-if="outBottles.length > 1">
									<text class="delete-text" @click="removeOutBottleRow(index)">删除</text>
								</view>
							</view>

							<view class="form-item">
								<view class="input-wrapper">
									<input class="input" v-model="row.number" placeholder="例如 207，支持模糊搜索"
										@input="onOutBottleInput(index, $event)" @blur="onOutBottleBlur(index)" />
								</view>

								<!-- 候选瓶号下拉列表 -->
								<view v-if="row.suggestions && row.suggestions.length" class="bottle-suggest">
									<view v-for="item in row.suggestions" :key="item._id" class="suggest-item"
										@tap.stop="onSelectOutBottle(index, item)">
										<text class="suggest-no">{{ item.number }}</text>
										<text class="suggest-sub">
											皮重
											{{
                        item.tare_weight != null ? item.tare_weight : '-'
                      }}kg ·
											{{ statusTextMap[item.status] || '未知状态' }}
										</text>
									</view>
								</view>
							</view>

							<!-- 毛重 / 皮重 / 净重 -->
							<view class="form-row">
								<view class="form-item col">
									<text class="label">毛重 (kg)</text>
									<view class="input-wrapper">
										<input class="input" type="number" placeholder="kg" v-model="row.gross"
											@blur="updateOutNet(index)" />
									</view>
								</view>
								<view class="form-item col">
									<text class="label">皮重 (kg)</text>
									<view class="input-wrapper">
										<input class="input" type="number" placeholder="kg" v-model="row.tare"
											@blur="updateOutNet(index)" />
									</view>
								</view>
								<view class="form-item col">
									<text class="label">净重 (kg)</text>
									<view class="input-wrapper">
										<input class="input" type="number" placeholder="若不填将按 毛重-皮重 自动计算"
											v-model="row.net" @input="row.netManual = true" />
									</view>
								</view>
							</view>

							<view class="row-divider"></view>
						</view>

						<!-- 添加出瓶按钮 -->
						<view class="btn-row-inline">
							<button class="btn-soft" @click="addOutBottleRow">
								+ 添加出瓶
							</button>
						</view>

						<!-- 出瓶合计 -->
						<view class="summary-chip">
							<view class="summary-line">
								<text class="summary-label">本次出瓶净重合计：</text>
								<text class="summary-value">{{ totalOutNet }} kg</text>
							</view>
							<view class="summary-line" v-if="totalOutNetDetail">
								<text class="summary-formula">{{ totalOutNetDetail }}</text>
							</view>
						</view>
					</view>
				</view>

				<!-- 卡片：回瓶 -->
				<view class="card">
					<view class="card-header">
						<text class="card-title">回收瓶</text>
						<text class="card-sub">本次从客户处回收的瓶子，可添加多行</text>
					</view>
					<view class="card-body">
						<view v-for="(row, index) in backBottles" :key="'back-' + index" class="bottle-row">
							<view class="row-header">
								<view class="row-header-left">
									<text class="label">回收瓶号</text>
								</view>
								<view class="row-header-right" v-if="backBottles.length > 1">
									<text class="delete-text" @click="removeBackBottleRow(index)">删除</text>
								</view>
							</view>

							<view class="form-item">
								<view class="input-wrapper">
									<input class="input" v-model="row.number" placeholder="例如 114 / 207"
										@input="onBackBottleInput(index, $event)" @blur="onBackBottleBlur(index)" />
								</view>

								<!-- 候选瓶号下拉列表 -->
								<view v-if="row.suggestions && row.suggestions.length" class="bottle-suggest">
									<view v-for="item in row.suggestions" :key="item._id" class="suggest-item"
										@tap.stop="onSelectBackBottle(index, item)">
										<text class="suggest-no">{{ item.number }}</text>
										<text class="suggest-sub">
											皮重
											{{
                        item.tare_weight != null ? item.tare_weight : '-'
                      }}kg ·
											{{ statusTextMap[item.status] || '未知状态' }}
										</text>
									</view>
								</view>
							</view>

							<view class="form-row">
								<view class="form-item col">
									<text class="label">毛重 (kg)</text>
									<view class="input-wrapper">
										<input class="input" type="number" placeholder="kg" v-model="row.gross"
											@blur="updateBackNet(index)" />
									</view>
								</view>
								<view class="form-item col">
									<text class="label">皮重 (kg)</text>
									<view class="input-wrapper">
										<input class="input" type="number" placeholder="kg" v-model="row.tare"
											@blur="updateBackNet(index)" />
									</view>
								</view>
								<view class="form-item col">
									<text class="label">净重 (kg)</text>
									<view class="input-wrapper">
									<input class="input" type="number" placeholder="若不填将按 毛重-皮重 自动计算，可手动改为负数/正数"
											v-model="row.net" @input="onBackNetManualInput(index)" />
									</view>
								</view>
							</view>

							<view class="row-divider"></view>
						</view>

						<view class="btn-row-inline">
							<button class="btn-soft" @click="addBackBottleRow">
								+ 添加回瓶
							</button>
						</view>

						<!-- 回瓶合计 & 金额方向 -->
						<view class="summary-chip-column">
							<view class="summary-line">
								<text class="summary-label">本次回瓶净重合计：</text>
								<text class="summary-value">{{ totalBackNet }} kg</text>
							</view>
							<view class="summary-line" v-if="totalBackNetDetail">
								<text class="summary-formula">{{ totalBackNetDetail }}</text>
							</view>
							<view class="summary-line">
								<text class="summary-label">按单价结算：</text>
								<text class="summary-value" :class="{
                    'summary-positive': backAmount < 0,
                    'summary-negative': backAmount > 0
                  }">
									{{ backAmountAbs }} 元
								</text>
								<text class="summary-tip">
									{{ backAmountDirectionText }}
								</text>
							</view>
						</view>
					</view>
				</view>
			</view>

			<!-- 卡片行：存瓶 / Flow 理论流量 / 整车 / 结算 -->
			<view class="card-row">
				<!-- 卡片：存瓶（仅瓶装模式显示） -->
				<view class="card" v-if="bizMode === 'bottle'">
					<view class="card-header">
						<text class="card-title">存瓶号</text>
						<text class="card-sub">记录当前留在客户处的瓶子，可添加多行</text>
					</view>
					<view class="card-body">
						<view v-if="remainingDeposits.length" class="deposit-inventory">
							<text class="inventory-label">客户存瓶：</text>
							<view class="inventory-list">
								<view v-for="no in remainingDeposits" :key="no" class="inventory-chip">
									{{ no }}
								</view>
							</view>
						</view>
						<view v-for="(row, index) in depositBottles" :key="'dep-' + index" class="bottle-row">
							<view class="row-header">
								<view class="row-header-left">
									<text class="label">存瓶号</text>
								</view>
								<view class="row-header-right" v-if="depositBottles.length > 1">
									<text class="delete-text" @click="removeDepositBottleRow(index)">删除</text>
								</view>
							</view>

							<view class="form-item">
								<view class="input-wrapper">
									<input class="input" v-model="row.number" placeholder="例如 207"
										@input="onDepositBottleInput(index, $event)"
										@blur="onDepositBottleBlur(index)" />
								</view>

								<view v-if="row.suggestions && row.suggestions.length" class="bottle-suggest">
									<view v-for="item in row.suggestions" :key="item._id" class="suggest-item"
										@tap.stop="onSelectDepositBottle(index, item)">
										<text class="suggest-no">{{ item.number }}</text>
										<text class="suggest-sub">
											皮重
											{{
                        item.tare_weight != null ? item.tare_weight : '-'
                      }}kg ·
											{{ statusTextMap[item.status] || '未知状态' }}
										</text>
									</view>
								</view>
							</view>

							<view class="row-divider"></view>
						</view>

						<view class="btn-row-inline">
							<button class="btn-soft" @click="addDepositBottleRow">
								+ 添加存瓶
							</button>
						</view>
					</view>
				</view>

				<!-- Flow 理论流量卡片：仅元/m³ 单价模式显示 -->
				<FlowTheoryCard v-if="isFlowPriceMode" :totalOutNet="flowTheoryOutNet" :totalBackNet="flowTheoryBackNet"
					:ratio="flowTheoryRatio" @update-ratio="onUpdateFlowRatio" />

				<!-- 卡片：整车信息（仅 truck 模式显示） -->
				<view class="card" v-if="bizMode === 'truck'">
					<view class="card-header">
						<text class="card-title">整车信息</text>
						<text class="card-sub">记录整车毛重 / 皮重 / 净重，用于整车结算</text>
					</view>
					<view class="card-body">
						<view class="summary-chip" v-if="truckBottleNo">
							<view class="summary-line">
								<text class="summary-label">整车瓶号：</text>
								<text class="summary-value">{{ truckBottleNo }}</text>
							</view>
						</view>
						<view class="summary-chip" v-if="truckBottleNo">
							<view class="summary-line">
								<text class="summary-label">整车瓶号：</text>
								<text class="summary-value">{{ truckBottleNo }}</text>
							</view>
						</view>

						<view class="form-row">
							<view class="form-item col">
								<text class="label">销售净重 (kg)</text>
								<view class="input-wrapper">
									<input class="input" type="number" placeholder="必填，结算依据" v-model="truckInfo.net_sale_kg" @input="onTruckNetSaleInput" />
								</view>
							</view>
						</view>

						<view class="summary-chip">
							<view class="summary-line">
								<text class="summary-label">应收金额：</text>
								<text class="summary-value">{{ truckShouldReceive }} 元</text>
							</view>
						</view>

						<view class="form-row">
							<view class="form-item col">
								<text class="label">毛重 (吨)</text>
								<view class="input-wrapper">
									<input class="input" type="number" placeholder="整车毛重（吨，可空）" v-model="truckInfo.gross_ton"
										@blur="onTruckWeightBlur" />
								</view>
							</view>

							<view class="form-item col">
								<text class="label">皮重 (吨)</text>
								<view class="input-wrapper">
									<input class="input" type="number" placeholder="车辆皮重（吨，可空）" v-model="truckInfo.tare_ton"
										@blur="onTruckWeightBlur" />
								</view>
							</view>

							<view class="form-item col">
								<text class="label">净重 (吨)</text>
								<view class="input-wrapper">
									<input class="input" type="number" placeholder="若不填按 毛重-皮重 自动算（吨，可空）"
										v-model="truckInfo.net_ton" readonly />
								</view>
							</view>
						</view>

						<view class="summary-chip">
							<view class="summary-line">
								<text class="summary-label">整车净重：</text>
								<text class="summary-value">
									{{ (Number(truckInfo.net_ton) || 0).toFixed(2) }} 吨
								</text>
							</view>
						</view>

						<view class="form-row">
							<view class="form-item col">
								<text class="label">充装净重 (kg)</text>
								<view class="input-wrapper">
									<input class="input" type="number" placeholder="可从灌装记录带入" v-model="truckInfo.fill_net" @input="onTruckFillInput" @blur="recalcTruckLossB" />
								</view>
							</view>
							<view class="form-item col">
								<text class="label">回厂净重 (kg)</text>
								<view class="input-wrapper">
									<input class="input" type="number" placeholder="可手填" v-model="truckInfo.back_net" @input="onTruckBackNetInput" @blur="recalcTruckLossB" />
								</view>
							</view>
						</view>

						<view class="summary-chip">
							<view class="summary-line">
								<text class="summary-label">损耗A（充装-销售净重）：</text>
								<text class="summary-value">{{ truckLossAText }}</text>
							</view>
							<view class="summary-line">
								<text class="summary-label">损耗B（充装-回厂净重）：</text>
								<text class="summary-value">{{ truckLossBText }}</text>
							</view>
						</view>
					</view>
				</view>

				<!-- 卡片：结算与其他（元/kg、元/瓶 显示；元/m³ 用 FlowSettlementCard 替换） -->
				<view class="card" v-if="!isFlowPriceMode">
					<view class="card-header">
						<text class="card-title">结算与其他</text>
					</view>
					<view class="card-body">
						<view class="form-row">
							<view class="form-item col-half">
								<text class="label">实收金额</text>
								<view class="input-wrapper">
									<input class="input" type="number" placeholder="本次实际收了多少，可为 0"
										v-model="header.amount_received" />
								</view>
							</view>
							<view class="form-item col-half">
								<text class="label">付款状态</text>
								<picker mode="selector" :range="paymentStatusOptions" :value="paymentStatusIndex"
									@change="onPaymentStatusChange">
									<view class="input-wrapper">
										<view class="picker">
											<text>{{ paymentStatusLabel }}</text>
										</view>
									</view>
								</picker>
							</view>
						</view>

						<view class="summary-chip-column">
							<!-- 出瓶/整车 应收 -->
							<view class="summary-line">
								<text class="summary-label">
									{{
                    bizMode === 'truck'
                      ? '整车应收：'
                      : '本次出瓶应收：'
                  }}
								</text>
								<text class="summary-value">{{ outAmount }} 元</text>
							</view>
							<view class="summary-line" v-if="outAmountDetail">
								<text class="summary-formula">{{ outAmountDetail }}</text>
							</view>

							<!-- 回瓶结算调整（元/m³ 模式不会走到这里） -->
							<view class="summary-line">
								<text class="summary-label">回瓶结算调整：</text>
								<text class="summary-value" :class="{
                    'summary-positive': backAmount < 0,
                    'summary-negative': backAmount > 0
                  }">
									{{ backAmountDisplayForSummary }} 元
								</text>
							</view>
							<view class="summary-line" v-if="backAmountDetail">
								<text class="summary-formula">{{ backAmountDetail }}</text>
							</view>

							<!-- 出瓶与回瓶总净重 / 整车 实际 -->
							<view class="summary-line">
								<text class="summary-label">
									{{
                    bizMode === 'truck'
                      ? '整车净重：'
                      : '出瓶与回瓶总净重：'
                  }}
								</text>
								<text class="summary-value">{{ totalInOutNet }} kg</text>
							</view>
							<view class="summary-line" v-if="totalInOutNetDetail">
								<text class="summary-formula">{{ totalInOutNetDetail }}</text>
							</view>

							<!-- 理论应收合计（老逻辑，kg / 瓶） -->
							<view class="summary-line">
								<text class="summary-label-strong">理论应收合计：</text>
								<text class="summary-value-strong">{{ shouldReceive }} 元</text>
							</view>
							<view class="summary-line" v-if="shouldReceiveDetail">
								<text class="summary-formula">{{ shouldReceiveDetail }}</text>
							</view>
						</view>

						<view class="form-item">
							<text class="label">备注</text>
							<textarea class="textarea" placeholder="例如：欠对方7公斤（2月13日清）" v-model="header.remark" />
						</view>
					</view>
				</view>

				<!-- 元/m³ 模式：用流量结算卡片替代结算与其他 -->
				<FlowSettlementCard v-else :unitPrice="header.unit_price" :prevIndex="flowSettle.prev"
					:currIndex="flowSettle.curr" :amountReceived="flowSettle.amount_received"
					:paymentStatus="flowSettle.payment_status" :remark="flowSettle.remark"
					:paymentStatusOptions="paymentStatusOptions" @input="onFlowSettleChange" />
			</view>

			<!-- 底部按钮 -->
			<view class="btn-row-bottom">
				<button class="btn-soft" @click="resetForm">重置</button>
				<button class="btn-primary" type="primary" :loading="submitting" @click="handleSubmit">
					保存销售记录
				</button>
			</view>
		</view>
	</view>
</template>

<script>
	import {
		ensureLogin,
		getToken,
		getUserInfo,
		isAdminRole
	} from '@/common/auth.js'
	import BackToDashboardBar from '@/components/BackToDashboardBar.vue'
	import SaleBasicInfoCard from '@/components/SaleBasicInfoCard.vue'
	import FlowSettlementCard from '@/components/FlowSettlementCard.vue'
	import FlowTheoryCard from '@/components/FlowTheoryCard.vue'

	// 防抖
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
			BackToDashboardBar,
			SaleBasicInfoCard,
			FlowSettlementCard,
			FlowTheoryCard
		},
		data() {
			return {
				todayText: '',
				statusTextMap: {
					in_station: '在站',
					at_customer: '在客户',
					in_transit: '途中',
					repairing: '维修',
					scrapped: '报废',
					lost: '丢失'
				},

				header: {
					date: '',
					customer_id: '',
					customer_name: '',
					delivery_man_1: '',
					delivery_man_2: '',
					vehicle_id: '',
					car_no: '',
					unit_price: '',
					price_unit: 'kg', // kg | bottle | m3
					amount_received: '',
					payment_status: '挂账',
					remark: '',
					biz_mode: 'bottle', // bottle | truck

					truck_gross: '',
					truck_tare: '',
					truck_net: '',
					truck_loss_b: ''
				},

				truckInfo: {
					bottle_no: '',
					net_sale_kg: '',
					fill_net: '',
					back_net: '',
					out_net: '',
					loss_a: '',
					loss_b: '',
					gross_ton: '',
					tare_ton: '',
					net_ton: ''
				},

				// Flow 理论换算系数（m³/kg）
				defaultRatio: 1.37,
				flowTheoryRatio: 1.37,

				// 流量结算卡片 v-model
				flowSettle: {
					// 前端交互字段（FlowSettlementCard 用）
					prev: '',
					curr: '',
					volume: '',
					amount: '',
					amount_received: '',
					payment_status: '挂账',
					remark: '',

					// 后端字段
					flow_index_prev: '',
					flow_index_curr: '',
					flow_volume: '',
					flow_unit_price: '',
					flow_amount_should: '',
					flow_amount_received: '',
					flow_payment_status: '',
					flow_remark: ''
				},

				// truck 模式：用户是否手工改过净重
				truckNetManual: false,
				truckLossBTouched: false,

				customers: [],
				customerIndex: -1,
				customerKeyword: '',
				customerSuggests: [],

				deliveryList: [],
				deliveryIndex1: -1,
				deliveryIndex2: -1,

				vehicleList: [],
				vehicleIndex: -1,

				// 单价单位
				priceUnitOptions: ['元/kg', '元/瓶', '元/m³'],
				priceUnitIndex: 0,

				paymentStatusOptions: ['挂账', '已付', '部分已付', '冲减'],
				paymentStatusIndex: 0,

				// 出瓶
				outBottles: [{
					number: '',
					gross: '',
					tare: '',
					net: '',
					bottleId: null,
					exists: null,
					suggestions: [],
					fromSelect: false,
					netManual: false
				}],

				// 回瓶
				backBottles: [{
					number: '',
					gross: '',
					tare: '',
					net: '',
					bottleId: null,
					exists: null,
					suggestions: [],
					fromSelect: false,
					netManual: false
				}],

				// 存瓶
				depositBottles: [{
					number: '',
					bottleId: null,
					exists: null,
					suggestions: [],
					fromSelect: false
				}],
				customerDeposits: [],

				submitting: false,

				// 瓶子搜索缓存
				bottleSearchCache: {},
				bottleSearchPending: {},
				debouncedBottleSuggest: null,

				// ⭐ 编辑模式相关
				editId: '',
				isEditing: false,

				// 当前登录用户信息（用于权限）
				userInfo: {}
			}
		},

		computed: {
			// 是否管理员：只有 role === 'user' 算普通用户，其它都按管理员（兼容老账号）
			isAdmin() {
				return isAdminRole(this.userInfo)
			},

			// 页面标题：新增 / 编辑
			pageTitle() {
				return this.isEditing ? '编辑销售记录' : '新增销售记录'
			},

			// 顶部右侧 tag 文案
			tagText() {
				if (this.isEditing) {
					if (this.header && this.header.date) {
						return `单据日期 · ${this.header.date}`
					}
					return '单据日期未填写'
				}
				return `今日 · ${this.todayText}`
			},

			// 当前业务模式
			bizMode() {
				return this.header.biz_mode || this.header.business_mode || 'bottle'
			},

			truckNetSaleNumber() {
				const n = Number(this.truckInfo.net_sale_kg)
				return Number.isFinite(n) ? n : 0
			},

			// 是否显示瓶子相关卡片
			showBottleCards() {
				return this.bizMode === 'bottle'
			},

			// Flow 单价模式
			isFlowPriceMode() {
				return this.header.price_unit === 'm3'
			},

			truckBottleNo() {
				return this.truckInfo.bottle_no || this.buildTruckBottleNo(this.header.car_no)
			},

			normalizedCustomerDeposits() {
				return this.normalizeDepositList(this.customerDeposits)
			},

			liveDeposits() {
				const list = []
				const seen = new Set()

				const append = (no) => {
					const val = (no || '').trim()
					if (!val || seen.has(val)) return
					seen.add(val)
					list.push(val)
				}

				// ✅ 不管新建 / 编辑，liveDeposits 都以「后端当前存瓶」为底
				this.normalizedCustomerDeposits.forEach(append)

				// 本单存瓶区
				;
				(this.depositBottles || []).forEach(r => append(r && r.number))

				// 本单出瓶区
				;
				(this.outBottles || []).forEach(r => append(r && r.number))

				// 本单回瓶区：减掉
				;
				(this.backBottles || []).forEach(r => {
					const no = (r && r.number ? r.number.trim() : '')
					if (!no || !seen.has(no)) return
					seen.delete(no)
					const idx = list.indexOf(no)
					if (idx > -1) list.splice(idx, 1)
				})

				return list
			},
			remainingDeposits() {
				// 新建单：沿用原来的完整逻辑（后端当前存瓶 + 本单增减）
				if (!this.isEditing) {
					return this.liveDeposits
				}

				// 编辑单：tag 只展示“这张单之后的存瓶”，完全由当前表单决定
				// 也就是：本单存瓶 + 本单出瓶 - 本单回瓶（不再用 customerDeposits 作为底数）
				const list = []
				const seen = new Set()

				const append = (no) => {
					const val = (no || '').trim()
					if (!val || seen.has(val)) return
					seen.add(val)
					list.push(val)
				}

				// 1）这张单当前填写的“存瓶区”
				;
				(this.depositBottles || []).forEach(r => append(r && r.number))

				// 2）这张单当前填写的“出瓶区”
				;
				(this.outBottles || []).forEach(r => append(r && r.number))

				// 3）这张单当前填写的“回瓶区” —— 把对应瓶号从集合里扣掉
				;
				(this.backBottles || []).forEach(r => {
					const no = (r && r.number ? r.number.trim() : '')
					if (!no || !seen.has(no)) return
					seen.delete(no)
					const idx = list.indexOf(no)
					if (idx > -1) list.splice(idx, 1)
				})

				return list
			},

			// 整车净重 number 版
			truckNetNumber() {
				const n = Number(this.header.truck_net)
				return isNaN(n) ? 0 : n
			},

			truckGrossTon: {
				get() {
					const v = this.header.truck_gross
					if (v === '' || v == null) return ''
					const n = Number(v)
					if (isNaN(n)) return ''
					return n / 1000
				},
				set(val) {
					const t = Number(val)
					if (isNaN(t)) {
						this.header.truck_gross = ''
					} else {
						this.header.truck_gross = String(Math.round(t * 1000))
						this.updateTruckNet()
					}
				}
			},

			truckTareTon: {
				get() {
					const v = this.header.truck_tare
					if (v === '' || v == null) return ''
					const n = Number(v)
					if (isNaN(n)) return ''
					return n / 1000
				},
				set(val) {
					const t = Number(val)
					if (isNaN(t)) {
						this.header.truck_tare = ''
					} else {
						this.header.truck_tare = String(Math.round(t * 1000))
						this.updateTruckNet()
					}
				}
			},

			truckNetTon: {
				get() {
					const v = this.header.truck_net
					if (v === '' || v == null) return ''
					const n = Number(v)
					if (isNaN(n)) return ''
					return n / 1000
				},
				set(val) {
					this.truckNetManual = true
					const t = Number(val)
					if (isNaN(t)) {
						this.header.truck_net = ''
					} else {
						this.header.truck_net = String(Math.round(t * 1000))
					}
				}
			},

			backAmountAbs() {
				const v = this.backAmount
				if (!v) return '0'
				return Math.abs(v).toFixed(2)
			},

			backAmountDirectionText() {
				if (this.backAmount > 0) return '（需退给客户）'
				if (this.backAmount < 0) return '（需客户补）'
				return ''
			},

			backAmountDisplayForSummary() {
				const v = this.backAmount
				if (!v) return '0'
				const abs = Math.abs(v).toFixed(2)
				return v > 0 ? '-' + abs : abs
			},

			// 出瓶金额公式
			outAmountDetail() {
				const price = this.unitPriceNumber
				if (!price) return ''

				if (this.bizMode === 'truck') {
					const net = this.truckNetNumber
					if (!net) return ''
					return `${net.toFixed(2)}kg×${price.toFixed(2)}元/kg=${this.outAmount}元`
				}

				if (this.header.price_unit === 'bottle') {
					const count = this.outBottles.filter(r => r.number.trim()).length
					if (!count) return ''
					return `${count}瓶×${price.toFixed(2)}元/瓶=${this.outAmount}元`
				} else if (this.header.price_unit === 'kg') {
					const net = Number(this.totalOutNet)
					if (!net) return ''
					return `${net.toFixed(2)}kg×${price.toFixed(2)}元/kg=${this.outAmount}元`
				}

				return ''
			},

			backAmountDetail() {
				const price = this.unitPriceNumber
				if (!price) return ''
				if (this.header.price_unit === 'bottle' || this.header.price_unit === 'm3') {
					return ''
				}
				const net = Number(this.totalBackNet)
				if (!net) return ''
				const absNet = Math.abs(net).toFixed(2)
				const absAmount = Math.abs(this.backAmount).toFixed(2)
				const prefix = net > 0 ? '减收' : '加收'
				return `${absNet}kg×${price.toFixed(
          2
        )}元/kg=${absAmount}元，${prefix}${absAmount}元`
			},

			shouldReceiveDetail() {
				const out = Number(this.outAmount)
				if (!out) return ''
				const back = this.backAmount
				const absBack = Math.abs(back).toFixed(2)
				const result = this.shouldReceive
				if (!back) {
					return `${out.toFixed(2)}=${result}元`
				}
				if (back > 0) {
					return `${out.toFixed(2)}-${absBack}=${result}元`
				} else {
					return `${out.toFixed(2)}+${absBack}=${result}元`
				}
			},

			// 客户 / 配送员 / 车辆标签
			customerLabel() {
				if (this.customerIndex < 0) return '请选择客户'
				return this.customers[this.customerIndex]?.name || '请选择客户'
			},

			deliveryLabel1() {
				if (this.deliveryIndex1 < 0) return '请选择配送员'
				return this.deliveryList[this.deliveryIndex1]?.name || '请选择配送员'
			},

			deliveryLabel2() {
				if (this.deliveryIndex2 < 0) return '（可空）'
				return this.deliveryList[this.deliveryIndex2]?.name || '（可空）'
			},

			vehicleLabel() {
				if (this.vehicleIndex < 0) return '请选择车辆'
				const v = this.vehicleList[this.vehicleIndex]
				return v ? (v.name ? `${v.plate_no} - ${v.name}` : v.plate_no) : '请选择车辆'
			},

			priceUnitLabel() {
				return this.priceUnitOptions[this.priceUnitIndex]
			},

			paymentStatusLabel() {
				return this.paymentStatusOptions[this.paymentStatusIndex]
			},

			// 净重合计 & 公式
			totalOutNet() {
				let sum = 0
				this.outBottles.forEach(r => {
					const n = Number(r.net)
					if (!isNaN(n)) sum += n
				})
				return sum.toFixed(2)
			},

			totalBackNet() {
				let sum = 0
				this.backBottles.forEach(r => {
					const n = Number(r.net)
					if (!isNaN(n)) sum += n
				})
				return sum.toFixed(2)
			},

			totalOutNetDetail() {
				const nums = this.outBottles
					.map(r => Number(r.net))
					.filter(n => !isNaN(n) && n !== 0)
				if (!nums.length) return ''

				let expr = ''
				nums.forEach((n, idx) => {
					const abs = Math.abs(n)
					const valStr = (abs % 1 === 0 ? abs.toString() : abs.toFixed(2)) + 'kg'
					if (idx === 0) {
						expr += (n < 0 ? '-' : '') + valStr
					} else {
						expr += (n < 0 ? '-' : '+') + valStr
					}
				})
				const total = Number(this.totalOutNet)
				const absTotal = Math.abs(total)
				const totalStr =
					(absTotal % 1 === 0 ? absTotal.toString() : absTotal.toFixed(2)) + 'kg'
				expr += '=' + (total < 0 ? '-' : '') + totalStr
				return expr
			},

			totalBackNetDetail() {
				const nums = this.backBottles
					.map(r => Number(r.net))
					.filter(n => !isNaN(n) && n !== 0)
				if (!nums.length) return ''

				let expr = ''
				nums.forEach((n, idx) => {
					const abs = Math.abs(n)
					const valStr = (abs % 1 === 0 ? abs.toString() : abs.toFixed(2)) + 'kg'
					if (idx === 0) {
						expr += (n < 0 ? '-' : '') + valStr
					} else {
						expr += (n < 0 ? '-' : '+') + valStr
					}
				})
				const total = Number(this.totalBackNet)
				const absTotal = Math.abs(total)
				const totalStr =
					(absTotal % 1 === 0 ? absTotal.toString() : absTotal.toFixed(2)) + 'kg'
				expr += '=' + (total < 0 ? '-' : '') + totalStr
				return expr
			},

			totalInOutNet() {
				if (this.bizMode === 'truck') {
					return this.truckNetNumber.toFixed(2)
				}

				const out = Number(this.totalOutNet)
				const back = Number(this.totalBackNet)
				const safeOut = isNaN(out) ? 0 : out
				const safeBack = isNaN(back) ? 0 : back
				const total = safeOut - safeBack
				return total.toFixed(2)
			},

			totalInOutNetDetail() {
				if (this.bizMode === 'truck') {
					const net = this.truckNetNumber
					if (!net) return ''
					const fmt = n => {
						const abs = Math.abs(n)
						return abs % 1 === 0 ? abs.toString() : abs.toFixed(2)
					}
					const s = fmt(net)
					return `${s}kg=${s}kg`
				}

				const out = Number(this.totalOutNet)
				const back = Number(this.totalBackNet)
				const safeOut = isNaN(out) ? 0 : out
				const safeBack = isNaN(back) ? 0 : back
				if (!safeOut && !safeBack) return ''

				const fmt = n => {
					const abs = Math.abs(n)
					return abs % 1 === 0 ? abs.toString() : abs.toFixed(2)
				}

				const outStr = fmt(safeOut)
				const backAbsStr = fmt(safeBack)
				const total = safeOut - safeBack
				const totalStr = fmt(total)

				if (safeBack > 0) {
					return `${outStr}kg-${backAbsStr}kg=${totalStr}kg`
				} else if (safeBack < 0) {
					return `${outStr}kg+${backAbsStr}kg=${totalStr}kg`
				} else {
					return `${outStr}kg=${totalStr}kg`
				}
			},

			// 金额
			unitPriceNumber() {
				const p = Number(this.header.unit_price)
				return isNaN(p) ? 0 : p
			},

			outAmount() {
				const price = this.unitPriceNumber
				if (!price) return '0'

				if (this.bizMode === 'truck') {
					return (this.truckNetNumber * price).toFixed(2)
				}

				if (this.header.price_unit === 'bottle') {
					const count = this.outBottles.filter(r => r.number.trim()).length
					return (count * price).toFixed(2)
				}

				if (this.header.price_unit === 'kg') {
					return (Number(this.totalOutNet) * price).toFixed(2)
				}

				return '0'
			},

			backAmount() {
				const price = this.unitPriceNumber
				if (!price) return 0
				if (this.header.price_unit === 'bottle' || this.header.price_unit === 'm3') {
					return 0
				}
				const net = Number(this.totalBackNet)
				return Number((net * price).toFixed(2))
			},

			shouldReceive() {
				const out = Number(this.outAmount)
				const back = Number(this.backAmount)
				return (out - back).toFixed(2)
			},

			// Flow 理论卡片
			flowTheoryOutNet() {
				if (this.bizMode === 'truck') {
					return this.truckNetNumber
				}
				return Number(this.totalOutNet) || 0
			},
			flowTheoryBackNet() {
				if (this.bizMode === 'truck') {
					return 0
				}
				return Number(this.totalBackNet) || 0
			}
		},

		watch: {
			'header.customer_id'(id) {
				if (this.isFlowPriceMode && id) {
					this.loadLastFlowIndexForCustomer(id)
				}
				this.loadCustomerDeposits(id)
			},
			'header.payment_status': {
				immediate: true,
				handler(v) {
					const idx = this.paymentStatusOptions.indexOf(v)
					this.paymentStatusIndex = idx >= 0 ? idx : 0
				}
			},
			'header.price_unit': {
				immediate: true,
				handler(v) {
					if (v === 'kg') this.priceUnitIndex = 0
					else if (v === 'bottle') this.priceUnitIndex = 1
					else if (v === 'm3') this.priceUnitIndex = 2
					else this.priceUnitIndex = 0

					if (v === 'm3' && this.header.customer_id) {
						this.loadLastFlowIndexForCustomer(this.header.customer_id)
					}
				}
			},
			bizMode(v) {
				if (v === 'truck') {
					this.outBottles = []
					this.backBottles = []
					this.depositBottles = []
					this.truckInfo.out_net = this.truckInfo.out_net || ''
					this.truckInfo.back_net = this.truckInfo.back_net || ''
				} else {
					if (!this.outBottles.length) this.outBottles = [this.createEmptyBottleRow()]
					if (!this.backBottles.length) this.backBottles = [this.createEmptyBottleRow()]
					if (!this.depositBottles.length) this.depositBottles = [this.createDepositRow()]
				}
			},
			'header.car_no'(val) {
				if (this.bizMode === 'truck') {
					this.truckInfo.bottle_no = this.buildTruckBottleNo(val)
				}
			}
		},

		onLoad(options) {
			// 登录校验
			const ok = ensureLogin()
			if (!ok) {
				uni.showModal({
					title: '提示',
					content: '登录已过期，请重新登录',
					showCancel: false,
					success: () => {
						try {
							uni.clearStorageSync()
						} catch (e) {}
						uni.reLaunch({
							url: '/pages/login/login'
						})
					}
				})
				return
			}

			// 读取一次用户信息，校验权限
			this.userInfo = getUserInfo() || {}
			if (!this.isAdmin) {
				uni.showModal({
					title: '提示',
					content: '当前账号无权限新增销售记录',
					showCancel: false,
					success: () => {
						this.goBack()
					}
				})
				return
			}

			// 是否编辑模式
			const editId = options && (options.id || options.sale_id)
			if (editId) {
				this.editId = editId
				this.isEditing = true
			}

			// 今天
			const d = new Date()
			const yyyy = d.getFullYear()
			const mm = String(d.getMonth() + 1).padStart(2, '0')
			const dd = String(d.getDate()).padStart(2, '0')
			this.header.date = `${yyyy}-${mm}-${dd}`
			this.todayText = `${mm} 月 ${dd} 日`

			this.flowTheoryRatio = this.defaultRatio

			this.loadCustomers()
			this.loadDeliveryList()
			this.loadVehicles()

			this.debouncedBottleSuggest = debounce(this.doBottleSuggest, 200)

			if (this.isEditing && this.editId) {
				this.loadSaleForEdit(this.editId)
			}
		},

		onShow() {
			// 再做一层登录 & 权限校验，防止后台改了角色
			if (!ensureLogin()) {
				// ensureLogin 内部可能已经跳转，这里防御一下
				return
			}
			this.userInfo = getUserInfo() || {}
			if (!this.isAdmin) {
				uni.showModal({
					title: '提示',
					content: '当前账号无权限新增销售记录',
					showCancel: false,
					success: () => {
						this.goBack()
					}
				})
				return
			}

			// 刷新基础数据
			this.loadCustomers()
			this.loadDeliveryList()
			this.loadVehicles()

			// 再同步一次选中项（防止基础数据刷新后索引错乱）
			this.syncSelectIndexesFromHeader()
		},

		methods: {
			// 登录失效统一处理（和 customer/list 风格对齐）
			handleAuthError(res) {
				const code = res && res.result && res.result.code
				const msg = (res && res.result && res.result.msg) || ''

				if (
					code === 401 ||
					code === 'UNAUTHORIZED' ||
					code === 'NO_LOGIN' ||
					code === 'AUTH_FAILED' ||
					msg.indexOf('未登录') !== -1 ||
					msg.indexOf('登录已过期') !== -1
				) {
					uni.showModal({
						title: '提示',
						content: msg || '登录已过期，请重新登录',
						showCancel: false,
						success: () => {
							try {
								uni.clearStorageSync()
							} catch (e) {}
							uni.reLaunch({
								url: '/pages/login/login'
							})
						}
					})
					return true
				}
				return false
			},

			extractTruckKey(plate) {
				const clean = String(plate || '')
					.replace(/[\s\u3000]+/g, '')
					.toUpperCase()
					.trim()
				if (!clean) return ''

				if (/^[\u4e00-\u9fa5][A-Z]/.test(clean) && clean.length >= 7) {
					const key = clean.slice(2)
					return key.slice(-5)
				}

				return clean
			},

			normalizeTruckBottleNo(no, fallbackPlate) {
				const raw = String(no || '').trim()
				if (!raw) return ''

				const stripPrefix = raw.replace(/^TRUCK-?/i, '')
				const key = this.extractTruckKey(stripPrefix || fallbackPlate || '')
				if (!key) return ''
				return `TRUCK-${key}`
			},

			buildTruckBottleNo(plate) {
				const key = this.extractTruckKey(plate)
				if (!key) return ''
				return `TRUCK-${key}`
			},

			isTruckBottle(no) {
				return String(no || '').toUpperCase().startsWith('TRUCK-')
			},

			onVehicleSelected(payload) {
				if (!payload) return
				if (this.bizMode !== 'truck') return

				const plate = (payload.plate_no || '').trim()
				const truckNo = this.buildTruckBottleNo(plate)
				if (!truckNo) return

				this.truckInfo.bottle_no = truckNo
				this.outBottles = []
				this.backBottles = []
				this.depositBottles = []
				this.truckLossBTouched = false
				this.truckInfo.loss_b = ''
				this.truckInfo.fill_net = ''
				this.truckInfo.out_net = ''
				this.truckInfo.back_net = ''
				this.fetchTruckFillNet(payload.vehicle || { _id: this.header.vehicle_id })
				this.recalcTruckLossB()
			},

			async fetchTruckFillNet(vehicle) {
				if (!vehicle) return
				const token = getToken()
				if (!token) return
				try {
					const res = await uniCloud.callFunction({
						name: 'crm-vehicle',
						data: {
							action: 'latestFillNet',
							token,
							data: {
								vehicle_id: vehicle._id || this.header.vehicle_id || '',
								car_no: vehicle.car_no || vehicle.plate_no || vehicle.plateNo || this.header.car_no || ''
							}
						}
					})
					if (this.handleAuthError(res)) return
					const result = res.result || {}
					if (result.code === 0 && result.data) {
						const net = result.data.net || result.data.fill_net || result.data.fillNet
						if (net != null) {
							this.truckInfo.fill_net = String(net)
						}
					}
				} catch (err) {
					console.error('fetchTruckFillNet error', err)
				} finally {
					this.recalcTruckLossB()
				}
			},

			getTruckBackNetNumber() {
				const n = Number(this.truckInfo.back_net)
				return Number.isFinite(n) ? n : null
			},

			recalcTruckLossB() {
				if (this.bizMode !== 'truck') return
				if (this.truckLossBTouched) return
				const fill = Number(this.truckInfo.fill_net)
				const back = this.getTruckBackNetNumber()
				if (!Number.isFinite(fill) || back == null) {
					this.truckInfo.loss_b = this.truckInfo.loss_b || ''
					this.header.truck_loss_b = this.truckInfo.loss_b
					return
				}
				this.truckInfo.loss_b = (fill - back).toFixed(2)
				this.header.truck_loss_b = this.truckInfo.loss_b
			},

			normalizeDepositList(list) {
				if (!list) return []

				// 1）老数据：字符串 "309 / 303 / 308 / 316 / ..."
				if (typeof list === 'string') {
					return String(list)
						// 支持用 / 、逗号、空格等分隔
						.split(/[\/、,，\s]+/)
						.map(s => s.trim())
						.filter(Boolean)
				}

				// 2）确保是数组（兼容传单个对象 / 单个字符串）
				const arr = Array.isArray(list) ? list : [list]

				return arr
					.map(item => {
						if (typeof item === 'string') {
							return item.trim()
						}
						if (item && typeof item === 'object') {
							// 兼容各种字段名
							return String(
								item.bottle_no ||
								item.number ||
								item.bottleInput ||
								''
							).trim()
						}
						return ''
					})
					.filter(Boolean)
			},

			// ⭐ 编辑模式：加载已有销售记录
			async loadSaleForEdit(id) {
				if (!id) return
				const token = getToken()
				try {
					const res = await uniCloud.callFunction({
						name: 'crm-sale',
						data: {
							action: 'get',
							token,
							data: {
								id
							}
						}
					})

					if (this.handleAuthError(res)) return

					if (!res.result || res.result.code !== 0 || !res.result.data) {
						uni.showToast({
							title: res.result?.msg || '未找到销售记录',
							icon: 'none'
						})
						return
					}

					const rec = res.result.data
					// ⭐ 先从新字段里取，如果没有再从 delivery_man 字符串拆
					let d1 = rec.delivery_man_1 || rec.delivery1 || ''
					let d2 = rec.delivery_man_2 || rec.delivery2 || ''

					if ((!d1 || !d2) && rec.delivery_man) {
						const parts = String(rec.delivery_man)
							.split(/[\/、,，]/)
							.map(s => s.trim())
							.filter(Boolean)
						if (!d1) d1 = parts[0] || ''
						if (!d2) d2 = parts[1] || ''
					}

					// header
					this.header = {
						date: rec.date || '',
						customer_id: rec.customer_id || rec.customerId || '',
						customer_name: rec.customer_name || rec.customerName || '',
						delivery_man_1: d1,
						delivery_man_2: d2,
						vehicle_id: rec.vehicle_id || rec.vehicleId || '',
						car_no: rec.car_no || '',
						unit_price: rec.unit_price != null ? String(rec.unit_price) : '',
						price_unit: (rec.price_unit || rec.priceUnit || 'kg').toLowerCase(),
						amount_received: rec.amount_received != null ? String(rec.amount_received) : '',
						payment_status: rec.payment_status || '挂账',
						remark: rec.remark || '',
						biz_mode: rec.biz_mode || rec.bizMode || 'bottle',

						truck_gross: '',
						truck_tare: '',
						truck_net: '',
						truck_loss_b: ''
					}

					const truckInfo = rec.truck_info || {}
					this.truckInfo = {
						bottle_no: this.buildTruckBottleNo(rec.car_no || (truckInfo && truckInfo.plate_no)),
						net_sale_kg: truckInfo.net_sale_kg != null ? String(truckInfo.net_sale_kg) : '',
						fill_net: truckInfo.fill_net_kg != null ? String(truckInfo.fill_net_kg) : '',
						back_net: truckInfo.back_net_kg != null ? String(truckInfo.back_net_kg) : '',
						out_net: '',
						loss_a: truckInfo.loss_a_kg != null ? String(truckInfo.loss_a_kg) : '',
						loss_b: truckInfo.loss_b_kg != null ? String(truckInfo.loss_b_kg) : '',
						gross_ton: truckInfo.gross_ton != null ? String(truckInfo.gross_ton) : '',
						tare_ton: truckInfo.tare_ton != null ? String(truckInfo.tare_ton) : '',
						net_ton: truckInfo.net_ton != null ? String(truckInfo.net_ton) : ''
					}
					this.header.truck_loss_b = this.truckInfo.loss_b

					this.truckLossBTouched = false

					if (typeof rec.flow_theory_ratio === 'number') {
						this.flowTheoryRatio = rec.flow_theory_ratio
					}

					const normalizeBottleNumber = (no) => {
						const normalizedTruck = this.normalizeTruckBottleNo(no, this.header.car_no)
						if (normalizedTruck) return normalizedTruck
						return String(no || '').trim()
					}

					// 出瓶
					if (this.bizMode === 'bottle') {
						const outItems = rec.out_items || rec.outItems || []
						if (Array.isArray(outItems) && outItems.length) {
							this.outBottles = outItems.map(it => ({
								number: normalizeBottleNumber(it.bottle_no || it.bottleInput || ''),
								gross: it.gross != null ? String(it.gross) : '',
								tare: it.tare != null ? String(it.tare) : '',
								net: it.net != null ? String(it.net) : '',
								bottleId: it.bottle_id || it.bottleId || null,
								exists: true,
								suggestions: [],
								fromSelect: false,
								netManual: true
							}))
						} else if (rec.bottle_no) {
							this.outBottles = [{
								number: normalizeBottleNumber(rec.bottle_no),
								gross: rec.gross_weight_out != null ?
									String(rec.gross_weight_out) : '',
								tare: rec.tare_weight_out != null ?
									String(rec.tare_weight_out) : '',
								net: rec.net_weight_out != null ?
									String(rec.net_weight_out) : '',
								bottleId: rec.bottle_id || null,
								exists: true,
								suggestions: [],
								fromSelect: false,
								netManual: true
							}]
						}

						this.outBottles = (this.outBottles || []).filter(r => !this.isTruckBottle(r.number))

						// 回瓶
						const backItems = rec.back_items || rec.backItems || []
						if (Array.isArray(backItems) && backItems.length) {
							this.backBottles = backItems.map(it => ({
								number: normalizeBottleNumber(it.bottle_no || it.bottleInput || ''),
								gross: it.gross != null ? String(it.gross) : '',
								tare: it.tare != null ? String(it.tare) : '',
								net: it.net != null ? String(it.net) : '',
								bottleId: it.bottle_id || it.bottleId || null,
								exists: true,
								suggestions: [],
								fromSelect: false,
								netManual: true
							}))
						} else if (rec.return_bottle_no) {
							this.backBottles = [{
								number: normalizeBottleNumber(rec.return_bottle_no),
								gross: rec.gross_weight_back != null ?
									String(rec.gross_weight_back) : '',
								tare: rec.tare_weight_back != null ?
									String(rec.tare_weight_back) : '',
								net: rec.net_weight_back != null ?
									String(rec.net_weight_back) : '',
								bottleId: rec.return_bottle_id || null,
								exists: true,
								suggestions: [],
								fromSelect: false,
								netManual: true
							}]
						}

						this.backBottles = (this.backBottles || []).filter(r => !this.isTruckBottle(r.number))
					} else {
						this.outBottles = []
						this.backBottles = []
					}

					// 回瓶处理结束的后面，加上👇这一段

					// 存瓶：优先用新字段，其次兼容老的 deposit_bottles_raw
					const depositRows =
						rec.deposit_rows ||
						rec.deposit_items ||
						rec.depositRows ||
						rec.depositItems ||
						null

					if (this.bizMode === 'bottle') {
						if (Array.isArray(depositRows) && depositRows.length) {
							// 新结构：[{ bottleInput / bottle_no / number, bottleId }]
							const normalized = this.normalizeDepositList(depositRows)
							this.depositBottles = normalized.length ?
								normalized.map(no => this.createDepositRow(normalizeBottleNumber(no))) : [this.createDepositRow()]
						} else if (rec.deposit_bottles_raw) {
							// 老结构：字符串或数组，需要拆分
							const normalized = this.normalizeDepositList(rec.deposit_bottles_raw)
							this.depositBottles = normalized.length ?
								normalized.map(no => this.createDepositRow(normalizeBottleNumber(no))) : [this.createDepositRow()]
						} else {
							// 没有历史存瓶记录，就给一行空输入
							this.depositBottles = [this.createDepositRow()]
						}
						this.depositBottles = (this.depositBottles || []).filter(r => !this.isTruckBottle(r.number))
					} else {
						this.depositBottles = []
						const truckNo = this.buildTruckBottleNo(this.header.car_no)
						if (truckNo) {
							this.truckInfo.bottle_no = truckNo
							this.recalcTruckLossB()
						}
					}

					// 流量模式
					if ((rec.price_unit || rec.priceUnit) === 'm3') {
						this.flowSettle = {
							prev: rec.flow_index_prev != null ? String(rec.flow_index_prev) : '',
							curr: rec.flow_index_curr != null ? String(rec.flow_index_curr) : '',
							volume: rec.flow_volume_m3 != null ? String(rec.flow_volume_m3) : '',
							amount: rec.flow_amount_should != null ?
								String(rec.flow_amount_should) : '',
							amount_received: rec.flow_amount_received != null ?
								String(rec.flow_amount_received) : '',
							payment_status: rec.flow_payment_status || '挂账',
							remark: rec.flow_remark || '',

							flow_index_prev: rec.flow_index_prev,
							flow_index_curr: rec.flow_index_curr,
							flow_volume: rec.flow_volume_m3,
							flow_unit_price: rec.flow_unit_price || rec.unit_price || '',
							flow_amount_should: rec.flow_amount_should,
							flow_amount_received: rec.flow_amount_received,
							flow_payment_status: rec.flow_payment_status || '挂账',
							flow_remark: rec.flow_remark || ''
						}
					}

					if (this.header.customer_id) {
						await this.loadCustomerDeposits(this.header.customer_id)
					}

					// 下拉框索引
					this.syncSelectIndexesFromHeader()
				} catch (err) {
					console.error('loadSaleForEdit error', err)
					uni.showToast({
						title: '加载销售记录失败',
						icon: 'none'
					})
				}
			},

			// 根据 header 同步 picker 选中项
			syncSelectIndexesFromHeader() {
				if (this.header.customer_id && Array.isArray(this.customers)) {
					const idx = this.customers.findIndex(
						c => c._id === this.header.customer_id
					)
					this.customerIndex = idx
				}

				if (Array.isArray(this.deliveryList)) {
					if (this.header.delivery_man_1) {
						const i1 = this.deliveryList.findIndex(
							d => d.name === this.header.delivery_man_1
						)
						this.deliveryIndex1 = i1
					}
					if (this.header.delivery_man_2) {
						const i2 = this.deliveryList.findIndex(
							d => d.name === this.header.delivery_man_2
						)
						this.deliveryIndex2 = i2
					}
				}

				if (this.header.vehicle_id && Array.isArray(this.vehicleList)) {
					const iv = this.vehicleList.findIndex(
						v => v._id === this.header.vehicle_id
					)
					this.vehicleIndex = iv
				}
			},

			// Flow 结算卡片回调
			onFlowSettleChange(next) {
				const merged = {
					...(this.flowSettle || {}),
					...(next || {})
				}

				merged.flow_index_prev = merged.prev
				merged.flow_index_curr = merged.curr
				merged.flow_volume = merged.volume
				merged.flow_amount_should = merged.amount
				merged.flow_amount_received = merged.amount_received
				merged.flow_payment_status = merged.payment_status
				merged.flow_remark = merged.remark
				merged.flow_unit_price = this.header.unit_price

				this.flowSettle = merged
			},

			onUpdateFlowRatio(val) {
				this.flowTheoryRatio = val || 0
			},

			// 统一返回
			goBack() {
				const pages = getCurrentPages()
				if (pages.length > 1) {
					uni.navigateBack()
				} else {
					uni.reLaunch({
						url: '/pages/dashboard/index'
					})
				}
			},

			// 客户选择（picker）
			onCustomerChange(e) {
				const idx = Number(e.detail.value)
				this.customerIndex = idx
				const c = this.customers[idx]
				if (c) {
					this.header.customer_id = c._id
					this.header.customer_name = c.name
					this.loadCustomerDeposits(c._id)
				} else {
					this.header.customer_id = ''
					this.header.customer_name = ''
					this.customerDeposits = []
				}
			},

			// 客户联想输入
			onCustomerInput(e) {
				const val = e.detail.value.trim()
				this.customerKeyword = val

				if (!val) {
					this.customerSuggests = []
					this.header.customer_id = ''
					this.header.customer_name = ''
					return
				}

				const list = (this.customers || []).filter(c => {
					if (!c || !c.name) return false
					return c.name.indexOf(val) !== -1
				})

				this.customerSuggests = list.slice(0, 20)
			},

			onSelectCustomer(item) {
				if (!item) return
				this.header.customer_id = item._id
				this.header.customer_name = item.name
				this.customerKeyword = item.name
				this.customerSuggests = []
				this.loadCustomerDeposits(item._id)
			},

			// 配送员
			onDeliveryChange1(e) {
				const idx = Number(e.detail.value)
				this.deliveryIndex1 = idx
				const d = this.deliveryList[idx]
				this.header.delivery_man_1 = d ? d.name : ''
			},

			onDeliveryChange2(e) {
				const idx = Number(e.detail.value)
				this.deliveryIndex2 = idx
				const d = this.deliveryList[idx]
				this.header.delivery_man_2 = d ? d.name : ''
			},

			// 车辆
			onVehicleChange(e) {
				const idx = Number(e.detail.value)
				this.vehicleIndex = idx
				const v = this.vehicleList[idx]
				if (v) {
					this.header.vehicle_id = v._id || ''
					const plate = v.car_no || v.plate_no || v.plateNo || ''
					this.header.car_no = plate
				} else {
					this.header.vehicle_id = ''
					this.header.car_no = ''
				}
			},

			// 重置（保留日期/业务模式/计价单位）
			resetForm() {
				const today = this.header.date
				const curBizMode = this.bizMode || 'bottle'
				const curPaymentStatus = this.header.payment_status || '挂账'
				const curPriceUnit = this.header.price_unit || 'kg'

				this.header = {
					date: today,
					customer_id: '',
					customer_name: '',
					delivery_man_1: '',
					delivery_man_2: '',
					vehicle_id: '',
					car_no: '',
					unit_price: '',
					price_unit: curPriceUnit,
					amount_received: '',
					payment_status: curPaymentStatus,
					remark: '',
					biz_mode: curBizMode,
					truck_gross: '',
					truck_tare: '',
					truck_net: '',
					truck_loss_b: ''
				}

				this.truckNetManual = false
				this.truckInfo = {
					bottle_no: '',
					fill_net: '',
					out_net: '',
					back_net: '',
					loss_a: '',
					loss_b: ''
				}
				this.truckLossBTouched = false
				this.flowTheoryRatio = this.defaultRatio
				this.flowSettle = {
					prev: '',
					curr: '',
					volume: '',
					amount: '',
					amount_received: '',
					payment_status: '挂账',
					remark: '',
					flow_index_prev: '',
					flow_index_curr: '',
					flow_volume: '',
					flow_unit_price: '',
					flow_amount_should: '',
					flow_amount_received: '',
					flow_payment_status: '挂账',
					flow_remark: ''
				}

				this.customerIndex = -1
				this.deliveryIndex1 = -1
				this.deliveryIndex2 = -1
				this.vehicleIndex = -1

				this.customerDeposits = []
				this.outBottles = [{
					number: '',
					gross: '',
					tare: '',
					net: '',
					bottleId: null,
					exists: null,
					suggestions: [],
					fromSelect: false,
					netManual: false
				}]

				this.backBottles = [{
					number: '',
					gross: '',
					tare: '',
					net: '',
					bottleId: null,
					exists: null,
					suggestions: [],
					fromSelect: false,
					netManual: false
				}]

				this.depositBottles = [this.createDepositRow()]
			},

			// 整车净重
			updateTruckNet() {
				if (this.truckNetManual) return

				const g = Number(this.header.truck_gross)
				const t = Number(this.header.truck_tare)
				if (!isNaN(g) && !isNaN(t)) {
					this.header.truck_net = (g - t).toFixed(2)
				} else {
					this.header.truck_net = ''
				}
			},

			onTruckWeightBlur() {
				if (this.truckLossBTouched) return
				const g = Number(this.truckInfo.gross_ton)
				const t = Number(this.truckInfo.tare_ton)
				if (Number.isFinite(g) && Number.isFinite(t)) {
					this.truckInfo.net_ton = (g - t).toFixed(2)
				}
			},

			onTruckFillInput() {
				if (!this.truckLossBTouched) {
					this.recalcTruckLossB()
				}
			},

			onTruckNetSaleInput() {
				this.recalcTruckLossB()
			},

			onTruckBackNetInput(e) {
				this.truckInfo.back_net = e.detail.value
				this.truckLossBTouched = false
				this.recalcTruckLossB()
			},

			// 瓶号模糊搜索
			async searchBottle(keyword) {
				const key = keyword.trim()
				if (!key) return []

				if (this.bottleSearchCache[key]) {
					return this.bottleSearchCache[key]
				}

				if (this.bottleSearchPending[key]) {
					return this.bottleSearchPending[key]
				}

				const token = getToken()

				const req = uniCloud
					.callFunction({
						name: 'crm-bottle',
						data: {
							action: 'search',
							token,
							data: {
								keyword: key,
								limit: 20,
								include_truck: key.toUpperCase().startsWith('TRUCK-')
							}
						}
					})
					.then(res => {
						const list = res.result?.data || []
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

			async doBottleSuggest(type, index, keyword) {
				const list = await this.searchBottle(keyword)

				let rows =
					type === 'out' ?
					this.outBottles :
					type === 'back' ?
					this.backBottles :
					this.depositBottles

				const row = rows[index]
				if (!row) return

				if (row.number.trim() !== keyword.trim()) return

				this.$set(row, 'suggestions', list)
			},

			// 加载基础数据
			async loadCustomers() {
				try {
					const token = getToken()
					const res = await uniCloud.callFunction({
						name: 'crm-customer',
						data: {
							action: 'list',
							token,
							data: {}
						}
					})
					if (this.handleAuthError(res)) return
					if (res.result?.code === 0) {
						this.customers = res.result.data || []
						this.syncSelectIndexesFromHeader()
					}
				} catch (e) {
					console.error('加载客户异常', e)
				}
			},

			async loadCustomerDeposits(customerId) {
				this.customerDeposits = []
				if (!customerId) {

					return
				}
				try {
					const token = getToken()
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
						// const normalized = this.normalizeDepositList(res.result.data)
						// this.depositBottles = normalized.length
						//   ? normalized.map(no => this.createDepositRow(no))
						//   : [this.createDepositRow()]
					}
				} catch (err) {
					console.error('loadCustomerDeposits error', err)
				}
			},

			async loadLastFlowIndexForCustomer(customerId) {
				if (!customerId) return

				try {
					const token = getToken()
					const res = await uniCloud.callFunction({
						name: 'crm-sale',
						data: {
							action: 'getLastFlowRecord',
							token,
							data: {
								customerId
							}
						}
					})

					if (this.handleAuthError(res)) return

					const last = res.result?.data
					if (last && last.flowIndexCurr != null) {
						const v = last.flowIndexCurr
						this.flowSettle.flow_index_prev = v
						this.flowSettle.prev = v
					} else {
						this.flowSettle.flow_index_prev = ''
						this.flowSettle.prev = ''
					}
				} catch (err) {
					console.error('loadLastFlowIndexForCustomer error', err)
				}
			},

			async loadDeliveryList() {
				try {
					const token = getToken()
					const res = await uniCloud.callFunction({
						name: 'crm-delivery',
						data: {
							action: 'list',
							token,
							data: {}
						}
					})
					if (this.handleAuthError(res)) return
					if (res.result?.code === 0) {
						this.deliveryList = res.result.data || []
						this.syncSelectIndexesFromHeader()
					}
				} catch (e) {
					console.error('加载配送员异常', e)
				}
			},

			async loadVehicles() {
				try {
					const token = getToken()
					const res = await uniCloud.callFunction({
						name: 'crm-vehicle',
						data: {
							action: 'list',
							token,
							data: {}
						}
					})
					if (this.handleAuthError(res)) return
					if (res.result?.code === 0) {
						this.vehicleList = res.result.data || []
						this.syncSelectIndexesFromHeader()
					}
				} catch (e) {
					console.error('加载车辆异常', e)
				}
			},

			// 表单事件
			onDateChange(e) {
				this.header.date = e.detail.value
			},

			onPriceUnitChange(e) {
				const idx = Number(e.detail.value)
				this.priceUnitIndex = idx
				if (idx === 0) {
					this.header.price_unit = 'kg'
				} else if (idx === 1) {
					this.header.price_unit = 'bottle'
				} else {
					this.header.price_unit = 'm3'
				}
			},

			onPaymentStatusChange(e) {
				const idx = Number(e.detail.value)
				this.paymentStatusIndex = idx
				this.header.payment_status = this.paymentStatusOptions[idx]
			},

			// 出瓶
			addOutBottleRow() {
				this.outBottles.push({
					number: '',
					gross: '',
					tare: '',
					net: '',
					bottleId: null,
					exists: null,
					suggestions: [],
					fromSelect: false,
					netManual: false
				})
			},

			removeOutBottleRow(idx) {
				if (this.outBottles.length <= 1) return
				const removed = this.outBottles[idx].number?.trim()
				this.outBottles.splice(idx, 1)

			},

			async onOutBottleInput(index, e) {
				const val = e.detail.value.trim()
				const row = this.outBottles[index]

				if (this.bizMode === 'bottle' && this.isTruckBottle(val)) {
					row.number = ''
					uni.showToast({
						title: '瓶装模式不支持 TRUCK 瓶号',
						icon: 'none'
					})
					return
				}

				row.number = val
				row.fromSelect = false
				row.exists = null
				row.bottleId = null

				if (!val) {
					row.suggestions = []
					return
				}

				if (this.isTruckBottle(val)) {
					row.suggestions = []
					return
				}

				this.debouncedBottleSuggest('out', index, val)
			},

			onSelectOutBottle(index, item) {
				const row = this.outBottles[index]
				row.number = item.number
				row.tare =
					item.tare_weight != null ? String(item.tare_weight) : row.tare
				row.bottleId = item._id
				row.exists = true
				row.fromSelect = true
				row.suggestions = []
				row.netManual = false
				this.updateOutNet(index)
			},

			async onOutBottleBlur(index) {
				const row = this.outBottles[index]
				const no = row.number.trim()
				if (!no) return
				if (this.isTruckBottle(no)) {
					return
				}

				if (row.suggestions.length && !row.fromSelect) return
				if (row.fromSelect) return

				try {
					const token = getToken()
					const res = await uniCloud.callFunction({
						name: 'crm-bottle',
						data: {
							action: 'getByNumber',
							token,
							data: {
								number: no
							}
						}
					})

					if (this.handleAuthError(res)) return

					const found = res.result?.data
					if (found) {
						row.exists = true
						row.bottleId = found._id
						if (!row.tare && found.tare_weight != null) {
							row.tare = String(found.tare_weight)
						}
						row.netManual = false
						this.updateOutNet(index)
					} else {
						row.exists = false
						row.bottleId = null
						uni.showModal({
							title: '提示',
							content: `系统中不存在瓶号 ${no}。\n保存时会自动加入瓶子库，请记得填写皮重。`,
							showCancel: false
						})
					}
				} catch (err) {
					console.error('check bottle error', err)
				}
			},

			updateOutNet(index) {
				const row = this.outBottles[index]
				if (row.netManual) return

				const g = Number(row.gross)
				const t = Number(row.tare)
				if (!isNaN(g) && !isNaN(t)) {
					row.net = (g - t).toFixed(2)
				}
			},

			// 回瓶
			addBackBottleRow() {
				this.backBottles.push({
					number: '',
					gross: '',
					tare: '',
					net: '',
					bottleId: null,
					exists: null,
					suggestions: [],
					fromSelect: false,
					netManual: false
				})
			},

			removeBackBottleRow(i) {
				if (this.backBottles.length <= 1) return
				this.backBottles.splice(i, 1)
			},

			async onBackBottleInput(i, e) {
				const val = e.detail.value.trim()
				const row = this.backBottles[i]

				if (this.bizMode === 'bottle' && this.isTruckBottle(val)) {
					row.number = ''
					uni.showToast({
						title: '瓶装模式不支持 TRUCK 瓶号',
						icon: 'none'
					})
					return
				}

				row.number = val
				row.fromSelect = false
				row.exists = null
				row.bottleId = null

				if (!val) {
					row.suggestions = []
					return
				}

				if (this.isTruckBottle(val)) {
					row.suggestions = []
					return
				}

				this.debouncedBottleSuggest('back', i, val)
			},

			onSelectBackBottle(i, item) {
				const row = this.backBottles[i]
				row.number = item.number
				row.tare =
					item.tare_weight != null ? String(item.tare_weight) : row.tare
				row.bottleId = item._id
				row.exists = true
				row.fromSelect = true
				row.suggestions = []
				row.netManual = false
				this.updateBackNet(i)
			},

			async onBackBottleBlur(i) {
				const row = this.backBottles[i]
				const no = row.number.trim()
				if (!no) return
				if (this.isTruckBottle(no)) {
					this.recalcTruckLossB()
					return
				}

				if (row.suggestions.length && !row.fromSelect) return
				if (row.fromSelect) return

				try {
					const token = getToken()
					const res = await uniCloud.callFunction({
						name: 'crm-bottle',
						data: {
							action: 'getByNumber',
							token,
							data: {
								number: no
							}
						}
					})

					if (this.handleAuthError(res)) return

					const found = res.result?.data
					if (found) {
						row.exists = true
						row.bottleId = found._id
						if (!row.tare && found.tare_weight != null) {
							row.tare = String(found.tare_weight)
						}
						row.netManual = false
						this.updateBackNet(i)
					} else {
						row.exists = false
						row.bottleId = null
						uni.showModal({
							title: '提示',
							content: `系统中不存在瓶号 ${no}。\n保存时会自动加入瓶子库，请记得填写皮重。`,
							showCancel: false
						})
					}
				} catch (err) {
					console.error('check back bottle error', err)
				}
			},

			onBackNetManualInput(index) {
				const row = this.backBottles[index]
				row.netManual = true
				if (this.bizMode === 'truck' && this.isTruckBottle(row.number)) {
					this.truckLossBTouched = false
					this.recalcTruckLossB()
				}
			},

			updateBackNet(i) {
				const row = this.backBottles[i]
				if (row.netManual) {
					if (this.bizMode === 'truck' && this.isTruckBottle(row.number)) {
						this.recalcTruckLossB()
					}
					return
				}

				const g = Number(row.gross)
				const t = Number(row.tare)
				if (!isNaN(g) && !isNaN(t)) {
					row.net = (g - t).toFixed(2)
				} else {
					row.net = ''
				}

				if (this.bizMode === 'truck' && this.isTruckBottle(row.number)) {
					this.recalcTruckLossB()
				}
			},

			// 存瓶
			addDepositBottleRow() {
				this.depositBottles.push(this.createDepositRow())
			},

			removeDepositBottleRow(i) {
				if (this.depositBottles.length <= 1) return

				this.depositBottles.splice(i, 1)

			},

			async onDepositBottleInput(i, e) {
				const val = e.detail.value.trim()
				const row = this.depositBottles[i]

				if (this.bizMode === 'bottle' && this.isTruckBottle(val)) {
					row.number = ''
					uni.showToast({
						title: '瓶装模式不支持 TRUCK 瓶号',
						icon: 'none'
					})
					return
				}

				row.number = val
				row.fromSelect = false
				row.exists = null
				row.bottleId = null

				if (!val) {
					row.suggestions = []
					return
				}

				this.debouncedBottleSuggest('deposit', i, val)
			},

			onSelectDepositBottle(i, item) {
				const row = this.depositBottles[i]
				row.number = item.number
				row.bottleId = item._id
				row.exists = true
				row.fromSelect = true
				row.suggestions = []
			},

			async onDepositBottleBlur(i) {
				const row = this.depositBottles[i]
				const no = row.number.trim()
				if (!no) return

				if (row.suggestions.length && !row.fromSelect) return
				if (row.fromSelect) return

				try {
					const token = getToken()
					const res = await uniCloud.callFunction({
						name: 'crm-bottle',
						data: {
							action: 'getByNumber',
							token,
							data: {
								number: no
							}
						}
					})

					if (this.handleAuthError(res)) return

					const found = res.result?.data
					if (found) {
						row.exists = true
						row.bottleId = found._id
					} else {
						row.exists = false
						row.bottleId = null
						uni.showModal({
							title: '提示',
							content: `系统中不存在瓶号 ${no}，\n保存时会自动加入瓶子库，后续可在瓶子管理中补充皮重等信息。`,
							showCancel: false
						})
					}
				} catch (err) {
					console.error('check deposit bottle error', err)
				}
			},

			createDepositRow(no = '') {
				return {
					number: no,
					bottleId: null,
					exists: null,
					suggestions: [],
					fromSelect: false
				}
			},

			createEmptyBottleRow() {
				return {
					number: '',
					gross: '',
					tare: '',
					net: '',
					bottleId: null,
					exists: null,
					suggestions: [],
					fromSelect: false,
					netManual: false
				}
			},

			async ensureNewBottlesCreated() {
				const token = getToken()
				if (!token) return false
				const tasks = []

				if (this.bizMode === 'truck') {
					const truckNo = this.truckBottleNo
					if (!truckNo) return true
					tasks.push(uniCloud.callFunction({
						name: 'crm-bottle',
						data: {
							action: 'quickCreate',
							token,
							data: {
								number: truckNo,
								status: 'in_station'
							}
						}
					}))
					try {
						await Promise.all(tasks)
						return true
					} catch (e) {
						console.error('ensureNewBottlesCreated truck quickCreate error', e)
						uni.showToast({
							title: '自动创建整车瓶失败',
							icon: 'none'
						})
						return false
					}
				}

				const quickCreate = (number, tare, status) => {
					const data = {
						number
					}
					if (status) {
						data.status = status
					}
					if (typeof tare === 'number' && !Number.isNaN(tare)) {
						data.tare_weight = tare
					}

					return uniCloud.callFunction({
						name: 'crm-bottle',
						data: {
							action: 'quickCreate',
							token,
							data
						}
					})
				}

				const checkAndMaybeCreate = async (row, withWeight, status) => {
					if (!row || !row.number) return

					let no = String(row.number).trim()
					if (!no) return

					const normalizedTruck = this.normalizeTruckBottleNo(no, this.header.car_no)
					if (normalizedTruck) {
						no = normalizedTruck
						row.number = normalizedTruck
					}

					const isTruck = this.isTruckBottle(no)
					const allowMissingTare = isTruck
					const createStatus = isTruck ? 'in_station' : status

					let tareNum = null
					let hasTare = false
					if (withWeight) {
						const t = Number(row.tare)
						if (!Number.isNaN(t)) {
							tareNum = t
							hasTare = true
						}
					}

					const needTare = withWeight && !allowMissingTare

					const pushCreate = () => {
						tasks.push(quickCreate(no, withWeight && !allowMissingTare ? tareNum : undefined, createStatus))
					}

					if (row.exists === false) {
						if (needTare && !hasTare) {
							return
						}
						pushCreate()
						return
					}

					if (row.exists == null) {
						try {
							const res = await uniCloud.callFunction({
								name: 'crm-bottle',
								data: {
									action: 'getByNumber',
									token,
									data: {
										number: no
									}
								}
							})

							if (this.handleAuthError(res)) return

							const found = res.result && res.result.data

							if (found && found._id) {
								row.exists = true
								row.bottleId = found._id
								return
							}

							if (needTare && !hasTare) {
								return
							}

							pushCreate()
							row.exists = false
						} catch (err) {
							console.error('ensureNewBottlesCreated getByNumber error', err)
						}
					}
				}

				for (const row of this.outBottles) {
					await checkAndMaybeCreate(row, true, 'at_customer')
				}
				for (const row of this.backBottles) {
					await checkAndMaybeCreate(row, true, 'in_station')
				}

				if (Array.isArray(this.depositBottles)) {
					for (const row of this.depositBottles) {
						await checkAndMaybeCreate(row, false, 'at_customer')
					}
				}

				if (!tasks.length) {
					return true
				}

				try {
					await Promise.all(tasks)
					return true
				} catch (e) {
					console.error('ensureNewBottlesCreated quickCreate error', e)
					uni.showToast({
						title: '自动创建瓶子失败',
						icon: 'none'
					})
					return false
				}
			},

			validateBeforeSubmit() {
				if (!this.header.date) {
					uni.showToast({
						title: '请选择日期',
						icon: 'none'
					})
					return false
				}

				const customerName = (this.header.customer_name || '').trim()
				if (!this.header.customer_id && !customerName) {
					uni.showToast({
						title: '请选择客户',
						icon: 'none'
					})
					return false
				}
				if (customerName.length > 50) {
					uni.showToast({
						title: '客户名称过长',
						icon: 'none'
					})
					return false
				}

				const priceVal = this.header.unit_price
				if (priceVal !== '' && (isNaN(Number(priceVal)) || Number(priceVal) < 0)) {
					uni.showToast({
						title: '请填写正确的单价',
						icon: 'none'
					})
					return false
				}

				if (this.bizMode === 'truck') {
					const gross = Number(this.header.truck_gross)
					const tare = Number(this.header.truck_tare)
					if (!this.truckBottleNo) {
						uni.showToast({
							title: '请选择车辆生成整车瓶号',
							icon: 'none'
						})
						return false
					}
					if (isNaN(gross) || isNaN(tare)) {
						uni.showToast({
							title: '请完善整车毛重/皮重',
							icon: 'none'
						})
						return false
					}
					if (gross <= tare) {
						uni.showToast({
							title: '毛重需大于皮重',
							icon: 'none'
						})
						return false
					}
					return true
				}

				const hasTruckBottle =
					this.outBottles.some(r => this.isTruckBottle(r.number)) ||
					this.backBottles.some(r => this.isTruckBottle(r.number)) ||
					this.depositBottles.some(r => this.isTruckBottle(r.number))
				if (hasTruckBottle) {
					uni.showToast({
						title: '瓶装模式不支持 TRUCK 瓶号',
						icon: 'none'
					})
					return false
				}

				const hasBottle = this.outBottles.some(r => r.number && r.number.trim())
				if (!hasBottle && this.header.price_unit !== 'm3') {
					uni.showToast({
						title: '请至少录入一个出瓶瓶号',
						icon: 'none'
					})
					return false
				}

				const weightFields = ['gross', 'tare', 'net']
				const checkRows = [...this.outBottles, ...this.backBottles]
				for (const row of checkRows) {
					for (const key of weightFields) {
						const val = row[key]
						if (val === '' || val == null) continue
						if (isNaN(Number(val))) {
							uni.showToast({
								title: '重量字段需为数字',
								icon: 'none'
							})
							return false
						}
					}
				}

				return true
			},

			async handleSubmit() {
				if (!this.validateBeforeSubmit()) return

				const ok = await this.ensureNewBottlesCreated()
				if (!ok) return

				const token = getToken()
				const customerName = (this.header.customer_name || '').trim()
				this.header.customer_name = customerName

				let unitPrice = this.header.unit_price
				if (this.header.price_unit === 'm3' && this.flowSettle.flow_unit_price) {
					unitPrice = this.flowSettle.flow_unit_price
				}

				let amountReceived = this.header.amount_received
				let paymentStatus = this.header.payment_status
				if (this.header.price_unit === 'm3') {
					if (this.flowSettle.flow_amount_received !== '') {
						amountReceived = this.flowSettle.flow_amount_received
					}
					if (this.flowSettle.flow_payment_status) {
						paymentStatus = this.flowSettle.flow_payment_status
					}
				}

				const base = {
					date: this.header.date,
					customerId: this.header.customer_id,
					customerName,
					unitPrice,
					priceUnit: this.header.price_unit,
					delivery1: this.header.delivery_man_1,
					delivery2: this.header.delivery_man_2,

					vehicleId: this.header.vehicle_id,
					car_no: this.header.car_no,

					remark: this.header.remark,
					amountReceived,
					paymentStatus,
					paymentNote: '',

					bizMode: this.bizMode,
					truckGross: this.header.truck_gross,
					truckTare: this.header.truck_tare,
					truckNet: this.header.truck_net,
					truck_fill_net: this.truckInfo.fill_net,
					truck_loss_b: this.truckInfo.loss_b,

					flow_theory_ratio: this.flowTheoryRatio
				}

				if (this.header.price_unit === 'm3') {
					Object.assign(base, {
						flow_index_prev: this.flowSettle.flow_index_prev,
						flow_index_curr: this.flowSettle.flow_index_curr,
						flow_volume: this.flowSettle.flow_volume,
						flow_unit_price: this.flowSettle.flow_unit_price,
						flow_amount_should: this.flowSettle.flow_amount_should,
						flow_amount_received: this.flowSettle.flow_amount_received,
						flow_payment_status: this.flowSettle.flow_payment_status,
						flow_remark: this.flowSettle.flow_remark
					})
				}

				const outRows = this.outBottles.map(r => ({
					bottleInput: r.number.trim(),
					gross: r.gross,
					tare: r.tare,
					net: r.net,
					bottleId: r.bottleId
				}))

				const backRows = this.backBottles.map(r => ({
					bottleInput: r.number.trim(),
					gross: r.gross,
					tare: r.tare,
					net: r.net,
					bottleId: r.bottleId
				}))

				const depositIdMap = new Map(
					(this.depositBottles || [])
					.map(r => [(r.number || '').trim(), r.bottleId || null])
					.filter(([no]) => !!no)
				)

				const depositRows = this.liveDeposits.map(no => ({
					bottleInput: no,
					bottleId: depositIdMap.get(no) || null
				}))

				const payload = {
					base,
					outRows,
					backRows,
					depositRows,
					source: 'manual-v2'
				}

				if (this.bizMode === 'truck') {
					payload.truck_info = {
						bottle_no: this.truckBottleNo,
						fill_net: this.truckInfo.fill_net,
						out_net: this.truckInfo.out_net,
						back_net: this.truckInfo.back_net,
						loss_a: this.header.truck_net && this.truckInfo.out_net ? (Number(this.truckInfo.fill_net) - Number(this.header.truck_net)).toFixed(2) : '',
						loss_b: this.truckInfo.loss_b
					}
					payload.outRows = []
					payload.backRows = []
					payload.depositRows = []
				}

				const action = this.isEditing ? 'updateV2' : 'createV2'
				const data = this.isEditing ? {
					action,
					token,
					data: {
						id: this.editId,
						...payload
					}
				} : {
					action,
					token,
					data: payload
				}

				this.submitting = true
				try {
					const res = await uniCloud.callFunction({
						name: 'crm-sale',
						data
					})

					if (this.handleAuthError(res)) return

					if (res.result?.code === 0) {
						uni.showToast({
							title: res.result.msg || (this.isEditing ? '修改已保存' : '保存成功'),
							icon: 'success',
							duration: 2000
						})

						if (this.isEditing) {
							setTimeout(() => {
								this.goBack()
							}, 500)
						} else {
							this.resetForm && this.resetForm()
						}
					} else {
						uni.showToast({
							title: res.result?.msg || '保存失败',
							icon: 'none'
						})
					}
				} catch (e) {
					uni.showToast({
						title: '请求异常',
						icon: 'none'
					})
				} finally {
					this.submitting = false
				}
			}
		}
	}
</script>

<style scoped>
	.sale-page {
		min-height: 100vh;
		background-color: #f2f4f9;
		padding: 24rpx 16rpx 40rpx;
		box-sizing: border-box;
	}

	.sale-inner {
		width: 100%;
		max-width: 1800rpx;
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

	/* 卡片容器：横向布局用 */
	.card-row {
		display: flex;
		flex-direction: column;
		gap: 20rpx;
		margin-bottom: 20rpx;
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

	/* 行布局 */
	.form-row {
		display: flex;
		flex-wrap: wrap;
		margin: 0 -8rpx;
	}

	.form-row .form-item {
		padding: 0 8rpx;
	}

	.col {
		width: 100%;
	}

	.col-half {
		width: 100%;
	}

	/* 三等分布局 */
	.col-third {
		width: 100%;
	}

	@media (min-width: 768px) {
		.col {
			width: 33.33%;
		}

		.col-half {
			width: 50%;
		}

		@media (min-width: 1024px) {
			.col-third {
				width: 33.33%;
			}
		}

		.card-row {
			flex-direction: row;
		}

		.card-row .card {
			flex: 1;
			margin-bottom: 0;
		}
	}

	/* 标签与输入控件 */
	.form-item {
		margin-bottom: 18rpx;
	}

	.label {
		display: block;
		font-size: 26rpx;
		margin-bottom: 6rpx;
		color: #555;
	}

	/* 统一输入外壳 */
	.input-wrapper {
		width: 100%;
		height: 88rpx;
		background: #ffffff;
		border-radius: 20rpx;
		box-sizing: border-box;
		border: 1rpx solid #e0e0e0;
		padding: 0 20rpx;
		display: flex;
		align-items: center;
		box-shadow: 0 10rpx 24rpx rgba(16, 46, 90, 0.04);
	}

	/* 纯输入框 */
	.input {
		flex: 1;
		height: 100%;
		box-sizing: border-box;
		border: none;
		background: transparent;
		font-size: 28rpx;
		color: #222;
	}

	/* picker 外观 */
	.picker {
		flex: 1;
		height: 100%;
		display: flex;
		align-items: center;
		box-sizing: border-box;
		font-size: 28rpx;
		color: #222;
	}

	/* 左右双输入（单价 & 单位） */
	.dual-input {
		display: flex;
		align-items: center;
	}

	.dual-left {
		flex: 2;
		margin-right: 10rpx;
	}

	.dual-right {
		flex: 3;
		margin-left: 10rpx;
	}

	/* 备注 */
	.textarea {
		width: 100%;
		min-height: 140rpx;
		padding: 16rpx 24rpx;
		box-sizing: border-box;
		border-radius: 18rpx;
		border: 1rpx solid #e0e0e0;
		background: #ffffff;
		font-size: 28rpx;
		color: #222;
	}

	/* 出瓶 / 回瓶 / 存瓶行 */
	.bottle-row {
		margin-bottom: 18rpx;
	}

	.row-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 6rpx;
	}

	.delete-text {
		font-size: 24rpx;
		color: #f56c6c;
	}

	.row-divider {
		height: 1rpx;
		background-color: #f0f0f0;
		margin: 12rpx 0 8rpx;
	}

	/* 候选瓶号 */
	.bottle-suggest {
		margin-top: 8rpx;
		border-radius: 16rpx;
		background: #f7f8fc;
		padding: 8rpx 6rpx;
	}

	.suggest-item {
		padding: 8rpx 12rpx;
		border-radius: 12rpx;
		display: flex;
		justify-content: space-between;
		font-size: 24rpx;
	}

	.suggest-item+.suggest-item {
		margin-top: 4rpx;
	}

	.suggest-no {
		color: #333;
	}

	.suggest-sub {
		color: #9aa0b2;
	}

	/* 合计/摘要 chips */
	.summary-chip {
		margin-top: 12rpx;
		padding: 12rpx 16rpx;
		border-radius: 18rpx;
		background: #f7f8fc;
		display: flex;
		flex-direction: column;
	}

	.summary-chip-column {
		margin-top: 10rpx;
		padding: 12rpx 16rpx;
		border-radius: 18rpx;
		background: #f7f8fc;
	}

	.summary-line {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		margin-bottom: 6rpx;
	}

	.summary-label {
		font-size: 24rpx;
		color: #6b7280;
	}

	.summary-value {
		font-size: 26rpx;
		color: #111827;
		margin-left: 8rpx;
	}

	.summary-label-strong {
		font-size: 26rpx;
		color: #374151;
		font-weight: 600;
	}

	.summary-value-strong {
		font-size: 30rpx;
		font-weight: 700;
		color: #111827;
		margin-left: 8rpx;
	}

	.summary-tip {
		font-size: 22rpx;
		color: #9ca3af;
		margin-left: 6rpx;
	}

	/* 公式行 */
	.summary-formula {
		font-size: 26rpx;
		color: #111827;
		font-weight: 600;
	}

	.summary-positive {
		color: #059669;
	}

	.summary-negative {
		color: #dc2626;
	}

	/* 按钮区域 */
	.btn-row-inline {
		margin-top: 6rpx;
		margin-bottom: 4rpx;
	}

	.btn-row-bottom {
		margin-top: 16rpx;
		margin-bottom: 40rpx;
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

	.btn-primary {
		background: linear-gradient(135deg, #2979ff, #1a98ff);
		color: #ffffff;
		box-shadow: 0 14rpx 30rpx rgba(26, 120, 255, 0.32);
	}

	/* 基础信息卡片：强制两列横向布局，减少整体高度 */
	.card-basic .form-row {
		flex-wrap: nowrap;
	}

	.card-basic .col-half {
		width: 50%;
	}

	.card-basic .form-item {
		margin-bottom: 14rpx;
	}

	.deposit-inventory {
		background: #f8fafc;
		border: 1rpx solid #e5e7eb;
		border-radius: 12rpx;
		padding: 12rpx;
		margin-bottom: 14rpx;
	}

	.inventory-label {
		font-size: 24rpx;
		color: #4b5563;
	}

	.inventory-list {
		display: flex;
		flex-wrap: wrap;
		gap: 10rpx;
		margin-top: 8rpx;
	}

	.inventory-chip {
		padding: 6rpx 12rpx;
		border-radius: 999rpx;
		background: linear-gradient(135deg, #dbeafe, #eff6ff);
		color: #1d4ed8;
		font-size: 24rpx;
	}

	/* 顶部右侧区域 */
	.page-header-right {
		display: flex;
		align-items: center;
		gap: 16rpx;
	}

	/* 返回按钮（如果用得上） */
	.btn-back {
		padding: 8rpx 18rpx;
		border-radius: 999rpx;
		background: rgba(244, 247, 255, 0.9);
		border: 1rpx solid rgba(212, 220, 255, 0.9);
		display: flex;
		align-items: center;
	}

	.back-arrow {
		font-size: 26rpx;
		color: #4d5cff;
		margin-right: 4rpx;
	}

	.back-text {
		font-size: 24rpx;
		color: #4d5cff;
	}
</style>
