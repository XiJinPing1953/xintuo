const fs = require('fs')
const path = require('path')
const vm = require('vm')
const assert = require('assert')

function createUniMock(initialStorage = {}) {
  const storage = { ...initialStorage }
  const calls = {
    showToast: [],
    reLaunch: [],
    removeStorageSync: []
  }

  const uni = {
    getStorageSync(key) {
      return storage[key]
    },
    setStorageSync(key, value) {
      storage[key] = value
    },
    removeStorageSync(key) {
      delete storage[key]
      calls.removeStorageSync.push(key)
    },
    showToast(payload) {
      calls.showToast.push(payload)
    },
    reLaunch(payload) {
      calls.reLaunch.push(payload)
    }
  }

  return { uni, storage, calls }
}

function createTestContext(initialStorage = {}) {
  const { uni, storage, calls } = createUniMock(initialStorage)
  const context = {
    console,
    uni,
    getCurrentPages: () => [],
    setTimeout: (fn) => {
      fn()
      return 1
    },
    clearTimeout: () => {}
  }
  return { context, uni, storage, calls }
}

function transformEsmToCjs(code) {
  const exportNames = []

  code.replace(/export\s+function\s+(\w+)/g, (_, name) => {
    exportNames.push(name)
    return ''
  })
  code.replace(/export\s+const\s+(\w+)/g, (_, name) => {
    exportNames.push(name)
    return ''
  })

  let transformed = code.replace(/export\s+function\s+(\w+)/g, 'function $1')
  transformed = transformed.replace(/export\s+const\s+(\w+)/g, 'const $1')
  transformed += `\nmodule.exports = { ${exportNames.join(', ')} }\n`
  return transformed
}

async function loadModule(relPath, context) {
  const absPath = path.join(__dirname, '..', relPath)
  const code = await fs.promises.readFile(absPath, 'utf8')
  const transformed = transformEsmToCjs(code)
  const script = new vm.Script(transformed, { filename: absPath })
  const module = { exports: {} }
  const sandbox = Object.assign({ module, exports: module.exports, require }, context)
  const vmContext = vm.createContext(sandbox)
  script.runInContext(vmContext)
  return module.exports
}

async function run() {
  let passed = 0
  let failed = 0

  async function test(name, fn) {
    try {
      await fn()
      passed += 1
      console.log(`✅  ${name}`)
    } catch (err) {
      failed += 1
      console.error(`❌  ${name}`)
      console.error(err)
    }
  }

  await test('ensureLogin 未登录时跳转登录页', async () => {
    const ctx = createTestContext()
    const auth = await loadModule('common/auth.js', ctx.context)
    const result = auth.ensureLogin()
    assert.strictEqual(result, false)
    assert.strictEqual(ctx.calls.reLaunch.length, 1)
    assert.ok(ctx.calls.reLaunch[0].url.includes('/pages/login/login'))
    assert.deepStrictEqual(ctx.storage, {})
  })

  await test('ensureLogin 过期 token 会清理并跳转', async () => {
    const meta = { expiresAt: Date.now() - 10 }
    const ctx = createTestContext({ crm_token: 'abc', crm_token_meta: meta })
    const auth = await loadModule('common/auth.js', ctx.context)
    const result = auth.ensureLogin()
    assert.strictEqual(result, false)
    assert.strictEqual(ctx.calls.reLaunch.length, 1)
    assert.strictEqual(ctx.calls.removeStorageSync.includes('crm_token'), true)
  })

  await test('ensureLogin 有效 token 通过校验', async () => {
    const meta = { expiresAt: Date.now() + 1000 * 60 }
    const ctx = createTestContext({ crm_token: 'abc', crm_token_meta: meta })
    const auth = await loadModule('common/auth.js', ctx.context)
    const result = auth.ensureLogin()
    assert.strictEqual(result, true)
    assert.strictEqual(ctx.calls.reLaunch.length, 0)
  })

  await test('维护表单默认值与金额计算', async () => {
    const ctx = createTestContext()
    const maintain = await loadModule('common/maintain-log.js', ctx.context)
    const emptyFuel = maintain.createEmptyMaintainForm('fuel')
    assert.strictEqual(emptyFuel.mode, 'fuel')
    assert.strictEqual(emptyFuel.project, '汽油加注')
    const emptyService = maintain.createEmptyMaintainForm('service')
    assert.strictEqual(emptyService.project, '保养')

    const calc = maintain.calcAmount({ unitPrice: '5.5', quantity: '2', amountInput: '' })
    assert.strictEqual(calc, 11)
    const calcFallback = maintain.calcAmount({ unitPrice: 'x', quantity: '-1', amountInput: '' })
    assert.strictEqual(calcFallback, 0)
  })

  await test('normalizeMaintainEntry 过滤缺失字段并格式化', async () => {
    const ctx = createTestContext()
    const maintain = await loadModule('common/maintain-log.js', ctx.context)
    const invalid = maintain.normalizeMaintainEntry({ date: '', project: '汽油加注' })
    assert.strictEqual(invalid, null)

    const entry = maintain.normalizeMaintainEntry({
      date: '2025-12-10',
      project: '柴油加注',
      unitPrice: '5.123',
      quantity: '2',
      amount: '',
      part: '滤芯 ',
      mileage: '  1200 ',
      staff: ' 张三 ',
      remark: ' ok '
    })
    assert.ok(entry.local_id)
    assert.strictEqual(entry.unit_price, 5.12)
    assert.strictEqual(entry.quantity, 2)
    assert.strictEqual(entry.amount, 10.25)
    assert.strictEqual(entry.part, '滤芯')
    assert.strictEqual(entry.mileage, '1200')
    assert.strictEqual(entry.staff, '张三')
    assert.strictEqual(entry.remark, 'ok')
  })

  await test('车牌输入清洗与校验', async () => {
    const ctx = createTestContext()
    const plate = await loadModule('common/plate.js', ctx.context)
    const cleaned = plate.cleanPlateInput(' ab c-12*3中文 ', 8)
    assert.strictEqual(cleaned, 'ABC-123中')

    assert.strictEqual(plate.normalizePlate('粤A12345'), '粤A12345')
    assert.strictEqual(plate.normalizePlate('   '), '')
    assert.strictEqual(plate.normalizePlate('###'), null)
  })

  console.log(`\n测试完成：通过 ${passed}，失败 ${failed}`)
  if (failed > 0) {
    process.exitCode = 1
  }
}

run()
