<template>
	<view class="bottle-page">
		<view class="bottle-inner">
			<BackToDashboardBar />
			<view class="page-header">
				<view class="page-header-left">
					<view class="page-icon">
						<text class="page-icon-text">瓶</text>
					</view>
					<view class="page-header-text">
						<text class="page-title">瓶子管理</text>
						<text class="page-sub">
							维护瓶子的皮重、状态与备注，支持按瓶号快速搜索
						</text>
					</view>
				</view>
				<view class="page-header-right">
					<view class="tag-soft">
						<text class="tag-dot"></text>
						<text class="tag-text">共 {{ total }} 只瓶子</text>
					</view>
				</view>
			</view>

			<!-- 卡片：筛选 -->
			<view class="card">
				<view class="card-header">
					<text class="card-title">筛选</text>
				</view>
				<view class="card-body">
					<view class="form-row">
						<!-- 瓶号关键字 -->
						<view class="form-item col-half">
							<text class="label">瓶号关键字</text>
							<view class="input-wrapper">
								<input class="input" placeholder="例如：J2 / 20，支持前缀匹配" v-model="keyword"
									@confirm="onSearch" />
							</view>
						</view>

						<!-- 状态 -->
						<view class="form-item col-half">
							<text class="label">状态</text>
							<picker mode="selector" :range="statusOptions" range-key="label" :value="statusPickerIndex"
								@change="onStatusChange">
								<view class="input-wrapper">
									<view class="picker">
										<text>{{ statusFilterLabel }}</text>
									</view>
								</view>
							</picker>
						</view>
					</view>

					<view class="btn-row-inline">
						<button class="btn-soft" @click="resetFilter">重置</button>
						<button class="btn-primary" @click="onSearch">查询</button>
					</view>
				</view>
			</view>

			<!-- 卡片：列表 -->
			<view class="card">
				<view class="card-header">
					<text class="card-title">瓶子列表</text>
					<view class="card-header-right">
						<!-- 只有管理员可以新增瓶子 -->
						<button v-if="isAdmin" class="btn-soft" @click="openCreate">
							+ 新增瓶子
						</button>
					</view>
				</view>
				<view class="card-body">
					<view v-if="loading" class="list-empty">
						<text class="empty-text">加载中...</text>
					</view>

					<view v-else-if="!list.length" class="list-empty">
						<text class="empty-text">暂无数据</text>
					</view>

					<view v-else>
						<view v-for="item in list" :key="item._id" class="bottle-item" @click="goDetail(item)">
							<view class="bottle-main">
								<!-- 行 1：瓶号 + 状态 pill -->
								<view class="bottle-line">
									<text class="bottle-no">瓶号：{{ item.number }}</text>
									<view style="display:flex;align-items:center;gap:10rpx;">
										<view v-if="item.kind === 'truck'" class="tag-truck">
											<text>整车</text>
										</view>
										<view class="status-pill" :class="'status-' + (item.status || 'unknown')">
											<text class="status-dot"></text>
											<text class="status-text">
												{{ statusTextMap[item.status] || '未维护' }}
											</text>
										</view>
									</view>
								</view>

								<!-- 行 2：铭牌皮重 + 上次回瓶净重 -->
								<view class="bottle-line">
									<text class="bottle-meta">
										铭牌皮重：
										{{
                      item.tare_weight != null
                        ? item.tare_weight + ' kg'
                        : '—'
                    }}
									</text>
									<text class="bottle-meta" :class="{ 'danger-text': isReturnAnomaly(item) }">
										上次回瓶净重：{{ effectiveLastBackNet(item) }}
									</text>
								</view>

								<!-- 行 3：最近灌装 + 上次客户 -->
								<view class="bottle-line">
									<text class="bottle-meta">
										最近灌装：
										{{
                      item.last_fill_date
                        ? item.last_fill_date +
                          ' · ' +
                          (item.last_fill_net != null
                            ? item.last_fill_net + ' kg'
                            : '—')
                        : '—'
                    }}
									</text>
									<text class="bottle-meta">
										上次客户：{{ item.last_customer_name || '—' }}
									</text>
								</view>
							</view>

							<!-- 只有管理员看到编辑/删除按钮 -->
							<view v-if="isAdmin" class="bottle-actions" @click.stop>
								<button class="btn-mini" @click="openEdit(item)">编辑</button>
								<button class="btn-mini btn-danger" @click="removeItem(item)">
									删除
								</button>
							</view>
						</view>

						<!-- 分页 -->
						<view class="pagination">
							<button class="btn-mini" :disabled="page <= 1" @click="changePage(-1)">
								上一页
							</button>
							<text class="page-info">
								第 {{ page }} / {{ pageCount || 1 }} 页
							</text>
							<button class="btn-mini" :disabled="page >= pageCount" @click="changePage(1)">
								下一页
							</button>
						</view>
					</view>
				</view>
			</view>

			<!-- 弹层：新增 / 编辑（只有管理员能通过代码打开） -->
			<view v-if="showEditDialog" class="dialog-mask" @click.self="closeDialog">
				<view class="dialog-body">
					<view class="dialog-header">
						<text class="dialog-title">
							{{ editMode === 'create' ? '新增瓶子' : '编辑瓶子' }}
						</text>
					</view>
					<view class="dialog-content">
                                                <view class="form-item">
                                                        <text class="label">* 瓶号</text>
                                                        <view class="input-wrapper">
                                                                <input
                                                                        class="input"
                                                                        placeholder="例如：201 / J201"
                                                                        :value="editForm.number"
                                                                        maxlength="20"
                                                                        @input="onBottleNumberInput"
                                                                />
                                                        </view>
                                                </view>
						<view class="form-item">
							<text class="label">类型</text>
							<picker
								mode="selector"
								:range="kindOptions"
								range-key="label"
								:value="kindPickerIndex"
								@change="onKindChange"
							>
								<view class="input-wrapper">
									<view class="picker">
										<text>{{ kindOptions[kindPickerIndex].label }}</text>
									</view>
								</view>
							</picker>
						</view>

						<view class="form-row">
							<view class="form-item col-half">
								<text class="label">皮重 (kg)</text>
								<view class="input-wrapper">
									<input class="input" type="number" placeholder="可空"
										v-model="editForm.tare_weight" />
								</view>
							</view>
							<view class="form-item col-half">
								<text class="label">状态</text>
								<picker mode="selector" :range="statusOptions" range-key="label"
									:value="editStatusIndex" @change="onEditStatusChange">
									<view class="input-wrapper">
										<view class="picker">
											<text>{{ editStatusLabel }}</text>
										</view>
									</view>
								</picker>
							</view>
						</view>

						<view class="form-item">
							<text class="label">备注</text>
							<textarea class="textarea" placeholder="例如：瓶身有划痕，优先安排维修" v-model="editForm.remark" />
						</view>
					</view>
					<view class="dialog-footer">
						<button class="btn-soft" @click="closeDialog">取消</button>
						<button class="btn-primary" :loading="saving" @click="saveBottle">
							保存
						</button>
					</view>
				</view>
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
        import { callCloud } from '@/common/request.js'
	import BackToDashboardBar from '@/components/BackToDashboardBar.vue'

	export default {
		components: {
			BackToDashboardBar
		},
		data() {
			return {
				// 是否管理员（用于前端权限控制）
				isAdmin: false,

				// 状态文案映射（与后端 BOTTLE_STATUS 对应）
				statusTextMap: {
					in_station: '在站',
					at_customer: '在客户',

					repairing: '维修',
					scrapped: '报废',
					lost: '丢失',
					unknown: '未维护'
				},
				statusOptions: [{
						value: '',
						label: '全部状态'
					},
					{
						value: 'in_station',
						label: '在站'
					},
					{
						value: 'at_customer',
						label: '在客户'
					},
					{
						value: 'repairing',
						label: '维修'
					},
					{
						value: 'scrapped',
						label: '报废'
					},
					{
						value: 'lost',
						label: '丢失'
					},
					{
						value: 'unknown',
						label: '未维护'
					}
				],

				// 筛选
				keyword: '',
				statusFilter: '',
				statusPickerIndex: 0,

				// 列表
				list: [],
				page: 1,
				pageSize: 20,
				total: 0,
				loading: false,

				// 弹层编辑
				showEditDialog: false,
				editMode: 'create', // 'create' | 'edit'
				editForm: {
					id: '',
					number: '',
					kind: 'bottle',
					tare_weight: '',
					status: 'in_station',
					remark: '',
					filling_gross_weight: '',
					filling_net_weight: '',
					last_gross_weight: '',
					last_net_weight: '',
					last_return_diff: '',
					next_out_gross: '',
					next_out_net: ''
				},
				saving: false,
				editStatusIndex: 1, // 默认“在站”
				kindOptions: [
					{ value: 'bottle', label: '瓶装' },
					{ value: 'truck', label: '整车(TRUCK)' }
				],
				kindPickerIndex: 0,

				// 从其它页面跳转带入的瓶号
				pendingBottleNumber: '',
				hasAutoOpenFromParam: false
			}
		},

		computed: {
			statusFilterLabel() {
				const item = this.statusOptions[this.statusPickerIndex]
				return item ? item.label : '全部状态'
			},
			editStatusLabel() {
				const item = this.statusOptions[this.editStatusIndex]
				return item ? item.label : ''
			},
			pageCount() {
				if (!this.total || !this.pageSize) return 0
				return Math.ceil(this.total / this.pageSize)
			}
		},

		onLoad(options) {
			// 登录校验
			if (!ensureLogin()) return

			// 读取当前用户角色
                        const u = getUserInfo() || {}
                        this.isAdmin = isAdminRole(u)

			// 支持 /pages/bottle/manage?number=J201
			if (options && options.number) {
				this.keyword = options.number
				this.pendingBottleNumber = options.number
			}
			this.fetchList(true)
		},

                methods: {
                        async callBottle(action, data = {}) {
                                const token = getToken && getToken()
                                const result = await callCloud('crm-bottle', { action, data, token })
                                if (result && result.code === 401) return null
                                return result
                        },

                        /* ===== 辅助：上次回瓶净重 & 异常高亮 ===== */
                        effectiveLastBackNet(item) {
				// 以后只认 last_back_net_weight，旧字段一律不兜底
				const v =
					item.last_back_net_weight != null ?
					Number(item.last_back_net_weight) :
					null

				if (v == null || Number.isNaN(v)) return '—'
				return v.toFixed(2) + ' kg'
			},
			isReturnAnomaly(item) {
				// 用 new 字段 last_back_net_weight 来判断异常
				const diff = Number(item.last_back_net_weight)
				if (Number.isNaN(diff)) return false
				// 阈值和后端保持一致：绝对值 > 5kg 认为异常
				return Math.abs(diff) > 5
			},

			/* ===== 筛选相关 ===== */
			onStatusChange(e) {
				const idx = Number(e.detail.value)
				this.statusPickerIndex = idx
				this.statusFilter = this.statusOptions[idx].value
			},

			resetFilter() {
				this.keyword = ''
				this.statusFilter = ''
				this.statusPickerIndex = 0
				this.page = 1
				this.pendingBottleNumber = ''
				this.hasAutoOpenFromParam = false
				this.fetchList(true)
			},

			onSearch() {
				this.page = 1
				this.fetchList(true)
			},

			/* ===== 获取列表 ===== */
                        async fetchList(resetPage = false) {
                                if (resetPage) {
                                        this.page = 1
                                }
                                this.loading = true
                                try {
                                        const result = await this.callBottle('list', {
                                                keyword: this.keyword,
                                                status: this.statusFilter || undefined,
                                                page: this.page,
                                                pageSize: this.pageSize
                                        })

                                        if (result && result.code === 0) {
                                                this.list = result.data || []
                                                this.total = result.total || 0

                                                // 只有管理员才会自动打开编辑弹窗
                                                if (
							this.isAdmin &&
							this.pendingBottleNumber &&
							!this.hasAutoOpenFromParam &&
							this.list.length === 1 &&
                                                        this.list[0].number === this.pendingBottleNumber
                                                ) {
                                                        this.openEdit(this.list[0])
                                                        this.hasAutoOpenFromParam = true
                                                }
                                        } else if (result && result.code !== 401) {
                                                uni.showToast({
                                                        title: (result && result.msg) || '加载失败',
                                                        icon: 'none'
                                                })
                                        }
                                } catch (err) {
                                        console.error('fetch bottles error', err)
					uni.showToast({
						title: '请求出错',
						icon: 'none'
					})
				} finally {
					this.loading = false
				}
			},

			changePage(delta) {
				const newPage = this.page + delta
				if (newPage < 1) return
				if (this.pageCount && newPage > this.pageCount) return
				this.page = newPage
				this.fetchList()
			},

			/* ===== 弹层：打开 / 关闭 ===== */
			openCreate() {
				if (!this.isAdmin) {
					return uni.showToast({
						title: '无权限',
						icon: 'none'
					})
				}

				this.editMode = 'create'
				this.editForm = {
					id: '',
					number: '',
					kind: 'bottle',
					tare_weight: '',
					status: 'in_station',
					remark: '',
					filling_gross_weight: '',
					filling_net_weight: '',
					last_gross_weight: '',
					last_net_weight: '',
					last_return_diff: '',
					next_out_gross: '',
					next_out_net: ''
				}
				// 状态默认“在站”
				this.editStatusIndex = this.statusOptions.findIndex(
					item => item.value === 'in_station'
				)
				if (this.editStatusIndex < 0) this.editStatusIndex = 1
				this.kindPickerIndex = this.kindOptions.findIndex(
					item => item.value === this.editForm.kind
				)
				if (this.kindPickerIndex < 0) this.kindPickerIndex = 0
				this.showEditDialog = true
			},

                        openEdit(item) {
                                if (!this.isAdmin) {
                                        return uni.showToast({
                                                title: '无权限',
                                                icon: 'none'
					})
				}

				this.editMode = 'edit'
				this.editForm = {
					id: item._id,
					number: item.number,
					kind: item.kind || 'bottle',
					tare_weight: item.tare_weight != null ? String(item.tare_weight) : '',
					status: item.status || 'unknown',
					remark: item.remark || '',
					filling_gross_weight: item.filling_gross_weight != null ?
						String(item.filling_gross_weight) :
						'',
					filling_net_weight: item.filling_net_weight != null ?
						String(item.filling_net_weight) :
						'',
					last_gross_weight: item.last_gross_weight != null ?
						String(item.last_gross_weight) :
						'',
					last_net_weight: item.last_net_weight != null ?
						String(item.last_net_weight) :
						'',
					last_return_diff: item.last_return_diff != null ?
						String(item.last_return_diff) :
						'',
					next_out_gross: item.next_out_gross != null ?
						String(item.next_out_gross) :
						'',
					next_out_net: item.next_out_net != null ? String(item.next_out_net) : ''
				}
                                const idx = this.statusOptions.findIndex(
                                        s => s.value === this.editForm.status
                                )
                                this.editStatusIndex = idx >= 0 ? idx : 0
				const kindIdx = this.kindOptions.findIndex(k => k.value === this.editForm.kind)
				this.kindPickerIndex = kindIdx >= 0 ? kindIdx : 0
                                this.showEditDialog = true
                        },

                        closeDialog() {
                                if (this.saving) return
                                this.showEditDialog = false
                        },

                        onBottleNumberInput(e) {
                                const raw = e.detail.value || ''
                                let cleaned = raw.replace(/\s+/g, '')
                                cleaned = cleaned.toUpperCase().replace(/[^A-Z0-9-]/g, '')
                                cleaned = cleaned.slice(0, 20)
                                this.editForm.number = cleaned
				if (this.editMode === 'create') {
					const isTruck = cleaned.startsWith('TRUCK-')
					this.editForm.kind = isTruck ? 'truck' : 'bottle'
					const idx = this.kindOptions.findIndex(k => k.value === this.editForm.kind)
					this.kindPickerIndex = idx >= 0 ? idx : 0
				}
                        },
			onKindChange(e) {
				const idx = Number(e.detail.value)
				this.kindPickerIndex = idx
				const chosen = this.kindOptions[idx]
				this.editForm.kind = (chosen && chosen.value) || 'bottle'
			},

                        normalizeBottleNumber() {
                                const no = (this.editForm.number || '').trim().toUpperCase()
                                if (!no) return ''
                                const pattern = /^[A-Z0-9-]{2,20}$/
                                if (!pattern.test(no)) return null
                                return no
                        },

                        normalizeWeight(value, label) {
                                const str = value != null ? String(value).trim() : ''
                                if (!str) return null
                                const n = Number(str)
                                if (!Number.isFinite(n) || n < 0) {
                                        uni.showToast({
                                                title: `${label}需为非负数字`,
                                                icon: 'none'
                                        })
                                        return false
                                }
                                return Number(n.toFixed(3))
                        },

			onEditStatusChange(e) {
				const idx = Number(e.detail.value)
				this.editStatusIndex = idx
				this.editForm.status = this.statusOptions[idx].value || 'unknown'
			},

			/* ===== 新增 / 编辑保存 ===== */
			async saveBottle() {
				if (!this.isAdmin) {
					return uni.showToast({
						title: '无权限',
						icon: 'none'
					})
				}

                                const no = this.normalizeBottleNumber()
                                if (no === '') {
                                        return uni.showToast({
                                                title: '瓶号不能为空',
                                                icon: 'none'
                                        })
                                }
                                if (no === null) {
                                        return uni.showToast({
                                                title: '瓶号仅支持字母、数字或 -，请检查',
                                                icon: 'none'
                                        })
                                }

                                const tareWeight = this.normalizeWeight(
                                        this.editForm.tare_weight,
                                        '皮重'
                                )
                                if (tareWeight === false) return

                                const token = getToken()
                                if (!token) {
                                        // getToken 内部已经做了统一的登录提示和跳转，这里只终止保存流程
                                        return
                                }

                                const payload = {
                                        number: no,
					kind: this.editForm.kind || (no.startsWith('TRUCK-') ? 'truck' : 'bottle'),
                                        tare_weight: tareWeight,
                                        status: this.editForm.status,
                                        remark: (this.editForm.remark || '').trim()
                                 }

                                this.saving = true
                                try {
                                        const res =
                                                this.editMode === 'create'
                                                        ? await this.callBottle('create', payload)
                                                        : await this.callBottle('update', {
                                                                  id: this.editForm.id,
                                                                  ...payload
                                                          })

                                        if (res && res.code === 0) {
                                                uni.showToast({
                                                        title: this.editMode === 'create' ? '新增成功' : '保存成功',
                                                        icon: 'success'
                                                })
                                                this.showEditDialog = false
                                                this.fetchList()
                                        } else if (res && res.code !== 401) {
                                                uni.showToast({
                                                        title: (res && res.msg) || '操作失败',
                                                        icon: 'none'
                                                })
                                        }
				} catch (err) {
					console.error('save bottle error', err)
					uni.showToast({
						title: '请求出错',
						icon: 'none'
					})
				} finally {
					this.saving = false
				}
			},

			goDetail(item) {
				if (!item || !item.number) return
				uni.navigateTo({
					url: `/pages/bottle/detail?number=${encodeURIComponent(
						item.number
					)}${item._id ? `&id=${item._id}` : ''}`
				})
			},

			/* ===== 删除 ===== */
			removeItem(item) {
				if (!this.isAdmin) {
					return uni.showToast({
						title: '无权限',
						icon: 'none'
					})
				}

                                uni.showModal({
                                        title: '确认删除',
                                        content: `确认删除瓶号 ${item.number} 吗？`,
                                        success: async res => {
                                                if (!res.confirm) return
                                                try {
                                                        const resp = await this.callBottle('remove', {
                                                                id: item._id
                                                        })
                                                        if (resp && resp.code === 0) {
                                                                uni.showToast({
                                                                        title: '已删除',
                                                                        icon: 'success'
                                                                })
								if (this.list.length === 1 && this.page > 1) {
									this.page -= 1
								}
								this.fetchList()
                                                        } else if (resp && resp.code !== 401) {
                                                                uni.showToast({
                                                                        title: (resp && resp.msg) || '删除失败',
                                                                        icon: 'none'
                                                                })
                                                        }
						} catch (err) {
							console.error('remove bottle error', err)
							uni.showToast({
								title: '请求出错',
								icon: 'none'
							})
						}
					}
				})
			}
		}
	}
</script>

<style scoped>
	.bottle-page {
		min-height: 100vh;
		background-color: #f2f4f9;
		padding: 24rpx 16rpx 40rpx;
		box-sizing: border-box;
	}

	.bottle-inner {
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
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.card-title {
		font-size: 30rpx;
		font-weight: 600;
		color: #333;
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

	@media (min-width: 768px) {
		.col {
			width: 50%;
		}

		.col-half {
			width: 50%;
		}
	}

	/* 表单控件 */
	.form-item {
		margin-bottom: 18rpx;
	}

	.label {
		display: block;
		font-size: 26rpx;
		margin-bottom: 6rpx;
		color: #555;
	}

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

	.input {
		flex: 1;
		height: 100%;
		box-sizing: border-box;
		border: none;
		background: transparent;
		font-size: 28rpx;
		color: #222;
	}

	.picker {
		flex: 1;
		height: 100%;
		display: flex;
		align-items: center;
		box-sizing: border-box;
		font-size: 28rpx;
		color: #222;
	}

	.textarea {
		width: 100%;
		min-height: 160rpx;
		padding: 16rpx 24rpx;
		box-sizing: border-box;
		border-radius: 18rpx;
		border: 1rpx solid #e0e0e0;
		background: #ffffff;
		font-size: 28rpx;
		color: #222;
	}

	/* 列表 */
	.bottle-item {
		padding: 16rpx 12rpx;
		border-radius: 16rpx;
		background: #f7f8fc;
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12rpx;
	}

	.bottle-main {
		flex: 1;
		margin-right: 12rpx;
	}

	.bottle-line {
		display: flex;
		justify-content: space-between;
		margin-bottom: 6rpx;
	}

	.bottle-no {
		font-size: 28rpx;
		font-weight: 600;
		color: #111827;
	}

	.bottle-meta {
		font-size: 24rpx;
		color: #6b7280;
	}

	.bottle-actions {
		display: flex;
		flex-direction: column;
		row-gap: 8rpx;
	}

	/* 空状态 */
	.list-empty {
		padding: 40rpx 0;
		display: flex;
		justify-content: center;
	}

	.empty-text {
		font-size: 26rpx;
		color: #9ca3af;
	}

	/* 分页 */
	.pagination {
		margin-top: 12rpx;
		display: flex;
		justify-content: center;
		align-items: center;
		column-gap: 16rpx;
	}

	.page-info {
		font-size: 24rpx;
		color: #6b7280;
	}

	/* 按钮 */
	.btn-row-inline {
		margin-top: 12rpx;
		display: flex;
		justify-content: flex-end;
		column-gap: 16rpx;
	}

	.btn-soft,
	.btn-primary {
		min-width: 160rpx;
		padding: 14rpx 24rpx;
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

	.btn-mini {
		padding: 6rpx 20rpx;
		border-radius: 999rpx;
		font-size: 22rpx;
		background: #ffffff;
		border: 1rpx solid #d1d5db;
		color: #374151;
	}

	.btn-mini[disabled] {
		opacity: 0.5;
	}

	.btn-danger {
		border-color: #f97373;
		color: #f97373;
	}

	/* 弹层 */
	.dialog-mask {
		position: fixed;
		left: 0;
		top: 0;
		right: 0;
		bottom: 0;
		background: rgba(15, 23, 42, 0.36);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 999;
	}

	.dialog-body {
		width: 92%;
		max-width: 640rpx;
		background: #ffffff;
		border-radius: 24rpx;
		padding: 20rpx 22rpx 18rpx;
		box-shadow: 0 20rpx 40rpx rgba(15, 23, 42, 0.25);
	}

	.dialog-header {
		padding-bottom: 10rpx;
		border-bottom: 1px solid #eef0f4;
		margin-bottom: 10rpx;
	}

	.dialog-title {
		font-size: 30rpx;
		font-weight: 600;
		color: #111827;
	}

	.dialog-content {
		margin-top: 4rpx;
	}

	.dialog-footer {
		margin-top: 10rpx;
		display: flex;
		justify-content: flex-end;
		column-gap: 16rpx;
	}

	/* 状态 pill（和 detail 页统一风格） */
	.status-pill {
		padding: 4rpx 12rpx;
		border-radius: 999rpx;
		display: flex;
		align-items: center;
		font-size: 22rpx;
	}

	.status-dot {
		width: 8rpx;
		height: 8rpx;
		border-radius: 50%;
		margin-right: 4rpx;
	}

	.status-in_station {
		background: rgba(59, 130, 246, 0.08);
		color: #1d4ed8;
	}

	.status-in_station .status-dot {
		background: #2563eb;
	}

	.status-at_customer {
		background: rgba(16, 185, 129, 0.08);
		color: #047857;
	}

	.status-at_customer .status-dot {
		background: #10b981;
	}

	.status-lost,
	.status-scrapped {
		background: rgba(248, 113, 113, 0.08);
		color: #b91c1c;
	}

	.status-lost .status-dot,
	.status-scrapped .status-dot {
		background: #ef4444;
	}

	.status-unknown {
		background: rgba(156, 163, 175, 0.08);
		color: #4b5563;
	}

	.status-unknown .status-dot {
		background: #9ca3af;
	}

	.danger-text {
		color: #dc2626;
	}

	.tag-truck {
		padding: 4rpx 10rpx;
		border-radius: 999rpx;
		font-size: 20rpx;
		background: rgba(99, 102, 241, 0.1);
		color: #4338ca;
	}
</style>
