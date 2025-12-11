<template>
	<view class="page">
		<view class="inner">
			<BackToDashboardBar back-to="/pages/delivery/list" text="返回" />
			<!-- 顶部 -->
			<view class="page-header">
				<view class="page-header-left">
					<view class="page-icon">
						<text class="page-icon-text">配</text>
					</view>
					<view class="page-header-text">
						<text class="page-title">
							{{ isEdit ? '编辑配送员' : '新增配送员' }}
						</text>
						<text class="page-sub">
							维护配送员姓名、联系方式与状态信息
						</text>
					</view>
				</view>
			</view>

			<!-- 表单卡片 -->
			<view class="card">
				<view class="card-header">
					<text class="card-title">基本信息</text>
				</view>

				<view class="card-body">
					<view class="form-item">
						<text class="label">* 姓名</text>
						<view class="input-wrapper">
							<input class="input" v-model="form.name" placeholder="请输入配送员姓名" />
						</view>
					</view>

                                        <view class="form-item">
                                                <text class="label">手机号</text>
                                                <view class="input-wrapper">
                                                        <input
                                                                class="input"
                                                                :value="form.mobile"
                                                                type="text"
                                                                maxlength="20"
                                                                placeholder="可填写手机号或联系电话"
                                                                @input="onMobileInput"
                                                        />
                                                </view>
                                        </view>

					<view class="form-item">
						<text class="label">状态</text>
						<picker mode="selector" :range="statusOptions" range-key="label" :value="statusIndex"
							@change="onStatusChange">
							<view class="input-wrapper">
								<view class="picker">
									<text>{{ statusLabel }}</text>
								</view>
							</view>
						</picker>
					</view>

					<view class="form-item">
						<text class="label">备注</text>
						<textarea class="textarea" v-model="form.remark" placeholder="例如：主负责城北片区、熟悉XX路段" />
					</view>
				</view>
			</view>

			<!-- 底部按钮 -->
			<view class="btn-row-bottom">

				<button class="btn-primary" :loading="submitting" @click="handleSubmit">
					{{ isEdit ? '保存修改' : '保存配送员' }}
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
				id: '',
				submitting: false,

				form: {
					name: '',
					mobile: '',
					status: 'active',
					remark: ''
				},

				statusOptions: [{
						label: '在职',
						value: 'active'
					},
					{
						label: '请假/停工',
						value: 'on_leave'
					},
					{
						label: '离职',
						value: 'inactive'
					}
				],
				statusIndex: 0
			}
		},

		computed: {
			isEdit() {
				return !!this.id
			},
			statusLabel() {
				return this.statusOptions[this.statusIndex].label
			}
		},

		onLoad(options) {
			if (!ensureLogin()) return

			this.id = options?.id || ''

			if (this.id) {
				this.loadDetail()
			}
		},

		methods: {
			/** 统一 token */
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

                        /** 选择状态 */
                        onStatusChange(e) {
                                const idx = Number(e.detail.value || 0)
                                this.statusIndex = idx
                                this.form.status = this.statusOptions[idx].value
                        },

                        /** 号码输入过滤：数字与 - */
                        onMobileInput(e) {
                                const raw = e.detail.value || ''
                                let cleaned = raw.replace(/[^\d-]/g, '')
                                cleaned = cleaned.replace(/-+/g, '-').slice(0, 20)
                                this.form.mobile = cleaned
                        },

                        /** 手机/座机规范化校验 */
                        normalizeMobile() {
                                const raw = (this.form.mobile || '').trim()
                                if (!raw) return ''

                                const compact = raw.replace(/\s+/g, '')
                                const digitsOnly = compact.replace(/\D/g, '')

                                const isMobile = /^1[3-9]\d{9}$/.test(digitsOnly)
                                const landlinePattern = /^(\d{3,4})-?(\d{5,8})$/
                                const landlineMatch = compact.match(landlinePattern)

                                if (isMobile) return digitsOnly
                                if (landlineMatch) return `${landlineMatch[1]}-${landlineMatch[2]}`
                                return null
                        },

			/** 加载详情（编辑模式） */
			async loadDetail() {
				const token = this.getToken()
				if (!token) return

				try {
					uni.showLoading({
						title: '加载中…',
						mask: true
					})

					const res = await uniCloud.callFunction({
						name: 'crm-delivery',
						data: {
							action: 'get',
							token,
							data: {
								id: this.id
							}
						}
					})

					const result = res.result || {}

					// 统一 401
					if (result.code === 401) {
						uni.showToast({
							title: result.msg || '登录已过期，请重新登录',
							icon: 'none'
						})
						ensureLogin()
						return
					}

					if (result.code !== 0 || !result.data) {
						uni.showToast({
							title: result.msg || '加载失败',
							icon: 'none'
						})
						return
					}

					const info = result.data

					this.form.name = info.name || ''
					this.form.mobile = info.mobile || info.phone || ''
					this.form.status = info.status || 'active'
					this.form.remark = info.remark || ''

					// 状态回填
					const idx = this.statusOptions.findIndex(s => s.value === this.form.status)
					this.statusIndex = idx >= 0 ? idx : 0
				} catch (e) {
					console.error('load delivery detail error:', e)
					uni.showToast({
						title: '加载失败，请稍后再试',
						icon: 'none'
					})
				} finally {
					uni.hideLoading()
				}
			},

			/** 保存 */
			async handleSubmit() {
				if (this.submitting) return

                                const name = (this.form.name || '').trim()
                                if (!name) {
                                        return uni.showToast({
                                                title: '请填写姓名',
                                                icon: 'none'
                                        })
                                }

                                const normalizedMobile = this.normalizeMobile()
                                if (normalizedMobile === null) {
                                        return uni.showToast({
                                                title: '手机号格式不正确，请检查',
                                                icon: 'none'
                                        })
                                }

                                const token = this.getToken()
                                if (!token) return

                                const payload = {
                                        name,
                                        mobile: normalizedMobile,
                                        status: this.form.status,
                                        remark: this.form.remark.trim()
                                }

				this.submitting = true

				try {
					uni.showLoading({
						title: this.isEdit ? '保存中…' : '创建中…',
						mask: true
					})

					const res = await uniCloud.callFunction({
						name: 'crm-delivery',
						data: {
							action: this.isEdit ? 'update' : 'create',
							token,
							data: this.isEdit ? {
								id: this.id,
								...payload
							} : payload
						}
					})

					const result = res.result || {}

					if (result.code === 401) {
						uni.showToast({
							title: result.msg || '登录已过期，请重新登录',
							icon: 'none'
						})
						ensureLogin()
						return
					}

					if (result.code !== 0) {
						uni.showToast({
							title: result.msg || '保存失败',
							icon: 'none'
						})
						return
					}

					uni.showToast({
						title: this.isEdit ? '保存成功' : '创建成功',
						icon: 'success'
					})

					setTimeout(() => {
						this.goBack()
					}, 300)
				} catch (e) {
					console.error('save delivery error:', e)
					uni.showToast({
						title: '保存失败，请稍后再试',
						icon: 'none'
					})
				} finally {
					this.submitting = false
					uni.hideLoading()
				}
			},

			/** 返回 */
			goBack() {
				const pages = getCurrentPages()
				if (pages.length > 1) {
					uni.navigateBack()
				} else {
					uni.reLaunch({
						url: '/pages/delivery/list'
					})
				}
			}
		}
	}
</script>
<style scoped>
	.page {
		min-height: 100vh;
		background-color: #f2f4f9;
		padding: 24rpx 16rpx 40rpx;
		box-sizing: border-box;
	}

	.inner {
		width: 100%;
		max-width: 1200rpx;
		margin: 0 auto;
	}

	/* 顶部标题 */
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

	/* 卡片 */
	.card {
		background-color: #ffffff;
		border-radius: 20rpx;
		padding: 22rpx 24rpx 26rpx;
		margin-bottom: 20rpx;
		box-shadow: 0 8rpx 22rpx rgba(15, 35, 52, 0.04);
		box-sizing: border-box;
	}

	.card-header {
		padding-bottom: 10rpx;
		border-bottom: 1px solid #f0f0f0;
		margin-bottom: 14rpx;
	}

	.card-title {
		font-size: 28rpx;
		font-weight: 600;
		color: #333;
	}

	.card-body {
		margin-top: 4rpx;
	}

	/* 表单 */
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
		border: none;
		background: transparent;
		font-size: 28rpx;
		color: #222;
	}

	.picker {
		flex: 1;
		display: flex;
		align-items: center;
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

	/* 底部按钮 */
	.btn-row-bottom {
		margin-top: 20rpx;
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
</style>