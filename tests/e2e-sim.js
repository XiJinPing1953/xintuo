const fs = require('fs')
const path = require('path')
const vm = require('vm')
const assert = require('assert')

function createUniMock(initialStorage = {}) {
  const storage = { ...initialStorage }
  const calls = {
    showToast: [],
    reLaunch: [],
    showLoading: [],
    hideLoading: [],
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
    showLoading(payload) {
      calls.showLoading.push(payload)
    },
    hideLoading() {
      calls.hideLoading.push(true)
    },
    reLaunch(payload) {
      calls.reLaunch.push(payload)
    }
  }

  return { uni, storage, calls }
}

function transformEsmToCjs(code) {
  const exportNames = []

  // 处理命名导入
  let transformed = code.replace(/import\s+{([^}]+)}\s+from\s+['"]([^'";]+)['"];?/g, (_m, imports, source) => {
    return `const {${imports.trim()}} = require('${source}')`
  })

  transformed.replace(/export\s+(async\s+)?function\s+(\w+)/g, (_m, asyncPrefix, name) => {
    exportNames.push(name)
    return asyncPrefix ? `async function ${name}` : `function ${name}`
  })
  transformed.replace(/export\s+const\s+(\w+)/g, (_, name) => {
    exportNames.push(name)
    return ''
  })

  transformed = transformed.replace(/export\s+(async\s+)?function\s+(\w+)/g, (_m, asyncPrefix, name) => {
    return `${asyncPrefix ? 'async ' : ''}function ${name}`
  })
  transformed = transformed.replace(/export\s+const\s+(\w+)/g, 'const $1')
  transformed += `\nmodule.exports = { ${exportNames.join(', ')} }\n`
  return transformed
}

async function loadModule(relPath, context) {
  const absPath = path.join(__dirname, '..', relPath)
  const code = await fs.promises.readFile(absPath, 'utf8')
  const transformed = transformEsmToCjs(code)
  const script = new vm.Script(transformed, { filename: absPath })
  const module = {
    exports: {},
    filename: absPath,
    paths: require('module')._nodeModulePaths(path.dirname(absPath))
  }
  const defaultRequire = require('module').createRequire(absPath)
  const moduleRequire = (request) => {
    if (context && context.__mockModules && context.__mockModules[request]) {
      return context.__mockModules[request]
    }
    return defaultRequire(request)
  }
  const sandbox = Object.assign({ module, exports: module.exports, require: moduleRequire }, context)
  const vmContext = vm.createContext(sandbox)
  script.runInContext(vmContext)
  return module.exports
}

function createBackend() {
  const state = {
    tokens: new Map(),
    users: [
      {
        _id: 'u-super',
        username: 'superadmin',
        password: 'y7ez5CGAbivZkeP',
        role: 'superadmin'
      }
    ],
    vehicles: [
      {
        _id: 'v-1',
        plate_no: '粤A12345',
        name: '运货车',
        remark: '默认车辆',
        maintain_logs: [
          {
            date: '2024-05-01',
            project: '柴油加注',
            quantity: 1,
            unit_price: 500,
            amount: 500,
            staff: '王师傅'
          }
        ],
        insurance_at: '2024-12-01',
        inspection_at: '2024-12-15'
      }
    ]
  }

  function verifyToken(token) {
    const record = state.tokens.get(token)
    if (!record) return null
    if (record.expiresAt && Date.now() > record.expiresAt) return null
    return record.user
  }

  async function handleAuth(data = {}) {
    const { action, data: payload = {} } = data
    if (action !== 'login') {
      return { result: { code: 400, msg: '不支持的操作' } }
    }

    const user = state.users.find((u) => u.username === payload.username)
    if (!user || user.password !== payload.password) {
      return { result: { code: 401, msg: '账号或密码错误' } }
    }

    const token = `tk-${Date.now()}`
    const expiresAt = Date.now() + 1000 * 60 * 30
    state.tokens.set(token, { user, expiresAt })

    return {
      result: {
        code: 0,
        token,
        expire_at: expiresAt,
        user: { _id: user._id, role: user.role, username: user.username }
      }
    }
  }

  function normalizeMaintainLogs(logs = []) {
    const list = Array.isArray(logs) ? logs : []
    const fixed = list.map((item) => ({
      ...item,
      amount: Number(item.amount) || 0,
      unit_price: Number(item.unit_price) || 0,
      quantity: Number(item.quantity) || 0
    }))
    const total = fixed.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
    return { list: fixed, total }
  }

  async function handleVehicle(data = {}) {
    const { action, token, data: payload = {} } = data
    const user = verifyToken(token)
    if (!user) return { result: { code: 401, msg: '未登录或登录已过期' } }

    if (action === 'list') {
      const mapped = state.vehicles.map((v) => {
        const { list, total } = normalizeMaintainLogs(v.maintain_logs)
        return {
          ...v,
          maintain_logs: list,
          maintain_total_amount: total,
          maintain_times: list.length
        }
      })
      return { result: { code: 0, data: mapped, total: mapped.length } }
    }

    if (action === 'create') {
      const nextId = `v-${state.vehicles.length + 1}`
      const { list, total } = normalizeMaintainLogs(payload.maintain_logs)
      const record = {
        _id: nextId,
        plate_no: payload.plate_no,
        name: payload.name || '',
        remark: payload.remark || '',
        insurance_at: payload.insurance_at,
        inspection_at: payload.inspection_at,
        maintain_logs: list,
        maintain_total_amount: total,
        maintain_times: list.length
      }
      state.vehicles.push(record)
      return { result: { code: 0, data: record } }
    }

    if (action === 'update') {
      const target = state.vehicles.find((v) => v._id === payload.id)
      if (!target) return { result: { code: 404, msg: '车辆不存在' } }
      const { list, total } = normalizeMaintainLogs(payload.maintain_logs || target.maintain_logs)
      Object.assign(target, {
        maintain_logs: list,
        maintain_total_amount: total,
        maintain_times: list.length,
        insurance_at: payload.insurance_at || target.insurance_at,
        inspection_at: payload.inspection_at || target.inspection_at
      })
      return { result: { code: 0, data: target } }
    }

    return { result: { code: 400, msg: '不支持的操作' } }
  }

  async function callFunction({ name, data }) {
    if (name === 'crm-auth') return handleAuth(data)
    if (name === 'crm-vehicle') return handleVehicle(data)
    return { result: { code: 404, msg: '未知云函数' } }
  }

  return { callFunction, state }
}

function createE2EContext(initialStorage = {}) {
  const { uni, storage, calls } = createUniMock(initialStorage)
  const backend = createBackend()

  const context = {
    console,
    uni,
    uniCloud: { callFunction: backend.callFunction },
    getCurrentPages: () => [],
    setTimeout: (fn) => {
      fn()
      return 1
    },
    clearTimeout: () => {}
  }

  return { context, uni, storage, calls, backend }
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

  await test('超管登录后创建车辆并追加维保记录全链路成功', async () => {
    const { context, calls, backend } = createE2EContext()
    const auth = await loadModule('common/auth.js', context)
    context.__mockModules = { './auth.js': auth }
    const api = await loadModule('common/api.js', context)
    const maintain = await loadModule('common/maintain-log.js', context)

    const loginRes = await context.uniCloud.callFunction({
      name: 'crm-auth',
      data: { action: 'login', data: { username: 'superadmin', password: 'y7ez5CGAbivZkeP' } }
    })

    assert.strictEqual(loginRes.result.code, 0)
    auth.setToken(loginRes.result.token, { expireAt: loginRes.result.expire_at })
    auth.setUserInfo(loginRes.result.user)

    const createRes = await api.callApi('crm-vehicle', 'create', {
      plate_no: '粤B88888',
      name: '新车',
      remark: '端到端测试车辆'
    })
    assert.strictEqual(createRes.code, 0)

    const listRes = await api.callApi('crm-vehicle', 'list', {})
    assert.strictEqual(listRes.code, 0)
    assert.ok(Array.isArray(listRes.data))
    const created = listRes.data.find((v) => v._id === createRes.data._id)
    assert.ok(created)

    const newEntry = maintain.normalizeMaintainEntry({
      date: '2025-02-10',
      project: '柴油加注',
      unitPrice: '5',
      quantity: '10',
      amount: '',
      staff: '测试员'
    })
    assert.ok(newEntry)

    const updateRes = await api.callApi('crm-vehicle', 'update', {
      id: created._id,
      maintain_logs: [newEntry]
    })
    assert.strictEqual(updateRes.code, 0)
    assert.strictEqual(updateRes.data.maintain_times, 1)
    assert.ok(updateRes.data.maintain_total_amount >= 50)

    const reload = await api.callApi('crm-vehicle', 'list', {})
    const updated = reload.data.find((v) => v._id === created._id)
    assert.strictEqual(updated.maintain_times, 1)
    assert.ok(updated.maintain_total_amount >= 50)
    assert.strictEqual(calls.reLaunch.length, 0)
    assert.ok(backend.state.tokens.size >= 1)
  })

  await test('过期 token 调用 callApi 会触发登录重定向', async () => {
    const { context, calls } = createE2EContext()
    const auth = await loadModule('common/auth.js', context)
    context.__mockModules = { './auth.js': auth }
    const api = await loadModule('common/api.js', context)

    auth.setToken('expired-token', { expireAt: Date.now() - 1000 })
    auth.setUserInfo({ role: 'superadmin' })

    const res = await api.callApi('crm-vehicle', 'list', {}, { silentAuthRedirect: false })
    assert.strictEqual(res.code, 401)
    assert.strictEqual(calls.reLaunch.length, 1)
    assert.ok(calls.reLaunch[0].url.includes('/pages/login/login'))
  })

  console.log(`\n端到端测试完成：通过 ${passed}，失败 ${failed}`)
  if (failed > 0) {
    process.exitCode = 1
  }
}

run()
