/**
 * Cloudflare Pages Function: GET /api/sensors
 * OneNET Studio（新版）API 代理：查询设备最新数据点
 *
 * 平台：OneNET Studio（open.iot.10086.cn）
 * 接口：GET https://iot-api.heclouds.com/thingmodel/query-device-property
 * 鉴权：请求头 authorization: {accessKey}（新版，非旧版 api-key）
 *
 * 环境变量（本地开发写在 .dev.vars）：
 * - ONENET_PRODUCT_ID   产品 ID
 * - ONENET_DEVICE_NAME  设备名称
 * - ONENET_ACCESS_KEY   产品 AccessKey
 */

const ONENET_API_BASE = 'https://iot-api.heclouds.com'

// OneNET 物模型 identifier -> 前端字段名（只读传感器）
const IDENTIFIER_MAPPING = {
  temp: 'air_temp',
  hum: 'air_humidity',
  light: 'light_intensity',
  soil_moisture: 'soil_moisture',
  water_level: 'water_level',
}

// 可写属性：执行器开关 / 工作模式 / 自动模式阈值，从同一接口读回当前值
// ⚠️ 必须与 functions/api/control.js 的 WRITABLE_IDENTIFIERS 保持一致
const SWITCH_IDENTIFIERS = ['light_switch', 'fan', 'humidifier', 'irrigation', 'buzzer']
const THRESHOLD_IDENTIFIERS = ['temp_max', 'hum_min', 'soil_min', 'light_min', 'water_max']
const READBACK_IDENTIFIERS = new Set(['work_mode', ...SWITCH_IDENTIFIERS, ...THRESHOLD_IDENTIFIERS])

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
}

// 统一 JSON 响应（始终带上 CORS 头）
function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  })
}

/**
 * 生成 OneNET 安全鉴权 Token（HMAC-SHA1）
 * authorization = version=2022-05-01&res=products/{productId}&et={过期时间戳}&method=sha1&sign={签名}
 * StringForSignature = et + "\n" + method + "\n" + res + "\n" + version
 */
async function generateToken(productId, accessKey) {
  const version = '2022-05-01'
  const method = 'sha1'
  const res = `products/${productId}`
  // 1 小时有效期
  const et = Math.floor(Date.now() / 1000) + 3600

  const stringForSignature = `${et}\n${method}\n${res}\n${version}`

  // accessKey 是 base64 编码的密钥，先解码成二进制字节
  const binaryKey = atob(accessKey)
  const keyBytes = new Uint8Array(binaryKey.length)
  for (let i = 0; i < binaryKey.length; i++) {
    keyBytes[i] = binaryKey.charCodeAt(i)
  }

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes.buffer,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    new TextEncoder().encode(stringForSignature)
  )

  // 签名结果 base64 编码
  const sign = btoa(String.fromCharCode(...new Uint8Array(signature)))

  return (
    `version=${version}` +
    `&res=${encodeURIComponent(res)}` +
    `&et=${et}` +
    `&method=${method}` +
    `&sign=${encodeURIComponent(sign)}`
  )
}

/**
 * 兼容新版 API 的 data 结构：
 * 1) 数组（实际返回）：[{ identifier: 'temp', value: '25.2', time: 1790878355191, data_type: 'float' }, ...]
 *    注意 value 为字符串，且部分属性（如 fan_switch）没有 value 字段
 * 2) 对象：{ temp: 25.4, hum: 60.2 } 或 { temp: { value: 25.4, time: '...' } }
 */
function normalizeDatapoints(data) {
  const items = []

  if (Array.isArray(data)) {
    for (const item of data) {
      if (item && typeof item.identifier === 'string') {
        items.push(item)
      }
    }
    return items
  }

  if (data && typeof data === 'object') {
    for (const [identifier, entry] of Object.entries(data)) {
      if (entry && typeof entry === 'object' && !Array.isArray(entry) && 'value' in entry) {
        items.push({ identifier, value: entry.value, time: entry.time })
      } else {
        items.push({ identifier, value: entry })
      }
    }
  }

  return items
}

// 平台返回的 value 一律是字符串：数值形如 "25.2"，bool 形如 "true"/"false"
// 统一转成数字（bool → 1/0），转不动返回 null
function toNumber(value) {
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return 1
    if (normalized === 'false') return 0
    if (normalized === '') return null
  }
  const raw = Number(value)
  return Number.isFinite(raw) ? raw : null
}

// 按映射关系组装前端需要的数据（不做单位换算）
// 传感器用映射后的字段名，可写属性直接用 identifier 作为字段名
function buildSensorData(items) {
  const result = {}

  for (const item of items) {
    const identifier = item.identifier
    const field = IDENTIFIER_MAPPING[identifier]
    const isReadback = READBACK_IDENTIFIERS.has(identifier)
    if (!field && !isReadback) continue

    // 跳过没有 value 字段的属性（设备从未上报）
    if (item.value === undefined || item.value === null || item.value === '') continue

    const value = toNumber(item.value)
    if (value === null) continue

    result[field ?? identifier] = value
  }

  return result
}

export async function onRequestGet(context) {
  const { env } = context

  try {
    const productId = env.ONENET_PRODUCT_ID
    const deviceName = env.ONENET_DEVICE_NAME
    const accessKey = env.ONENET_ACCESS_KEY

    if (!productId || !deviceName || !accessKey) {
      return jsonResponse(500, { error: 'Missing OneNET environment variables' })
    }

    const url =
      `${ONENET_API_BASE}/thingmodel/query-device-property` +
      `?product_id=${encodeURIComponent(productId)}` +
      `&device_name=${encodeURIComponent(deviceName)}`

    const authorization = await generateToken(productId, accessKey)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        authorization,
        'Content-Type': 'application/json',
      },
    })

    // 响应非 200：返回 502 并透传错误信息
    if (!response.ok) {
      const details = await response.text()
      return jsonResponse(502, {
        error: `OneNET API error: ${response.status}`,
        details,
      })
    }

    const raw = await response.text()

    let body
    try {
      body = JSON.parse(raw)
    } catch {
      return jsonResponse(502, {
        error: 'Invalid JSON returned by OneNET',
        details: raw,
      })
    }

    // 业务 code 不为 0：返回 502 并透传错误信息
    if (body?.code !== 0) {
      return jsonResponse(502, {
        error: `OneNET API error code: ${body?.code}`,
        details: body?.msg ?? body,
      })
    }

    const data = buildSensorData(normalizeDatapoints(body.data))

    return jsonResponse(200, {
      success: true,
      data,
    })
  } catch (error) {
    return jsonResponse(500, {
      error: 'Failed to fetch from OneNET',
      details: error?.message ?? String(error),
    })
  }
}
