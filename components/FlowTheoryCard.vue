<template>
  <view class="card flow-theory-card">
    <view class="card-header">
      <text class="card-title">称重推算理论流量</text>
      <text class="card-sub">
        从瓶子 / 罐车称重看本次实际消耗多少公斤，并换算成立方米
      </text>
    </view>

    <view class="card-body">
      <!-- 出瓶 / 回瓶净重合计 -->
      <view class="summary-chip">
        <view class="summary-line">
          <text class="summary-label">出瓶净重合计：</text>
          <text class="summary-value">{{ outKgText }} kg</text>
        </view>

        <view class="summary-line">
          <text class="summary-label">回瓶净重合计：</text>
          <text class="summary-value">{{ backKgText }} kg</text>
        </view>

        <view class="summary-line">
          <text class="summary-label">实际消耗：</text>
          <text class="summary-value-strong">{{ actualKgText }} kg</text>
        </view>

        <view class="summary-line" v-if="actualFormula">
          <text class="summary-formula">{{ actualFormula }}</text>
        </view>
      </view>

      <!-- 换算系数 -->
      <view class="form-row">
        <view class="form-item col-half">
          <text class="label">换算系数 (m³/kg)</text>
          <view class="input-wrapper">
            <input
              class="input"
              type="number"
              :value="ratioInput"
              placeholder="例如 1.37"
              @input="onRatioInput"
            />
          </view>
        </view>
      </view>

      <!-- 理论流量 (m³) -->
      <view class="summary-chip">
        <view class="summary-line">
          <text class="summary-label">理论用气量：</text>
          <text class="summary-value-strong">{{ theoryVolumeText }} m³</text>
        </view>
        <view class="summary-line" v-if="theoryFormula">
          <text class="summary-formula">{{ theoryFormula }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'FlowTheoryCard',
  props: {
    // 出瓶净重合计（kg）
    totalOutNet: {
      type: [Number, String],
      default: 0
    },
    // 回瓶净重合计（kg）
    totalBackNet: {
      type: [Number, String],
      default: 0
    },
    // 换算系数 m³/kg
    ratio: {
      type: [Number, String],
      default: 1.37
    }
  },
  data() {
    return {
      ratioInput: this.ratio
    }
  },
  watch: {
    // 父组件更新 ratio 时，同步到输入框
    ratio(val) {
      this.ratioInput = val
    }
  },
  computed: {
    outKgNumber() {
      const n = Number(this.totalOutNet)
      return isNaN(n) ? 0 : n
    },
    backKgNumber() {
      const n = Number(this.totalBackNet)
      return isNaN(n) ? 0 : n
    },
    actualKgNumber() {
      return this.outKgNumber - this.backKgNumber
    },

    outKgText() {
      return this.outKgNumber.toFixed(2)
    },
    backKgText() {
      return this.backKgNumber.toFixed(2)
    },
    actualKgText() {
      return this.actualKgNumber.toFixed(2)
    },

    actualFormula() {
      if (!this.outKgNumber && !this.backKgNumber) return ''
      return `实际消耗 = 出瓶净重合计 - 回瓶净重合计 = ${this.outKgText}kg - ${this.backKgText}kg = ${this.actualKgText}kg`
    },

    ratioNumber() {
      const n = Number(this.ratioInput)
      return isNaN(n) || n <= 0 ? 0 : n
    },

    theoryVolumeNumber() {
      // ★ 拿到 kg 之后，按 m³/kg 直接乘换算成体积
      if (!this.ratioNumber) return 0
      return this.actualKgNumber * this.ratioNumber
    },
    theoryVolumeText() {
      return this.theoryVolumeNumber.toFixed(2)
    },
    theoryFormula() {
      if (!this.theoryVolumeNumber || !this.ratioNumber) return ''
      return `理论用气量 = 实际消耗 × 换算系数 = ${this.actualKgText}kg × ${this.ratioNumber}m³/kg = ${this.theoryVolumeText}m³`
    }
  },
  methods: {
    onRatioInput(e) {
      const raw = e.detail.value
      this.ratioInput = raw
      const n = Number(raw)
      this.$emit('update-ratio', isNaN(n) ? 0 : n)
    }
  }
}
</script>

<style scoped>
.flow-theory-card {
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

.summary-value {
  font-size: 26rpx;
  color: #111827;
  margin-left: 6rpx;
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
.form-row {
  display: flex;
  flex-wrap: wrap;
  margin: 0 -8rpx;
}
.form-item {
  padding: 0 8rpx;
  margin-bottom: 18rpx;
}
.col-half {
  width: 100%;
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

@media (min-width: 768px) {
  .col-half {
    width: 50%;
  }
}
</style>