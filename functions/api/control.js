/**
 * Cloudflare Pages Function: POST /api/control
 * OneNET Studio（新版）API 代理：下发设备属性（物模型）
 *
 * 平台：OneNET Studio（open.iot.10086.cn）
 * 接口：POST https://iot-api.heclouds.com/thingmodel/set-device-property
 * 鉴权：请求头 authorization: {accessKey}（新版，非旧版 api-key）
 *
 * 请求体：{ "datastream": "fan_switch", "value": 1 }
 *
 * 环境变量（本地开发写在 .dev.vars）：
 * - ONENET_PRODUCT_ID   产品 ID
 * - ONENET_DEVICE_NAME  设备名称
 * - ONENET_ACCESS_KEY   产品 AccessKey
 */

const ONENET_API_BASE = 'https://iot-api.heclouds.com'

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

export async function onRequestPost(context) {
  const { request, env } = context

  try {
    const productId = env.ONENET_PRODUCT_ID
    const deviceName = env.ONENET_DEVICE_NAME
    const accessKey = env.ONENET_ACCESS_KEY

    if (!productId || !deviceName || !accessKey) {
      return jsonResponse(500, { success: false, error: 'Missing OneNET environment variables' })
    }

    // 解析请求体
    let payload
    try {
      payload = await request.json()
    } catch {
      return jsonResponse(400, { success: false, error: 'Invalid JSON body' })
    }

    const datastream = payload?.datastream
    const value = payload?.value

    if (!datastream || typeof datastream !== 'string') {
      return jsonResponse(400, { success: false, error: 'Missing "datastream" in request body' })
    }

    const response = await fetch(`${ONENET_API_BASE}/thingmodel/set-device-property`, {
      method: 'POST',
      headers: {
        authorization: accessKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_id: productId,
        device_name: deviceName,
        params: {
          [datastream]: value,
        },
      }),
    })

    const raw = await response.text()

    let body = null
    try {
      body = JSON.parse(raw)
    } catch {
      body = null
    }

    // 响应非 200：返回 502 并透传错误信息
    if (!response.ok) {
      return jsonResponse(502, {
        success: false,
        error: `OneNET API error: ${response.status}`,
        details: body ?? raw,
      })
    }

    if (!body) {
      return jsonResponse(502, {
        success: false,
        error: 'Invalid JSON returned by OneNET',
        details: raw,
      })
    }

    // 业务 code 不为 0：返回 502 并透传错误信息
    if (body?.code !== 0) {
      return jsonResponse(502, {
        success: false,
        error: `OneNET API error code: ${body?.code}`,
        details: body?.msg ?? body,
      })
    }

    return jsonResponse(200, {
      success: true,
      data: body.data ?? null,
    })
  } catch (error) {
    return jsonResponse(500, {
      success: false,
      error: 'Failed to control device',
      details: error?.message ?? String(error),
    })
  }
}
