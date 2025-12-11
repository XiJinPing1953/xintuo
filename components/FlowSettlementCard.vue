<template>
  <view class="card flow-settle-card">
    <view class="card-header">
      <text class="card-title">流量结算</text>
      <text class="card-sub">单位为 元/m³ 时自动启用此卡片</text>
    </view>

    <view class="card-body">
      <!-- 上次表数 -->
      <view class="form-item">
        <text class="label">上次表数 (m³)</text>
        <view class="input-wrapper">
          <input
            type="number"
            class="input"
            v-model="prev"
            @blur="emitChange"
          />
        </view>
      </view>

      <!-- 本次表数 -->
      <view class="form-item">
        <text class="label">本次表数 (m³)</text>
        <view class="input-wrapper">
          <input
            type="number"
            class="input"
            v-model="curr"
            @blur="emitChange"
          />
        </view>
      </view>

      <!-- 本次用气量 -->
      <view class="summary-chip">
        <view class="summary-line">
          <text class="summary-label">本次用气量：</text>
          <text class="summary-value-strong">{{ volumeText }} m³</text>
        </view>
        <view class="summary-line" v-if="volumeFormula">
          <text class="summary-formula">{{ volumeFormula }}</text>
        </view>
      </view>

      <!-- 应收金额 -->
      <view class="summary-chip">
        <view class="summary-line">
          <text class="summary-label-strong">应收金额：</text>
          <text class="summary-value-strong">{{ amountText }} 元</text>
        </view>
        <view class="summary-line" v-if="amountFormula">
          <text class="summary-formula">{{ amountFormula }}</text>
        </view>
      </view>

      <!-- 实收金额 -->
      <view class="form-item">
        <text class="label">实收金额 (元)</text>
        <view class="input-wrapper">
          <input
            type="number"
            class="input"
            v-model="localAmountReceived"
            @blur="emitChange"
            placeholder="本次实际收了多少，可为 0"
          />
        </view>
      </view>

      <!-- 付款状态 -->
      <view class="form-item">
        <text class="label">付款状态</text>
        <picker
          mode="selector"
          :range="paymentStatusOptions"
          :value="paymentStatusIndex"
          @change="onPaymentStatusChange"
        >
          <view class="input-wrapper">
            <view class="picker">
              <text>{{ paymentStatusLabel }}</text>
            </view>
          </view>
        </picker>
      </view>

      <!-- 备注 -->
      <view class="form-item">
        <text class="label">备注</text>
        <textarea
          class="textarea"
          v-model="localRemark"
          @blur="emitChange"
          placeholder="例如：只抄表未送气；或补录某日流量结算"
        />
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'FlowSettlementCard',
  props: {
    // 单价（元/m³）——允许字符串或数字
    unitPrice: {
      type: [Number, String],
      default: 0
    },
    // 初始表数 & 已存数据
    prevIndex: {
      type: [Number, String],
      default: ''
    },
    currIndex: {
      type: [Number, String],
      default: ''
    },
    amountReceived: {
      type: [Number, String],
      default: ''
    },
    paymentStatus: {
      type: String,
      default: '挂账'
    },
    remark: {
      type: String,
      default: ''
    },
    paymentStatusOptions: {
      type: Array,
      default () {
        return ['挂账', '已付', '部分已付', '冲减']
      }
    }
  },

  data () {
    return {
      prev: String(this.prevIndex || ''),
      curr: String(this.currIndex || ''),
      localAmountReceived: String(this.amountReceived || ''),
      localPaymentStatus: this.paymentStatus || '挂账',
      localRemark: this.remark || ''
    }
  },

  watch: {
    prevIndex (val) {
      this.prev = String(val || '')
    },
    currIndex (val) {
      this.curr = String(val || '')
    },
    amountReceived (val) {
      this.localAmountReceived = String(val || '')
    },
    paymentStatus (val) {
      this.localPaymentStatus = val || '挂账'
    },
    remark (val) {
      this.localRemark = val || ''
    }
  },
  

  computed: {
    /* === 用气量 === */
    volumeNumber () {
      const p = Number(this.prev)
      const c = Number(this.curr)
      if (isNaN(p) || isNaN(c) || c < p) return 0
      return c - p
    },
    volumeText () {
      return this.volumeNumber.toFixed(4)
    },
    volumeFormula () {
      if (!this.volumeNumber) return ''
      return `${this.curr || 0} - ${this.prev || 0} = ${this.volumeText}m³`
    },

    /* === 应收金额 === */
    amountNumber () {
      const v = this.volumeNumber
      const price = Number(this.unitPrice)
      if (!v || isNaN(price)) return 0
      return v * price
    },
    amountText () {
      return this.amountNumber.toFixed(2)
    },
    amountFormula () {
      const price = Number(this.unitPrice)
      if (!this.volumeNumber || isNaN(price)) return ''
      return `应收金额 = 用气量 × 单价 = ${this.volumeText}m³ × ${price}元/m³ = ${this.amountText}元`
    },

    /* === 付款状态 === */
    paymentStatusIndex () {
      const idx = this.paymentStatusOptions.indexOf(this.localPaymentStatus)
      return idx >= 0 ? idx : 0
    },
    paymentStatusLabel () {
      return this.paymentStatusOptions[this.paymentStatusIndex] || '挂账'
    }
  },

  methods: {
    onPaymentStatusChange (e) {
      const idx = Number(e.detail.value)
      this.localPaymentStatus = this.paymentStatusOptions[idx] || '挂账'
      this.emitChange()
    },

    emitChange () {
      const payload = {
        prev: this.prev,
        curr: this.curr,
        volume: this.volumeText,
        amount: this.amountText,
        amount_received: this.localAmountReceived,
        payment_status: this.localPaymentStatus,
        remark: this.localRemark
      }

      // 让父组件的 @input 能收到
      this.$emit('input', payload)
      // 保留一个 update 事件（如果你别处用得上）
      this.$emit('update', payload)
    }
  }
}
</script>

<style scoped>
  .flow-settle-card {
    margin-bottom: 20rpx;
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

  .summary-chip {
    margin-top: 8rpx;
    padding: 10rpx 14rpx;
    border-radius: 16rpx;
    background: #f7f8fc;
  }

  .summary-line {
    display: flex;
    flex-wrap: wrap;
    margin-bottom: 4rpx;
  }

  .summary-label {
    font-size: 24rpx;
    color: #6b7280;
  }

  .summary-label-strong {
    font-size: 26rpx;
    color: #111827;
    font-weight: 600;
  }

  .summary-value-strong {
    font-size: 28rpx;
    color: #111827;
    font-weight: 700;
    margin-left: 6rpx;
  }

  .summary-formula {
    font-size: 26rpx;
    color: #111827;
    font-weight: 600;
  }

  /* 表单样式，和页面保持一致 */
  .form-item {
    padding: 0 8rpx;
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
    border: 1rpx solid #e0e0e0;
    padding: 0 20rpx;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    box-shadow: 0 10rpx 24rpx rgba(16, 46, 90, 0.04);
  }

  .input {
    flex: 1;
    height: 100%;
    border: none;
    background: transparent;
    font-size: 28rpx;
    color: #222;
  }

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

  .picker {
    flex: 1;
    height: 100%;
    display: flex;
    align-items: center;
    font-size: 28rpx;
    color: #222;
  }
</style>
