import { useState } from 'react'
import { Button, Card, Empty, Space, Table, Tag, Upload, message } from 'antd'
import { CloudUploadOutlined, InboxOutlined, HistoryOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { HudmpApiClient } from '../lib/api'
import type { ApiResult, ImportReport, ImportTask } from '../types'

const { Dragger } = Upload

type ImportHistoryItem = {
  batch_id: string
  source_file_name: string
  source_type: string
  status: string
  source_row_count: number
  success_count: number
  failed_count: number
  created_at?: string | null
  finished_at?: string | null
}

export function DeviceClassificationImportWorkbench({
  client
}: {
  client?: HudmpApiClient
}) {
  const [uploading, setUploading] = useState(false)
  const [history, setHistory] = useState<ImportHistoryItem[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [lastResult, setLastResult] = useState<ImportReport | null>(null)

  const loadHistory = async () => {
    if (!client) return
    const result: ApiResult<{ items: ImportHistoryItem[] }> = await client.request('/api/v1/equipment/device-classifications/import/history')
    if (result.ok && result.data) {
      setHistory(result.data.items || [])
    }
  }

  const handleUpload = async (file: File) => {
    if (!client) return false
    setUploading(true)
    setLastResult(null)
    try {
      const formData = new FormData()
      formData.set('file', file)
      formData.set('source_system', 'MANUAL_IMPORT')
      formData.set('source_tx_id', `IMPORT-${Date.now()}`)

      const result: ApiResult<ImportReport> = await client.request(
        '/api/v1/equipment/device-classifications/import/preview',
        { method: 'POST', body: formData }
      )
      if (result.ok && result.data) {
        message.success(`导入完成：${result.data.success_count} 条成功`)
        setLastResult(result.data)
        loadHistory()
      } else {
        message.error(result.message || '导入失败')
      }
    } catch (e) {
      message.error('导入异常')
    } finally {
      setUploading(false)
    }
    return false
  }

  const columns: ColumnsType<ImportHistoryItem> = [
    { title: '文件名', dataIndex: 'source_file_name', ellipsis: true },
    { title: '状态', dataIndex: 'status', width: 100, render: (v: string) => <Tag color={v === 'completed' ? 'green' : 'orange'}>{v}</Tag> },
    { title: '总数', dataIndex: 'source_row_count', width: 80 },
    { title: '成功', dataIndex: 'success_count', width: 80 },
    { title: '失败', dataIndex: 'failed_count', width: 80 },
    { title: '时间', dataIndex: 'finished_at', width: 180, render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card title="医疗器械分类目录导入" style={{ marginBottom: 16 }}>
        <Dragger
          accept=".docx"
          multiple={false}
          showUploadList={false}
          beforeUpload={handleUpload}
          disabled={uploading}
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">点击或拖拽 医疗器械分类目录.docx 到此区域</p>
          <p className="ant-upload-hint">支持 NMPA 标准的医疗器械分类目录 docx 文件</p>
        </Dragger>
        {uploading && <div style={{ textAlign: 'center', padding: 16, color: '#1677ff' }}>正在导入中，请稍候...</div>}
      </Card>

      {lastResult && (
        <Card title="最近导入结果" size="small" style={{ marginBottom: 16 }}>
          <Space>
            <span>总行数: <Tag>{lastResult.source_row_count}</Tag></span>
            <span>成功: <Tag color="green">{lastResult.success_count}</Tag></span>
            <span>失败: <Tag color="red">{lastResult.failed_count}</Tag></span>
          </Space>
        </Card>
      )}

      <Card
        title="导入历史"
        size="small"
        extra={<Button size="small" icon={<HistoryOutlined />} onClick={loadHistory}>刷新</Button>}
      >
        {history.length === 0 ? (
          <Empty description="暂无导入历史" />
        ) : (
          <Table rowKey="batch_id" dataSource={history} columns={columns} size="small" pagination={{ pageSize: 10 }} />
        )}
      </Card>
    </div>
  )
}
