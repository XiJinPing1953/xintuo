# 销售记录落库字段最终规范（v2）

> 文件名：`sale-record-v2-spec.md`  
> 适用集合：`crm_sale_records`  
> 版本：V2（多瓶、流量表、整车称重统一模式）  
> 说明：本规范描述所有字段最终在数据库中的落库格式、含义、计算方式及使用场景。

---

# 目录
1. 总览说明  
2. 通用基础字段  
3. 业务模式字段（瓶装 / 整车 truck）  
4. 金额字段（应收 / 实收 / 回瓶）  
5. 流量结算字段（仅 m³ 模式启用）  
6. 强关联瓶子字段规范（bottle_id）  
7. 存瓶字段规范  
8. 旧版兼容字段（单瓶开单）  
9. 示例文档  
10. 注意事项（前端 / 后端）

---

# 1. 总览说明

所有销售记录最终会统一落库至集合：

```
crm_sale_records
```

后台会根据计价单位 `price_unit` 自动切换三种模式：

| 模式 | price_unit | 描述 |
|------|------------|------|
| KG 模式 | `"kg"` | 按实际瓶重计算金额 |
| 元/瓶 | `"bottle"` | 按瓶数量计费 |
| 流量表（元/m³） | `"m3"` | 按抄表气量计费 |
| 整车称重 | `"truck"`（biz_mode） | 按整车净重算，不看瓶行净重 |

无论模式如何，最终落库字段 **保持一致**，不存在“某模式丢字段”的情况，但部分字段会在非适用场景中强制存为 `null`，例如：  
- 非 m³ 模式：`flow_index_prev`、`flow_index_curr` 会被自动清空为 null  
- 非整车模式：整车字段正常存，但 truck_net 不参与金额计算  

---

# 2. 通用基础字段

| 字段 | 类型 | 说明 |
|------|------|-------|
| `date` | string(YYYY-MM-DD) | 销售日期 |
| `customer_id` | string | 客户 ID |
| `customer_name` | string | 客户名称（冗余存储，便于查询） |
| `delivery_man` | string | 送气员（多个用 "A / B" 拼接） |
| `vehicle_id` | string | 车辆 ID |
| `car_no` | string | 车牌号 |
| `remark` | string | 备注 |
| `created_at` | number | 时间戳 |
| `created_by` | string | 操作人 ID |
| `source` | string | 固定为 `"manual-v2"` |

---

# 3. 业务模式字段（瓶装 bottle / 整车 truck）

字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `biz_mode` | `"bottle"` / `"truck"` | bottle：按瓶开单（默认）；truck：整车称重 |
| `truck_gross` | number | 整车毛重 |
| `truck_tare` | number | 整车皮重 |
| `truck_net` | number | 整车净重（后台强制：gross - tare） |

计算逻辑：

- 若 `biz_mode === 'truck'`：  
  out_net_total = truck_net  
  back_net_total = 0  
  amount = truck_net × 单价  

- 若瓶装模式：  
  正常累计 out_items / back_items 的净重。

---

# 4. 金额字段（应收 / 实收 / 回瓶）

| 字段 | 类型 | 说明 |
|------|------|------|
| `unit_price` | number | 单价（和 UI header.unit_price 一致） |
| `price_unit` | `"kg"` / `"bottle"` / `"m3"` | 计价单位 |
| `out_amount` | number | 出瓶金额（按模式计算） |
| `back_amount` | number | 回瓶金额（kg 模式才会减钱） |
| `should_receive` | number | 应收金额（最终实际应收） |
| `amount_received` | number | 实收金额 |
| `payment_status` | string | 挂账 / 已付 / 部分已付 / 冲减 |
| `payment_note` | string | 付款说明 |

计算规则：

### KG 模式
```
out_amount = out_net_total * 单价
back_amount = back_net_total * 单价
should_receive = out_amount - back_amount
```

### 元/瓶 模式
```
out_amount = 出瓶数量 * 单价
should_receive = out_amount
```

### 流量表 m³ 模式
```
out_amount = flow_volume_m3 * 单价
should_receive = out_amount
```

---

# 5. 流量结算字段（仅 m³ 模式）

| 字段 | 类型 | 说明 |
|------|------|------|
| `flow_index_prev` | number / null | 上次抄表 |
| `flow_index_curr` | number / null | 本次抄表 |
| `flow_volume_m3` | number / null | 用气量（前端计算或后端自动 diff） |
| `flow_unit_price` | number | 流量计模式下的单价（与 unit_price 一致） |
| `flow_theory_ratio` | number / null | kg → m³ 换算系数 |
| `flow_theoretical_volume_m3` | number / null | 理论用气量：total_net_weight × ratio |
| `flow_amount_should` | number / null | 理论应收金额（独立于抄表计费） |
| `flow_amount_received` | number | 理论模式下的实收金额（即前端输入） |
| `flow_payment_status` | string | 理论计费付款状态 |
| `flow_remark` | string | 流量备注 |

清理策略（后台自动执行）：

### 若 `price_unit !== 'm3'`
```
flow_index_prev = null
flow_index_curr = null
flow_volume_m3 = null
flow_amount_should = null
flow_unit_price = unit_price
```

即：非 m³ 模式不会存抄表内容，只保留换算系数。

---

# 6. 强关联瓶子字段规范（bottle_id）

out_items / back_items 的结构：

```
{
  bottle_no: "202",
  gross: 455,
  tare: 355,
  net: 100,
  bottle_id: "xxxx"   ← 后端自动做强关联
}
```

后端自动执行步骤：

1. 收集所有 **bottle_id 为空** 的瓶号  
2. 一次性查询 `crm_bottles`  
3. 自动补齐对应 `_id`  
4. 若瓶号数据库不存在 → bottle_id 继续为 null（不会报错）  

---

# 7. 存瓶字段规范

最终统一生成：

```
deposit_bottles_raw = "291 / 302 / 306 / 310"
```

组成方式：

1）用户手动存瓶  
2）隐式存瓶：出瓶但未回瓶 → 默认视为存瓶  
3）两者取并集去重  

---

# 8. 旧版兼容字段（单瓶）

以下字段仍然落库，但属于兼容字段：

| 字段 | 来源 |
|------|-------|
| `bottle_no` | out_items[0].bottle_no |
| `gross_weight_out` | 同上 |
| `tare_weight_out` | 同上 |
| `net_weight_out` | 同上 |
| `return_bottle_no` | back_items[0].bottle_no |
| `gross_weight_back` | ... |
| `tare_weight_back` | ... |
| `net_weight_back` | ... |
| `total_net_weight` | out_net_total - back_net_total |

---

# 9. 示例文档（完整落库）

（略，建议从数据库中复制真实示例）

---

# 10. 注意事项（前端 / 后端）

## 前端注意
1. FlowSettlementCard 必须传递 snake_case 字段：  
   `flow_index_prev`, `flow_amount_should`, etc  
2. KG 模式 → 理论面板仍然可展示，但落库时抄表字段会被清空  
3. ensureNewBottlesCreated 必须在提交前兜底再查一次瓶号

## 后端注意
1. 非 m³ 模式必须清空抄表字段  
2. 强关联 bottle_id 必须在金额计算前完成  
3. 整车模式优先级高于瓶行模式  
4. 所有金额必须使用 Number 类型落库  

---

# 本文档到此结束。

# 瓶子三条线 · 全链路流程图（含字段流向）

> 适用范围：当前 uniCloud 项目下的三大模块：`crm_bottles`（瓶子）、`crm_filling`（灌装）、`crm_sale_records`（销售/流量结算）。  
> 目标：快速看清「一只瓶子」从入库 → 灌装 → 销售出/回 → 存瓶 的完整数据流向与核心字段来源。

---

## 0. 总览：三条业务线 & 核心集合

- **瓶子线（静态主数据 + 状态流转）**
  - 集合：`crm_bottles`
  - 关键词：`number`、`status`、最近一次出/回信息、默认皮重等。

- **灌装线（瓶子在站内的重量周期）**
  - 集合：`crm_filling_records`（名称以实际为准）
  - 关键词：充装前/后的称重、充装后净重、异常检测。

- **销售线（客户维度的出/回瓶 + 结算）**
  - 集合：`crm_sale_records`
  - 关键词：`out_items` / `back_items`、净重汇总、实收/应收、流量抄表。

三条线之间的「硬关联」关键：

- `bottles.number  ⟷  sale.out_items[].bottle_no / back_items[].bottle_no`
- `bottles._id     ⟷  sale.out_items[].bottle_id / back_items[].bottle_id`
- 重量、状态 & 客户信息，在 **销售线** 发生后，反向写回 **瓶子线**。

---

## 1. 瓶子线：`crm_bottles` 生命周期

### 1.1 初始入库

**入口：** 手动录入 / 导入 / 其他后台脚本（视你实际实现而定）  
**存放集合：** `crm_bottles`

核心字段（示意）：

- `number`：瓶号（全局唯一主键，几乎所有关联都基于它）
- `status`：状态
  - `in_station`：在站内
  - `at_customer`：在客户处
  - 未来可扩展：`scrapped` / `lost` 等
- 重量相关（根据你的实际结构略有不同）
  - `default_tare` / `tare`：皮重
  - 最近一次回站时的 **回瓶毛重 / 皮重 / 净重**（由销售线回写）
- 最近一次流转信息
  - `last_customer_id`
  - `last_customer_name`
  - `last_out_date`
  - `last_back_date`

### 1.2 后续所有「状态变化」都从销售线驱动

所有状态变更都通过云函数里统一的工具函数：

```js
async function updateBottleStatusByNumber(number, payload) {
  const no = (number || '').trim()
  if (!no) return
  await bottles.where({ number: no }).update({
    ...payload,
    updated_at: Date.now()
  })
}
```

- **出瓶时（销售 createV2 / updateV2）：**
  - `status: 'at_customer'`
  - `last_customer_id / last_customer_name / last_out_date` 更新为本次订单信息

- **回瓶时（销售 createV2 / updateV2）：**
  - `status: 'in_station'`
  - `last_customer_id / last_customer_name / last_back_date` 更新为本次订单信息

> 结论：  
> **瓶子的「权威状态」永远以 `crm_bottles` 为准，销售只是状态的“事件来源”。**

---

## 2. 灌装线：`crm_filling_records` 与瓶子重量周期

> 说明：这里以你当前营造的结构为准，字段命名略抽象，重点描述「角色关系」。

### 2.1 灌装记录的职责

- 记录瓶子在站内被充装时的 **重量变化**：
  - 充装前毛重 / 皮重 / 净重（或者仅记录关键字段）
  - 充装后毛重 / 皮重 / 净重
- 识别异常：
  - 实际充装净重 vs 理论标准（比如 40kg 瓶）
  - 超出阈值的记录为 **异常瓶子**，用于对账 & 风控

### 2.2 与 `crm_bottles` 的关系

- 通过 `bottle_no` / `bottle_id` 与 `crm_bottles` 关联
- 一般有两种写法（看你现在采用哪种）：
  1. 仅在 filling 里记录称重，不直接写回 bottles；由销售回站时同步
  2. 灌装完成后，顺手把「本次理论皮重 / 最近一次 net」写回 `crm_bottles` 作为基准

> 你的当前实现中，**真正批量更新瓶子称重的是销售线的回瓶之后**（见下节 3.4），
> 灌装记录更多是「站内质量追溯 / 日志」角色。

---

## 3. 销售线：`crm_sale_records` 全链路

### 3.1 数据入口：createV2 / updateV2

- 云函数：`crm-sale`
- action：`createV2` / `updateV2`
- 入参结构（关键）：

```js
{
  base: {
    date,
    customerId / customerName,
    unitPrice,
    priceUnit,           // 'kg' | 'bottle' | 'm3'
    delivery1, delivery2,
    vehicleId, car_no,

    // 业务模式
    bizMode,             // 'bottle' | 'truck'
    truckGross, truckTare, truckNet,

    // Flow 相关
    flow_index_prev,
    flow_index_curr,
    flow_volume,
    flow_unit_price,
    flow_amount_should,
    flow_amount_received,
    flow_payment_status,
    flow_remark,
    flow_theory_ratio,

    // 收款
    amountReceived,
    paymentStatus,
    paymentNote,

    remark
  },

  outRows: [ ... ],      // 出瓶行
  backRows: [ ... ],     // 回瓶行
  depositRows: [ ... ]   // 存瓶行
}
```

### 3.2 出瓶 / 回瓶明细结构：`out_items` / `back_items`

前端行结构（示例）：

```js
{
  bottleInput,   // 输入框里的瓶号
  gross,
  tare,
  net,
  bottleId       // 可能为空，由后端自动补齐
}
```

后端标准化为：

```js
{
  bottle_no,     // 号：由 bottleInput.trim()
  gross,
  tare,
  net,           // 若前端没给，自动 gross - tare
  bottle_id      // 若空，后端通过 number → _id 反查补齐
}
```

聚合字段：

- `out_net_total` = ∑ out_items[].net（或整车净重）
- `back_net_total` = ∑ back_items[].net
- `total_net_weight` = `out_net_total - back_net_total`

并兼容旧字段：

- `bottle_no` / `return_bottle_no`
- `gross_weight_out` / `tare_weight_out` / `net_weight_out`
- `gross_weight_back` / `tare_weight_back` / `net_weight_back`

### 3.3 结算金额字段流向

#### 3.3.1 通用字段（所有模式都会有）

- `unit_price`：基础单价
- `price_unit`：
  - `'kg'` → 重量结算
  - `'bottle'` → 按瓶结算
  - `'m3'` → 流量结算
- `out_amount`：出瓶金额
- `back_amount`：回瓶金额（kg 模式才有）
- `should_receive`：**本单理论应收**（所有模式统一口径）
- `amount_received`：**本单实收**（Flow 模式会用 flow 金额覆盖）

#### 3.3.2 kg 模式

```js
// kg
out_amount   = out_net_total * unit_price
back_amount  = back_net_total * unit_price
should_receive = out_amount - back_amount
```

#### 3.3.3 bottle 模式

```js
// bottle
out_amount   = 出瓶数量 * unit_price
back_amount  = 0
should_receive = out_amount
```

#### 3.3.4 m3（流量）模式

> **计费核心** 是抄表差；回瓶只影响库存，不参与金额。

- 用气量：

```js
// 优先用前端传入的 flow_volume
if (flow_volume_m3 == null && flow_index_prev != null && flow_index_curr != null) {
  diff = flow_index_curr - flow_index_prev
  flow_volume_m3 = diff >= 0 ? diff : 0   // 负差归 0
}
```

- 单价：

```js
flow_unit_price = front.flow_unit_price ?? unit_price
```

- Flow 应收金额（前端可自定义覆盖）：

```js
// 后端口径
out_amount = safeVolume * unit_price      // 账面 out_amount，保留兼容
back_amount = 0
should_receive = out_amount               // 兜底的应收

if (flow_amount_should == null) {
  flow_amount_should = should_receive
}
```

> ⚠ 当前版本你刻意选择 **不再让 flow_amount_should 反向覆盖 should_receive**，  
> 因为你确认业务中不会存在「流量单价 ≠ 单价」的情况。  
> 即：**两者统一即可，不强行走「Flow 金额为准」的那条分支。**

- 实收金额：

```js
base_amount_received  = amountReceived (前端 base)
flow_amount_received  = flow_amount_receivedRaw ?? base_amount_received

amount_received       = flow_amount_received
flow_amount_received  = flow_amount_received
```

- 付款状态：

```js
payment_status        = flow_payment_statusRaw || paymentStatus
flow_payment_status   = payment_status
```

**因此：**

- 详情页（flow 区）显示：`flow_amount_should` / `flow_amount_received`
- 列表 / 对账使用：`should_receive` / `amount_received`  
  在你当前业务设定下，两边金额实际是一致的。

### 3.4 回瓶后同步瓶子称重 & 状态

#### 3.4.1 状态同步

见前文 `updateBottleStatusByNumber`：

- 对所有 `out_items`：`status = 'at_customer'`
- 对所有 `back_items`：`status = 'in_station'`

#### 3.4.2 批量称重更新（调用 `crm-bottle` 云函数）

构造 `returnItems`：

```js
returnItems = back_items.map(b => ({
  number: b.bottle_no.trim(),
  return_gross: b.gross,
  return_tare:  b.tare
}))
```

然后调用：

```js
uniCloud.callFunction({
  name: 'crm-bottle',
  data: {
    action: 'updateAfterReturnBatch',
    token,
    data: { items: returnItems }
  }
})
```

由 `crm-bottle` 内部负责：

- 更新 `crm_bottles` 中对应瓶子的最新毛重 / 皮重 / 净重
- 做超差校验，返回 `anomalies`（差值超出阈值的瓶号）
- `crm-sale` 把异常拼成人话提示：

```js
保存成功，但有异常瓶子：1234(多 2kg)，5678(少 1.5kg)
```

> 这一步真正完成了 **「销售回瓶 → 瓶子称重记录 → 异常预警」** 的闭环。

### 3.5 存瓶逻辑：显式 + 隐式合并

- **显式存瓶**：用户在「存瓶」区域录入的 `depositRows`：

```js
depositNosExplicit = depositRows[].bottleInput.trim()
```

- **回瓶集合**：

```js
backSet = Set(back_items[].bottle_no.trim())
```

- **隐式存瓶（出瓶即存瓶）**：

```js
implicitDepositNos = out_items[].bottle_no.trim()
  排除：回瓶过的 + 显式存瓶过的
```

- 最终存瓶字段：

```js
allDepositNos = union(depositNosExplicit, implicitDepositNos)
deposit_bottles_raw = allDepositNos.join(' / ')
```

> 后续「瓶子流转查询」（`listByBottle`）会通过 `RegExp(no)` 在 `deposit_bottles_raw` 中识别「某次是存瓶事件」。

### 3.6 对账相关：`monthBill` / `statMonthlyByCustomer`

#### 3.6.1 monthBill（按天聚合 + 单客户单月）

过滤条件：

```js
where = {
  customer_id: cid,
  date: dbCmd.gte(`${month}-01`).and(dbCmd.lt(`${nextMonth}-01`))
}
```

金额 & 重量聚合：

```js
getOutNet(doc):
  doc.out_net_total ?? doc.net_weight_out ?? 0

getBackNet(doc):
  doc.back_net_total ?? doc.net_weight_back ?? 0

getShouldReceive(doc):
  doc.should_receive ?? doc.amount ?? 0
```

按 `doc.date` 聚合：

- `out_net` / `back_net` / `net_total`
- `should_receive`
- `amount_received`（直接用 `doc.amount_received`）
- `unpaid = should_receive - amount_received`

#### 3.6.2 statMonthlyByCustomer（类似月度对账的另外一版）

- 过滤：`customer_id + year/month`
- 逻辑相似，只是使用字段略偏旧版：
  - `should = doc.amount`
  - `rec = doc.amount_received`

> 你目前是 **增量兼容**：对账逻辑优先用新字段（`out_net_total` / `back_net_total` / `should_receive`），  
> 找不到时才退回旧字段（`net_weight_*` / `amount`）。

---

## 4. 字段流向速查表（核心字段）

> 只列“关键字段”，便于你在排查问题时快速定位。

| 维度 | 字段 | 来源模块 | 写入位置 | 说明 |
|------|------|----------|----------|------|
| 瓶号 | `number` | 瓶子入库 | `crm_bottles` | 全局主键 |
| 瓶号 | `bottle_no` | 销售录入 | `crm_sale_records.out_items/back_items` | 通过 `number` 关联回 `crm_bottles` |
| 状态 | `status` | 销售出/回瓶 | `crm_bottles` | `at_customer` / `in_station` |
| 客户 | `customer_id/name` | 销售单 | `crm_sale_records` & `crm_bottles` | `last_customer_*` 在瓶子上保留最近一次记录 |
| 净重 | `out_net_total/back_net_total` | 销售单 | `crm_sale_records` | 从明细行聚合或整车净重 |
| 净重 | `total_net_weight` | 销售单 | `crm_sale_records` | 用于对账、理论用气等 |
| 金额 | `should_receive` | 销售单（createV2/updateV2） | `crm_sale_records` | 本单理论应收（所有模式） |
| 金额 | `amount_received` | 销售单 | `crm_sale_records` | 本单实收，Flow 模式由 flow 字段覆盖 |
| Flow | `flow_index_prev/curr` | 销售抄表 | `crm_sale_records` | 非 m3 模式会被清空 |
| Flow | `flow_volume_m3` | 销售抄表 or 前端计算 | `crm_sale_records` | 用气量（m³） |
| Flow | `flow_unit_price` | 销售录入 | `crm_sale_records` | 流量单价，默认等于 `unit_price` |
| Flow | `flow_amount_should` | 销售录入 or 后端兜底 | `crm_sale_records` | 流量应收金额 |
| Flow | `flow_amount_received` | 销售录入 | `crm_sale_records` | Flow 模式实收金额 |
| Flow | `flow_theory_ratio` | 业务配置 | `crm_sale_records` | 理论换算系数（m³/kg） |
| Flow | `flow_theoretical_volume_m3` | 后端计算 | `crm_sale_records` | 按净重折算理论用气 |

---

## 5. 一句话记忆版

> **一只瓶子，从出生到客户手里再回站，一共只走三条线：**

1. **瓶子线：** `crm_bottles` 负责「这只瓶是谁、现在在哪、最近一次出/回情况」。  
2. **灌装线：** `crm_filling_records` 负责「它在站内被充装时的重量变化和异常记录」。  
3. **销售线：** `crm_sale_records` 负责「它在客户维度的出/回、结算金额，以及回站后的称重回写和状态变更」。

所有账、所有对账单、所有异常溯源，最终都能沿着这三条线，把一只瓶子的故事完整讲出来。
# ZJLNG 项目近期改动总览（更新版）

> 本文档总结自你上次 README 更新之后（大约 2025‑12‑07）至今日所有已完成的大规模修改。  
> 如需我 **自动生成精准 diff**，请上传仓库 ZIP 或授予仓库访问权限。

---

## 1. 新版销售记录 createV2 —— 核心系统升级
- 三条线（瓶装、整车、流量结算）完全统一结构。
- 流量结算卡片（Flow Card）独立显示并复用全局结算结构。
- 理论气量、应收、实收、抹零全部统一公式。
- 单价单位 m³ / kg / bottle 全局统一处理。
- createV2 后端脚本已完成历史数据清洗，字段统一。

---

## 2. Dashboard 工作台升级
- 今日销售额、今日出气量点击跳转修复（不再空白页）。
- 出气量计算方式：**所有客户今日出瓶净重求和**。
- 卡片 UI 与列表统一。

---

## 3. 灌装 Filling 全链路统一
### UI 变化
- 表格完全居中，列宽对齐 customer/sale 风格。
- 编辑按钮换成小圆角浅色按钮（更贴合主题）。

### 功能优化
- 模糊搜索瓶号（支持自动提示）。
- 非管理员不可提交（禁用表单 + 半透明）。
- 本地校验优化。

---

## 4. 瓶子三条线完全统一
- 所有页面展示严格按照 last_xxx、filling_xxx、next_out_xxx 三条线渲染。
- 修复历史字段命名不一致造成的展示错位。
- 更新瓶子详情页对齐新的数据字典。

---

## 5. 客户管理（customer）
- 电话输入过滤（仅数字和 -）。
- 手机号友好校验（不阻塞保存）。
- 默认单价、计价方式 picker 统一。
- 启用/停用 UI 更新。
- 未登录文案统一处理。
- 编辑页 UI 全面升级。

---

## 6. 配送员管理（delivery）
- 全新列表页 + 状态标签（在职、请假、离职）。
- 状态兼容 active / on_leave / leave。
- 新增/编辑页全量重写。
- 删除确认逻辑统一。
- 权限区分（只有管理员可编辑删除）。

---

## 7. 车辆管理（vehicle）
- 新列表 UI 完成。
- 新增/编辑弹窗统一主题。
- 删除、登录态、权限逻辑与其他模块统一。

---

## 8. 全局权限与登录状态统一
你整个项目所有未登录提示已统一为：

- “请先登录”
- “登录已过期，请重新登录”

并且跳转方式统一为：

```js
uni.reLaunch({ url: '/pages/login/login' })
```

避免 navigateTo 导致返回逻辑混乱。

---

## 9. 全局 UI 统一
- 所有 card、input-wrapper、button 重新匹配主题。
- 列表行、行间距、卡片阴影统一。
- BackToDashboardBar 作为唯一返回组件使用。

---

## 10. 后端云函数对应改动（需要你上传代码确认）
- crm-sale
- crm-bill
- crm-filling
- crm-bottle
- crm-customer
- crm-delivery
- crm-vehicle

我可以在你上传仓库代码后，为以上每个函数生成完整变更记录说明。

---

## 11. 下一步你可以让我做的（任选）
- 自动生成 **完整项目变更日志 Changelog.md**
- 自动生成 **技术文档**（数据库字典、三条线流程图、API 规范）
- 自动升级所有页面代码风格统一（已完成部分）
- 自动检查所有页面的“未登录提示”剩余遗漏
- 自动扫描所有云函数并输出参数校验问题

---

如需我把这份文件 **自动写入你的 README.md** 或创建新文件，请告诉我。

