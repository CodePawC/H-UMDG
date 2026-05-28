# H-UDMP 主数据对外服务联调说明

## 1. 接口基础地址

本地联调环境：

```text
http://127.0.0.1:8101/api/v1/master-data
```

医疗器械分类目录接口前缀：

```text
http://127.0.0.1:8101/api/v1/master-data/device-classification
```

## 2. 鉴权方式

支持以下任一请求头：

```http
Authorization: Bearer {api_key}
```

或：

```http
X-API-Key: {api_key}
```

联调阶段预置调用方：

| client_id | 调用方 | API Key | 默认权限 |
| --- | --- | --- | --- |
| HOSPITAL_DATA_BUS | 医院数据总线 | `hudmp-dbus-dev-20260525` | read/tree/changes |
| EQUIPMENT_OS | 医学装备运营平台 | `hudmp-equipment-os-dev-20260525` | read/tree/changes |
| HIS | HIS系统 | `hudmp-his-dev-20260525` | read/tree/changes |
| SPD | SPD系统 | `hudmp-spd-dev-20260525` | read/tree/changes |
| MEDICAL_INSURANCE | 医保接口平台 | `hudmp-mi-dev-20260525` | read/tree/changes |

默认开放 Scope：

```text
md:device-classification:read
md:device-classification:tree
md:device-classification:changes
```

## 3. 统一响应格式

成功：

```json
{
  "success": true,
  "code": "OK",
  "message": "success",
  "data": {},
  "traceId": "req-xxxx",
  "timestamp": "2026-05-25T09:30:00+00:00"
}
```

分页：

```json
{
  "records": [],
  "page": 1,
  "pageSize": 20,
  "total": 0
}
```

失败：

```json
{
  "success": false,
  "code": "API_KEY_INVALID",
  "message": "API Key invalid or disabled",
  "data": null,
  "traceId": "req-xxxx",
  "timestamp": "2026-05-25T09:30:00+00:00"
}
```

## 4. 接口清单

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/device-classification/catalog` | 当前有效目录列表 |
| GET | `/device-classification/catalog/{id}` | 单条目录详情 |
| GET | `/device-classification/catalog/by-code/{code}` | 按编码查询目录详情 |
| GET | `/device-classification/tree` | 分类树 |
| GET | `/device-classification/current-version` | 当前启用版本 |
| GET | `/device-classification/changes` | 增量变更 |
| GET | `/health` | 主数据服务健康检查 |

## 5. 请求示例

当前有效目录：

```bash
curl -H "Authorization: Bearer hudmp-dbus-dev-20260525" \
  "http://127.0.0.1:8101/api/v1/master-data/device-classification/catalog?keyword=手术&page=1&pageSize=20"
```

按编码查询：

```bash
curl -H "X-API-Key: hudmp-dbus-dev-20260525" \
  "http://127.0.0.1:8101/api/v1/master-data/device-classification/catalog/by-code/01"
```

分类树：

```bash
curl -H "Authorization: Bearer hudmp-dbus-dev-20260525" \
  "http://127.0.0.1:8101/api/v1/master-data/device-classification/tree?maxDepth=3"
```

当前启用版本：

```bash
curl -H "Authorization: Bearer hudmp-dbus-dev-20260525" \
  "http://127.0.0.1:8101/api/v1/master-data/device-classification/current-version"
```

增量变更：

```bash
curl -H "Authorization: Bearer hudmp-dbus-dev-20260525" \
  "http://127.0.0.1:8101/api/v1/master-data/device-classification/changes?since=2026-05-25T00:00:00Z&page=1&pageSize=50"
```

健康检查：

```bash
curl -H "Authorization: Bearer hudmp-dbus-dev-20260525" \
  "http://127.0.0.1:8101/api/v1/master-data/health"
```

## 6. 响应示例

目录列表：

```json
{
  "success": true,
  "code": "OK",
  "message": "success",
  "data": {
    "records": [
      {
        "id": "f7a0f2d0-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        "code": "01",
        "parentId": "01",
        "level": 3,
        "name": "超声手术设备",
        "majorCategoryCode": "01",
        "majorCategoryName": "有源手术器械",
        "productDescription": "用于手术操作",
        "intendedUse": "临床手术",
        "productExamples": "高频手术设备",
        "managementClass": "II",
        "status": "effective"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 1
  },
  "traceId": "req-xxxx",
  "timestamp": "2026-05-25T09:30:00+00:00"
}
```

健康检查：

```json
{
  "success": true,
  "code": "OK",
  "message": "success",
  "data": {
    "status": "ok",
    "database": "ok",
    "timestamp": "2026-05-25T09:30:00+00:00"
  },
  "traceId": "req-xxxx",
  "timestamp": "2026-05-25T09:30:00+00:00"
}
```

## 7. 错误码

| code | HTTP | 说明 |
| --- | --- | --- |
| API_KEY_MISSING | 401 | 未提供 API Key |
| API_KEY_INVALID | 401 | API Key 错误、禁用或不存在 |
| SCOPE_FORBIDDEN | 403 | 调用方缺少所需 Scope |
| CATALOG_NOT_FOUND | 404 | 目录条目不存在或不可见 |
| INVALID_SINCE | 400 | `since` 不是合法 ISO 时间 |
| INTERNAL_ERROR | 500 | 主数据服务内部异常 |

## 8. 联调注意事项

- 对外接口默认只返回 `effective` 数据。
- `pending_confirm`、`parse_abnormal`、`corrected`、`deprecated`、`merged`、`rollbacked` 默认不返回。
- 分类树默认不会返回 `-子目录` 等解析异常项。
- `includeDeprecated=true` 或非 `effective` 状态查询需要额外历史数据 Scope，默认联调 Key 不开放。
- 每次调用都会写入 `api_call_log`，包括失败鉴权、查询参数、耗时、客户端 IP、user agent 和结果数量。
- 建议调用方每次请求传入 `X-Request-ID`，便于双方按 `traceId` 对账排障。
