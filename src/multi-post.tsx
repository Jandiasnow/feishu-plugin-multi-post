import React, { useRef } from 'react'
import { Alert, AlertProps, Input, Button, Space, Table, Select, Card, Progress, Modal, Collapse, message, Tooltip } from 'antd';
import { bitable } from '@lark-base-open/js-sdk';
import { PlusCircleOutlined, DeleteOutlined, RightOutlined, ExclamationCircleOutlined, DownloadOutlined, UploadOutlined, SaveOutlined, SendOutlined } from '@ant-design/icons';

interface HeaderConfig {
  key: string;
  field: string;
  value: string | string[];
  valueType: 'input' | 'field';
  fieldType?: 'string' | 'number' | 'boolean' | 'object' | 'array';
}

interface ResponseMapping {
  key: string;
  responseField: string;
  tableField: string;
  jsCode?: string;
}

interface ApiConfig {
  key: string;
  name: string;
  url: string;
  headers: HeaderConfig[];
  body: HeaderConfig[];
  allResponse?: any;
  responseMappings: ResponseMapping[];
  failureCodes: string;
  delay: number;
  batchSize: number;
  isBatchRequest: boolean;
  isArrayRequest: boolean;
  requestResponses?: Array<{
    row: number;
    request: any;
    response: any;
  }>;
  failures?: Array<{
    row: number;
    error: string;
    response?: any;
  }>;
}

// 审核页面组件
function Page() {
  const [info, setInfo] = React.useState('get table name, please waiting ....');
  const [alertType, setAlertType] = React.useState<AlertProps['type']>('info');
  const [startRow, setStartRow] = React.useState('1');
  const [endRow, setEndRow] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [apiConfigs, setApiConfigs] = React.useState<ApiConfig[]>([]);
  const [tableFields, setTableFields] = React.useState<{ label: string; value: string }[]>([]);
  const [expandedKeys, setExpandedKeys] = React.useState<string[]>([]);
  const [processingKey, setProcessingKey] = React.useState<string>('');
  const [progress, setProgress] = React.useState(0);
  const [completed, setCompleted] = React.useState(0);
  const [total, setTotal] = React.useState(0);
  const [selectedFailureConfig, setSelectedFailureConfig] = React.useState<string>('');
  const [isFailureModalVisible, setIsFailureModalVisible] = React.useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 通过路径获取嵌套值的函数
  const getValueByPath = (obj: any, path: string) => {
    const keys = path.split('.');
    let result = obj;
    
    for (const key of keys) {
      if (result === undefined || result === null) return undefined;
      
      // 尝试将键转换为数字（用于数组索引）
      const index = parseInt(key);
      if (!isNaN(index) && Array.isArray(result)) {
        result = result[index];
      } else {
        result = result[key];
      }
    }
    
    return result;
  };

  // 加载保存的配置
  React.useEffect(() => {
    const savedConfigs = localStorage.getItem('feishu-api-configs');
    if (savedConfigs) {
      try {
        const parsedConfigs = JSON.parse(savedConfigs);
        // 确保每个配置都有一个空的 allResponse
        const configsWithEmptyResponse = parsedConfigs.map((config: ApiConfig) => ({
          ...config,
          allResponse: undefined,
          failures: undefined,
        }));
        setApiConfigs(configsWithEmptyResponse);
      } catch (error) {
        console.error('Failed to load saved configs:', error);
      }
    }
  }, []);

  // 保存配置
  const handleSaveConfigs = () => {
    try {
      // 创建一个不包含 allResponse 的配置副本
      const configsToSave = apiConfigs.map(config => ({
        ...config,
        allResponse: undefined,
        failures: undefined
      }));
      localStorage.setItem('feishu-api-configs', JSON.stringify(configsToSave));
      setInfo('配置已保存');
      setAlertType('success');
    } catch (error) {
      console.error('Failed to save configs:', error);
      setInfo('保存配置失败');
      setAlertType('error');
    }
  };

  React.useEffect(() => {
    const fn = async () => {
      const table = await bitable.base.getActiveTable();
      const tableName = await table.getName();
      const fields = await table.getFieldMetaList();

      setTableFields(fields.map(field => ({
        label: field.name,
        value: field.name
      })));

      const views = await table.getViewMetaList();
      const firstView = views[0];
      if (!firstView) {
        throw new Error('No views found in table');
      }
      const view = await table.getViewById(firstView.id);
      const recordsIds = await view.getVisibleRecordIdList();
      setEndRow(recordsIds.length.toString());
      setInfo(`表格名是： ${tableName}`);
      setAlertType('success');
    };
    fn();
  }, []);

  const handleAddApiConfig = () => {
    const newConfig: ApiConfig = {
      key: Date.now().toString(),
      name: '',
      url: '',
      headers: [{ key: Date.now().toString(), field: '', value: '', valueType: 'input' }],
      body: [{ key: Date.now().toString(), field: '', value: '', valueType: 'field' }],
      responseMappings: [],
      failureCodes: '0',
      delay: 500,
      batchSize: 10,
      isBatchRequest: false,
      isArrayRequest: false
    };
    setApiConfigs([...apiConfigs, newConfig]);
    setExpandedKeys([...expandedKeys, newConfig.key]);
  };

  const handleRemoveApiConfig = (key: string) => {
    setApiConfigs(apiConfigs.filter(config => config.key !== key));
  };

  const handleApiConfigChange = (key: string, field: string, value: any) => {
    setApiConfigs(apiConfigs.map(config => 
      config.key === key ? { ...config, [field]: value } : config
    ));
  };

  const handleAddHeader = (apiKey: string) => {
    setApiConfigs(apiConfigs.map(config => {
      if (config.key === apiKey) {
        return {
          ...config,
          headers: [...config.headers, { key: Date.now().toString(), field: '', value: '', valueType: 'input' }]
        };
      }
      return config;
    }));
  };

  const handleRemoveHeader = (apiKey: string, headerKey: string) => {
    setApiConfigs(apiConfigs.map(config => {
      if (config.key === apiKey) {
        return {
          ...config,
          headers: config.headers.filter(header => header.key !== headerKey)
        };
      }
      return config;
    }));
  };

  const handleHeaderChange = (apiKey: string, headerKey: string, field: string, value: string) => {
    setApiConfigs(apiConfigs.map(config => {
      if (config.key === apiKey) {
        return {
          ...config,
          headers: config.headers.map(header => 
            header.key === headerKey ? { ...header, [field]: value } : header
          )
        };
      }
      return config;
    }));
  };

  const handleAddBody = (apiKey: string) => {
    setApiConfigs(apiConfigs.map(config => {
      if (config.key === apiKey) {
        return {
          ...config,
          body: [...config.body, { 
            key: Date.now().toString(), 
            field: '', 
            value: '', 
            valueType: 'field',
            fieldType: 'string'
          }]
        };
      }
      return config;
    }));
  };

  const handleRemoveBody = (apiKey: string, bodyKey: string) => {
    setApiConfigs(apiConfigs.map(config => {
      if (config.key === apiKey) {
        return {
          ...config,
          body: config.body.filter(item => item.key !== bodyKey)
        };
      }
      return config;
    }));
  };

  const handleBodyChange = (apiKey: string, bodyKey: string, field: string, value: string | string[]) => {
    setApiConfigs(apiConfigs.map(config => {
      if (config.key === apiKey) {
        return {
          ...config,
          body: config.body.map(item => 
            item.key === bodyKey ? { ...item, [field]: value } : item
          )
        };
      }
      return config;
    }));
  };

  const handleAddResponseMapping = (apiKey: string) => {
    setApiConfigs(apiConfigs.map(config => {
      if (config.key === apiKey) {
        return {
          ...config,
          responseMappings: [...config.responseMappings, { 
            key: Date.now().toString(), 
            responseField: '', 
            tableField: '',
            jsCode: ''
          }]
        };
      }
      return config;
    }));
  };

  const handleRemoveResponseMapping = (apiKey: string, mappingKey: string) => {
    setApiConfigs(apiConfigs.map(config => {
      if (config.key === apiKey) {
        return {
          ...config,
          responseMappings: config.responseMappings.filter(mapping => mapping.key !== mappingKey)
        };
      }
      return config;
    }));
  };

  const handleResponseMappingChange = (apiKey: string, mappingKey: string, field: string, value: string) => {
    setApiConfigs(apiConfigs.map(config => {
      if (config.key === apiKey) {
        return {
          ...config,
          responseMappings: config.responseMappings.map(mapping => 
            mapping.key === mappingKey ? { ...mapping, [field]: value } : mapping
          )
        };
      }
      return config;
    }));
  };

  const getColumns = (apiKey: string) => [
    {
      title: '字段名',
      dataIndex: 'field',
      key: 'field',
      width: "40%",
      render: (text: string, record: HeaderConfig) => (
        <Input
          value={text}
          onChange={e => handleHeaderChange(apiKey, record.key, 'field', e.target.value)}
          placeholder="请输入字段名"
        />
      ),
    },
    {
      title: '字段值',
      dataIndex: 'value',
      key: 'value',
      width: "40%",
      render: (text: string, record: HeaderConfig) => (
        <Space style={{ width: '100%' }}>
          <Select
            value={record.valueType}
            onChange={value => handleHeaderChange(apiKey, record.key, 'valueType', value)}
            style={{ width: 100 }}
            options={[
              { label: '输入', value: 'input' },
              { label: '关联', value: 'field' }
            ]}
          />
          {record.valueType === 'input' ? (
            <Input
              value={text}
              onChange={e => handleHeaderChange(apiKey, record.key, 'value', e.target.value)}
              placeholder="请输入字段值"
              style={{ flex: 1 }}
            />
          ) : (
            <Select
              style={{ flex: 1, minWidth: 200 }}
              value={text}
              onChange={value => handleHeaderChange(apiKey, record.key, 'value', value)}
              placeholder="选择关联字段"
              options={tableFields}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          )}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: HeaderConfig) => (
        <Button type="link" danger onClick={() => handleRemoveHeader(apiKey, record.key)}>
          删除
        </Button>
      ),
    },
  ];

  const getBodyColumns = (apiKey: string) => [
    {
      title: '字段名',
      dataIndex: 'field',
      key: 'field',
      width: "25%",
      render: (text: string, record: HeaderConfig) => (
        <Input
          value={text}
          onChange={e => handleBodyChange(apiKey, record.key, 'field', e.target.value)}
          placeholder="请输入字段名"
        />
      ),
    },
    {
      title: '字段类型',
      dataIndex: 'fieldType',
      key: 'fieldType',
      width: "15%",
      render: (text: string, record: HeaderConfig) => (
        <Select
          value={record.fieldType || 'string'}
          onChange={value => handleBodyChange(apiKey, record.key, 'fieldType', value)}
          style={{ width: '100%' }}
          options={[
            { label: '字符串', value: 'string' },
            { label: '数字', value: 'number' },
            { label: '布尔值', value: 'boolean' },
            { label: '对象', value: 'object' },
            { label: '数组', value: 'array' }
          ]}
        />
      ),
    },
    {
      title: '字段值',
      dataIndex: 'value',
      key: 'value',
      width: "50%",
      render: (text: string | string[], record: HeaderConfig) => (
        <Space style={{ width: '100%' }}>
          <Select
            value={record.valueType}
            onChange={value => handleBodyChange(apiKey, record.key, 'valueType', value)}
            style={{ width: 100 }}
            options={[
              { label: '输入', value: 'input' },
              { label: '关联', value: 'field' }
            ]}
          />
          {record.valueType === 'input' ? (
            record.fieldType === 'array' ? (
              <Input.TextArea
                value={Array.isArray(text) ? text.join('\n') : text}
                onChange={e => handleBodyChange(apiKey, record.key, 'value', e.target.value.split('\n').filter(Boolean))}
                placeholder="请输入数组值，每行一个"
                style={{ flex: 1 }}
                autoSize={{ minRows: 2, maxRows: 6 }}
              />
            ) : (
              <Input
                value={typeof text === 'string' ? text : (Array.isArray(text) ? text[0] : '')}
                onChange={e => handleBodyChange(apiKey, record.key, 'value', e.target.value)}
                placeholder="请输入字段值"
                style={{ flex: 1 }}
              />
            )
          ) : (
            <Select
              style={{ flex: 1, minWidth: 200 }}
              value={text}
              onChange={value => handleBodyChange(apiKey, record.key, 'value', value)}
              placeholder="选择关联字段"
              options={tableFields}
              showSearch
              mode={record.fieldType === 'array' ? 'multiple' : undefined}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          )}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: HeaderConfig) => (
        <Button type="link" danger onClick={() => handleRemoveBody(apiKey, record.key)}>
          删除
        </Button>
      ),
    },
  ];

  const handleReview = async (configKey: string) => {
    try {
      setLoading(true);
      setProcessingKey(configKey);
      setInfo('正在解析数据，请稍候...');
      setAlertType('info');
      setProgress(0);
      setCompleted(0);

      const selectedConfig = apiConfigs.find(config => config.key === configKey);
      if (!selectedConfig) {
        setInfo('配置不存在');
        setAlertType('error');
        setLoading(false);
        return;
      }

      // 清空当前配置的响应数据和失败记录
      setApiConfigs(apiConfigs.map(config => 
        config.key === configKey 
          ? { ...config, allResponse: [], failures: [] }
          : config
      ));

      const start = parseInt(startRow);
      const end = parseInt(endRow);
      
      if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
        setInfo('请输入有效的行号范围');
        setAlertType('error');
        setLoading(false);
        return;
      }

      const table = await bitable.base.getActiveTable()
      const views = await table.getViewMetaList();
      const firstView = views[0];
      if (!firstView) {
        throw new Error('No views found in table');
      }
      const view = await table.getViewById(firstView.id);
      const recordsIds = await view.getVisibleRecordIdList();
      const fields = await table.getFieldMetaList();
      const parsedRecords = await Promise.all(
        recordsIds
          .filter((id): id is string => !!id)
          .slice(start - 1, end)
          .map(async (recordId) => {
            const recordData: {
              postData: Record<string, string>;
              recordId: string;
              fields: any[];
            } = {
              postData: {},
              recordId,
              fields: []
            };
            for (const field of fields) {
              const fieldName = field.name;
              const cellValue = await table.getCellString(field.id, recordId);
              
              // 从请求体配置中查找关联字段
              const bodyField = selectedConfig.body.find(item => 
                item.valueType === 'field' && item.value === fieldName
              );
              
              if (bodyField) {
                recordData.postData[fieldName] = cellValue || '';
              }
              recordData.fields = fields;
            }
            return recordData;
          })
      );

      setInfo('正在处理数据，请稍候...');
      const totalRecords = parsedRecords.length;
      setTotal(totalRecords);
      let completedRecords = 0;
      let newFailures: Array<{row: number, error: string, response?: any}> = [];
      let allResponses: any[] = [];

      if (selectedConfig.isArrayRequest) {
        // 数组请求处理逻辑
        try {
          const requestHeaders: Record<string, string> = {
            'Content-Type': 'application/json'
          };

          // 添加自定义请求头
          for (const header of selectedConfig.headers) {
            if (header.field) {
              const fieldValue = header.valueType === 'input' 
                ? (Array.isArray(header.value) ? header.value[0] : header.value)
                : '';
              requestHeaders[header.field] = fieldValue;
            }
          }

          // 构建请求体数组
          const requestBodyArray = parsedRecords.map(record => {
            const requestBody: Record<string, any> = {};
            for (const body of selectedConfig.body) {
              if (body.field) {
                let fieldValue: any;
                
                if (body.valueType === 'input') {
                  fieldValue = body.value;
                } else {
                  if (body.fieldType === 'array' && Array.isArray(body.value)) {
                    fieldValue = body.value.map(fieldName => record.postData[fieldName] || '');
                  } else {
                    const value = body.value as string;
                    fieldValue = record.postData[value] || '';
                  }
                }
                
                // 根据字段类型转换值
                let convertedValue: any = fieldValue;
                switch (body.fieldType) {
                  case 'number':
                    convertedValue = Number(fieldValue);
                    break;
                  case 'boolean':
                    convertedValue = fieldValue.toLowerCase() === 'true';
                    break;
                  case 'object':
                    try {
                      convertedValue = JSON.parse(fieldValue);
                    } catch (e) {
                      convertedValue = fieldValue;
                    }
                    break;
                  case 'array':
                    if (body.valueType === 'input') {
                      convertedValue = Array.isArray(fieldValue) ? fieldValue : fieldValue.split('\n').filter(Boolean);
                    } else {
                      convertedValue = fieldValue;
                    }
                    break;
                  default:
                    convertedValue = fieldValue;
                }
                
                requestBody[body.field] = convertedValue;
              }
            }
            return requestBody;
          });

          const response = await fetch(selectedConfig.url, {
            method: 'POST',
            headers: requestHeaders,
            body: JSON.stringify(requestBodyArray)
          });
          const data = await response.json();
          
          // 保存响应数据
          allResponses = Array.isArray(data) ? data : [data];

          // 处理响应数据
          const responseArray = Array.isArray(data) ? data : [data];
          for (let i = 0; i < parsedRecords.length; i++) {
            const record = parsedRecords[i];
            const responseData = responseArray[i];
            
            if (responseData) {
              // 检查是否为失败代码
              const failureCodes = selectedConfig.failureCodes.split(',').map(code => code.trim());
              const responseCode = responseData.code;
              if (failureCodes.includes(responseCode?.toString())) {
                newFailures.push({
                  row: start + i,
                  error: JSON.stringify(responseData, null, 2),
                  response: responseData
                });
                continue;
              }

              // 更新响应数据映射
              if (selectedConfig.responseMappings) {
                for (const mapping of selectedConfig.responseMappings) {
                  if (mapping.responseField && mapping.tableField) {
                    const field = record.fields.find((f: any) => f.name === mapping.tableField);
                    if (field) {
                      const responseValue = getValueByPath(responseData, mapping.responseField);
                      if (responseValue !== undefined) {
                        let finalValue = responseValue;
                        
                        if (mapping.jsCode) {
                          try {
                            const sandbox = { responseValue };
                            finalValue = new Function('responseValue', `return ${mapping.jsCode}`).call(sandbox, responseValue);
                          } catch (error) {
                            console.error('JS代码执行错误:', error);
                            finalValue = responseValue;
                          }
                        }
                        await table.setCellValue(field.id, record.recordId, JSON.stringify(finalValue));
                      }
                    }
                  }
                }
              }
            }

            completedRecords++;
            const currentProgress = Math.floor((completedRecords / totalRecords) * 100);
            setProgress(currentProgress);
            setCompleted(completedRecords);
            setInfo(`正在处理第 ${completedRecords}/${totalRecords} 条数据 (${currentProgress}%)`);
          }
        } catch (error: any) {
          console.error('数组请求处理失败:', error);
          setInfo('处理失败：' + (error.message || '未知错误'));
          setAlertType('error');
        }
      } else if (selectedConfig.isBatchRequest) {
        // 批量请求处理逻辑
        for (let i = 0; i < parsedRecords.length; i += selectedConfig.batchSize) {
          const batchRecords = parsedRecords.slice(i, i + selectedConfig.batchSize);
          try {
            const requestHeaders: Record<string, string> = {
              'Content-Type': 'application/json'
            };

            // 添加自定义请求头
            for (const header of selectedConfig.headers) {
              if (header.field) {
                const fieldValue = header.valueType === 'input' 
                  ? (Array.isArray(header.value) ? header.value[0] : header.value)
                  : '';  // 批量请求时不支持从记录中获取请求头
                requestHeaders[header.field] = fieldValue;
              }
            }

            // 构建批量请求体
            const batchRequestBody = batchRecords.map(record => {
              const requestBody: Record<string, any> = {};
              for (const body of selectedConfig.body) {
                if (body.field) {
                  let fieldValue: any;
                  
                  if (body.valueType === 'input') {
                    fieldValue = body.value;
                  } else {
                    if (body.fieldType === 'array' && Array.isArray(body.value)) {
                      fieldValue = body.value.map(fieldName => record.postData[fieldName] || '');
                    } else {
                      const value = body.value as string;
                      fieldValue = record.postData[value] || '';
                    }
                  }
                  
                  // 根据字段类型转换值
                  let convertedValue: any = fieldValue;
                  switch (body.fieldType) {
                    case 'number':
                      convertedValue = Number(fieldValue);
                      break;
                    case 'boolean':
                      convertedValue = fieldValue.toLowerCase() === 'true';
                      break;
                    case 'object':
                      try {
                        convertedValue = JSON.parse(fieldValue);
                      } catch (e) {
                        convertedValue = fieldValue;
                      }
                      break;
                    case 'array':
                      if (body.valueType === 'input') {
                        convertedValue = Array.isArray(fieldValue) ? fieldValue : fieldValue.split('\n').filter(Boolean);
                      } else {
                        convertedValue = fieldValue;
                      }
                      break;
                    default:
                      convertedValue = fieldValue;
                  }
                  
                  requestBody[body.field] = convertedValue;
                }
              }
              return requestBody;
            });

            const response = await fetch(selectedConfig.url, {
              method: 'POST',
              headers: requestHeaders,
              body: JSON.stringify(batchRequestBody)
            });
            const data = await response.json();
            
            // 保存响应数据
            if (Array.isArray(data)) {
              allResponses.push(...data);
            } else {
              allResponses.push(data);
            }

            // 处理响应数据
            const responseArray = Array.isArray(data) ? data : [data];
            for (let j = 0; j < batchRecords.length; j++) {
              const record = batchRecords[j];
              const responseData = responseArray[j];
              
              if (responseData) {
                // 检查是否为失败代码
                const failureCodes = selectedConfig.failureCodes.split(',').map(code => code.trim());
                const responseCode = responseData.code;
                if (failureCodes.includes(responseCode?.toString())) {
                  throw new Error(JSON.stringify(responseData, null, 2));
                }

                // 更新响应数据映射
                if (selectedConfig.responseMappings) {
                  for (const mapping of selectedConfig.responseMappings) {
                    if (mapping.responseField && mapping.tableField) {
                      const field = record.fields.find((f: any) => f.name === mapping.tableField);
                      if (field) {
                        const responseValue = getValueByPath(responseData, mapping.responseField);
                        if (responseValue !== undefined) {
                          let finalValue = responseValue;
                          
                          if (mapping.jsCode) {
                            try {
                              const sandbox = { responseValue };
                              finalValue = new Function('responseValue', `return ${mapping.jsCode}`).call(sandbox, responseValue);
                            } catch (error) {
                              console.error('JS代码执行错误:', error);
                              finalValue = responseValue;
                            }
                          }
                          await table.setCellValue(field.id, record.recordId, JSON.stringify(finalValue));
                        }
                      }
                    }
                  }
                }
              }
            }

            completedRecords += batchRecords.length;
            const currentProgress = Math.floor((completedRecords / totalRecords) * 100);
            setProgress(currentProgress);
            setCompleted(completedRecords);
            setInfo(`正在处理第 ${completedRecords}/${totalRecords} 条数据 (${currentProgress}%)`);

          } catch (error: any) {
            const actualRow = start + i;
            newFailures.push({
              row: actualRow,
              error: error.message || '未知错误',
              response: error.message ? JSON.parse(error.message) : undefined
            });
            completedRecords += batchRecords.length;
            const currentProgress = Math.floor((completedRecords / totalRecords) * 100);
            setProgress(currentProgress);
            setCompleted(completedRecords);
            setInfo(`正在处理第 ${completedRecords}/${totalRecords} 条数据 (${currentProgress}%)`);
          }
        }
      } else {
        // 原有的单条请求处理逻辑
        for (let i = 0; i < parsedRecords.length; i++) {
          const record = parsedRecords[i];
          try {
            // 构建请求头
            const requestHeaders: Record<string, string> = {
              'Content-Type': 'application/json'
            };
            
            // 添加自定义请求头
            for (const header of selectedConfig.headers) {
              if (header.field) {
                const fieldValue = header.valueType === 'input' 
                  ? (Array.isArray(header.value) ? header.value[0] : header.value)
                  : (record.postData[header.value as string] || '');
                requestHeaders[header.field] = fieldValue;
              }
            }

            // 构建请求体
            const requestBody: Record<string, any> = {};
            for (const body of selectedConfig.body) {
              if (body.field) {
                let fieldValue: any;
                
                if (body.valueType === 'input') {
                  fieldValue = body.value;
                } else {
                  // 如果是关联字段
                  if (body.fieldType === 'array' && Array.isArray(body.value)) {
                    // 如果是数组类型且值是数组，获取每个字段的值
                    fieldValue = body.value.map(fieldName => {
                      const postData = record.postData as { [key: string]: string };
                      return postData[fieldName] || '';
                    });
                  } else {
                    const value = body.value as string;
                    const postData = record.postData as { [key: string]: string };
                    fieldValue = postData[value] || '';
                  }
                }
                
                // 根据字段类型转换值
                let convertedValue: any = fieldValue;
                switch (body.fieldType) {
                  case 'number':
                    convertedValue = Number(fieldValue);
                    break;
                  case 'boolean':
                    convertedValue = fieldValue.toLowerCase() === 'true';
                    break;
                  case 'object':
                    try {
                      convertedValue = JSON.parse(fieldValue);
                    } catch (e) {
                      convertedValue = fieldValue;
                    }
                    break;
                  case 'array':
                    if (body.valueType === 'input') {
                      // 如果是手动输入的数组
                      convertedValue = Array.isArray(fieldValue) ? fieldValue : fieldValue.split('\n').filter(Boolean);
                    } else {
                      // 如果是关联字段的数组，fieldValue 已经是数组了
                      convertedValue = fieldValue;
                    }
                    break;
                  default:
                    convertedValue = fieldValue;
                }
                
                requestBody[body.field] = convertedValue;
              }
            }

            const response = await fetch(selectedConfig.url, {
              method: 'POST',
              headers: requestHeaders,
              body: JSON.stringify(requestBody)
            });
            const data = await response.json();
            
            // 保存响应数据
            allResponses.push(data);
        
            // 更新响应数据映射
            if (selectedConfig?.responseMappings) {
              // 如果响应是数组，使用当前索引获取对应的响应数据
              const responseData = Array.isArray(data) ? data[i] : data;
              
              for (const mapping of selectedConfig.responseMappings) {
                if (mapping.responseField && mapping.tableField) {
                  const field = record.fields.find((f: any) => f.name === mapping.tableField);
                  if (field) {
                    const responseValue = getValueByPath(responseData, mapping.responseField);
                    if (responseValue !== undefined) {
                      let finalValue = responseValue;
                      
                      // 如果设置了 JS 代码，则执行代码
                      if (mapping.jsCode) {
                        try {
                          // 创建一个安全的执行环境，只允许访问 responseValue
                          const sandbox = { responseValue };
                          finalValue = new Function('responseValue', `return ${mapping.jsCode}`).call(sandbox, responseValue);
                        } catch (error) {
                          console.error('JS代码执行错误:', error);
                          finalValue = responseValue;
                        }
                      }
                      await table.setCellValue(field.id, record.recordId, JSON.stringify(finalValue));
                    }
                  }
                }
              }
            }

            // 检查是否为失败代码
            const failureCodes = selectedConfig.failureCodes.split(',').map(code => code.trim());
            const responseCode = Array.isArray(data) ? data[i]?.code : data.code;
            if (failureCodes.includes(responseCode?.toString())) {
              throw new Error(JSON.stringify(Array.isArray(data) ? data[i] : data, null, 2));
            }

            completedRecords++;
            const currentProgress = Math.floor((completedRecords / totalRecords) * 100);
            setProgress(currentProgress);
            setCompleted(completedRecords);
            setInfo(`正在处理第 ${completedRecords}/${totalRecords} 条数据 (${currentProgress}%)`);

          } catch (error: any) {
            const actualRow = start + i;
            newFailures.push({
              row: actualRow,
              error: error.message || '未知错误',
              response: error.message ? JSON.parse(error.message) : undefined
            });
            completedRecords++;
            const currentProgress = Math.floor((completedRecords / totalRecords) * 100);
            setProgress(currentProgress);
            setCompleted(completedRecords);
            setInfo(`正在处理第 ${completedRecords}/${totalRecords} 条数据 (${currentProgress}%)`);
          }

          // 如果不是最后一条记录，等待配置的时间
          if (i < parsedRecords.length - 1) {
            setInfo(`等待${selectedConfig.delay}ms后处理下一条数据...`);
            await new Promise(resolve => setTimeout(resolve, selectedConfig.delay));
          }
        }
      }

      // 循环结束后一次性更新所有响应数据和失败记录
      setApiConfigs(apiConfigs.map(config => 
        config.key === configKey 
          ? { ...config, allResponse: allResponses, failures: newFailures }
          : config
      ));

      console.log(`第 ${start} 到 ${end} 行的数据：`, parsedRecords);
      
      if (newFailures.length > 0) {
        setInfo(`处理完成。成功：${totalRecords - newFailures.length}条，失败：${newFailures.length}条`);
        setAlertType('warning');
      } else {
        setInfo(`成功处理所有${totalRecords}条数据`);
        setAlertType('success');
      }

      setTimeout(() => {
        setProgress(0);
        setCompleted(0);
        setTotal(0);
      }, 1000);
    } catch (error: any) {
      console.log(error);
      setInfo('处理失败：' + (error.message || '未知错误'));
      setAlertType('error');
    } finally {
      setLoading(false);
      setProcessingKey('');
    }
  };

  const showFailureDetails = (configKey: string) => {
    setSelectedFailureConfig(configKey);
    setIsFailureModalVisible(true);
  };

  const handleImportJson = (apiKey: string, type: 'headers' | 'body') => {
    Modal.confirm({
      title: `导入${type === 'headers' ? '请求头' : '请求体'}配置`,
      width: 600,
      icon: null,
      content: (
        <div>
          <div style={{ marginBottom: '8px' }}>请选择 JSON 文件：</div>
          <input
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;

              const reader = new FileReader();
              reader.onload = async (e) => {
                try {
                  const jsonData = JSON.parse(e.target?.result as string);
                  
                  const newConfigs: HeaderConfig[] = Object.entries(jsonData).map(([field, value]) => ({
                    key: Date.now().toString() + Math.random(),
                    field,
                    value: value as string | string[],
                    valueType: 'input',
                    fieldType: Array.isArray(value) ? 'array' : 
                              typeof value === 'number' ? 'number' :
                              typeof value === 'boolean' ? 'boolean' :
                              typeof value === 'object' ? 'object' : 'string'
                  }));

                  setApiConfigs(apiConfigs.map(config => {
                    if (config.key === apiKey) {
                      return {
                        ...config,
                        [type]: newConfigs
                      };
                    }
                    return config;
                  }));

                  message.success('导入成功');
                } catch (error) {
                  message.error('JSON 格式错误，请检查文件');
                }
              };
              reader.readAsText(file);
            }}
          />
        </div>
      ),
      onOk: () => {
        // 重置 input 的值，这样相同的文件可以再次选择
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    });
  };

  const handleExportConfig = () => {
    try {
      // 准备要导出的配置数据
      const dataToExport = apiConfigs.map(cfg => ({
        ...cfg,
        allResponse: undefined,
        failures: undefined
      }));

      // 创建 Blob 对象
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // 创建下载链接
      const link = document.createElement('a');
      link.href = url;
      link.download = 'api-configs.json';
      document.body.appendChild(link);
      link.click();
      
      // 清理
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      message.success('导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败');
    }
  };

  const handleImportConfigs = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const jsonData = JSON.parse(e.target?.result as string);
        
        if (!Array.isArray(jsonData)) {
          throw new Error('配置数据必须是数组格式');
        }

        // 验证每个配置的必要字段
        jsonData.forEach((config, index) => {
          if (!config.name || !config.url || !Array.isArray(config.headers) || !Array.isArray(config.body)) {
            throw new Error(`第 ${index + 1} 个配置缺少必要字段`);
          }
        });

        // 为每个配置生成新的 key
        const newConfigs = jsonData.map(config => ({
          ...config,
          key: Date.now().toString() + Math.random(),
          allResponse: undefined,
          failures: undefined,
          delay: config.delay || 500,
          failureCodes: config.failureCodes || '0'
        }));

        setApiConfigs(newConfigs);
        message.success('导入成功');
      } catch (error: any) {
        message.error('导入失败：' + (error.message || '格式错误'));
      }
      // 重置 input 的值，这样相同的文件可以再次选择
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ padding: '20px' }}>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".json"
        onChange={handleFileSelect}
      />
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Alert message={info} type={alertType} />

        <div style={{ background: '#fafafa', padding: '16px', borderRadius: '6px' }}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <h3 style={{ margin: '0 0 16px 0' }}>处理范围</h3>
              <Space size={40}>
                <Space>
                  <span style={{ color: '#666' }}>开始行</span>
                  <Input 
                    placeholder="起始行号" 
                    value={startRow} 
                    onChange={e => setStartRow(e.target.value)}
                    style={{ width: 120 }}
                    disabled={loading}
                  />
                </Space>
                <Space>
                  <span style={{ color: '#666' }}>结束行</span>
                  <Input 
                    placeholder="结束行号" 
                    value={endRow} 
                    onChange={e => setEndRow(e.target.value)}
                    style={{ width: 120 }}
                    disabled={loading}
                  />
                </Space>
              </Space>
            </div>

            <div>
              <Space style={{ marginBottom: '16px' }} align="center">
                <h3 style={{ margin: 0 }}>API配置</h3>
                <div style={{ flex: 1 }} />
                <Space>
                  <Tooltip title="从文件导入配置">
                    <Button
                      type="link"
                      icon={<UploadOutlined />}
                      onClick={handleImportConfigs}
                    >
                    </Button>
                  </Tooltip>
                  <Tooltip title="导出配置到文件">
                    <Button
                      type="link"
                      icon={<DownloadOutlined />}
                      onClick={handleExportConfig}
                      disabled={apiConfigs.length === 0}
                    >
                    </Button>
                  </Tooltip>
                  <Tooltip title="保存配置到本地存储">
                    <Button 
                      type="link"
                      icon={<SaveOutlined />}
                      onClick={handleSaveConfigs}
                      disabled={loading}
                    >
                    </Button>
                  </Tooltip>
                </Space>
              </Space>

              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                {apiConfigs.map(config => (
                  <Card 
                    key={config.key}
                    style={{ width: '100%' }}
                    bodyStyle={{ padding: expandedKeys.includes(config.key) ? '16px' : '8px 16px' }}
                    title={
                      <div 
                        style={{ cursor: 'pointer' }} 
                        onClick={(e) => {
                          if (
                            e.target instanceof HTMLInputElement ||
                            e.target instanceof HTMLButtonElement ||
                            (e.target as HTMLElement).closest('button') ||
                            (e.target as HTMLElement).closest('input')
                          ) {
                            return;
                          }
                          setExpandedKeys(
                            expandedKeys.includes(config.key)
                              ? expandedKeys.filter(key => key !== config.key)
                              : [...expandedKeys, config.key]
                          );
                        }}
                      >
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                          <Space>
                            <span style={{ color: '#666' }}>名称</span>
                            <Input
                              placeholder="配置名称"
                              value={config.name}
                              onChange={e => handleApiConfigChange(config.key, 'name', e.target.value)}
                              style={{ width: 200 }}
                            />
                          </Space>
                          <Space>
                            {loading && processingKey === config.key && (
                              <div style={{ minWidth: '200px' }}>
                                <Progress 
                                  percent={progress} 
                                  status={progress === 100 ? 'success' : 'active'}
                                  format={percent => `${completed}/${total} (${percent}%)`}
                                />
                              </div>
                            )}
                            {(config.failures?.length ?? 0) > 0 && (
                              <Button
                                type="text"
                                danger
                                icon={<ExclamationCircleOutlined />}
                                onClick={() => showFailureDetails(config.key)}
                              >
                                {config.failures?.length ?? 0}条失败
                              </Button>
                            )}
                            <Tooltip title="发送API请求并处理数据">
                              <Button 
                                type="primary"
                                icon={<SendOutlined />}
                                onClick={() => handleReview(config.key)}
                                loading={loading && processingKey === config.key}
                                disabled={loading}
                              >
                                发送请求
                              </Button>
                            </Tooltip>
                            <Button 
                              type="text" 
                              danger 
                              icon={<DeleteOutlined />}
                              onClick={() => handleRemoveApiConfig(config.key)}
                            />
                            <RightOutlined 
                              style={{ 
                                transform: expandedKeys.includes(config.key) ? 'rotate(90deg)' : 'none',
                                transition: 'transform 0.3s',
                                fontSize: '12px',
                                color: '#999'
                              }} 
                            />
                          </Space>
                        </Space>
                      </div>
                    }
                  >
                    <div style={{ display: expandedKeys.includes(config.key) ? 'block' : 'none' }}>
                      <Space direction="vertical" size={16} style={{ width: '100%' }}>
                        <Space>
                          <span style={{ width: '100px', display: 'inline-block' }}>API地址</span>
                          <Input
                            value={config.url}
                            onChange={e => handleApiConfigChange(config.key, 'url', e.target.value)}
                            style={{ width: 400 }}
                            placeholder="请输入API地址"
                          />
                        </Space>
                        <Space>
                          <span style={{ width: '100px', display: 'inline-block' }}>失败代码</span>
                          <Input
                            value={config.failureCodes}
                            onChange={e => handleApiConfigChange(config.key, 'failureCodes', e.target.value)}
                            style={{ width: 400 }}
                            placeholder="请输入失败代码，多个代码用英文逗号分隔，例如：-1,1,2"
                          />
                        </Space>

                        <Space>
                          <span style={{ width: '100px', display: 'inline-block' }}>请求方式</span>
                          <Select
                            value={config.isArrayRequest ? 'array' : 'single'}
                            onChange={value => {
                              const isArray = value === 'array';
                              setApiConfigs(apiConfigs.map(c => 
                                c.key === config.key 
                                  ? { 
                                      ...c, 
                                      isArrayRequest: isArray,
                                      isBatchRequest: false 
                                    }
                                  : c
                              ));
                            }}
                            style={{ width: 120 }}
                            options={[
                              { label: '单条请求', value: 'single' },
                              { label: '数组请求', value: 'array' }
                            ]}
                          />
                          {!config.isArrayRequest && (
                            <Space>
                              <span style={{ marginLeft: '16px' }}>请求间隔(ms)</span>
                              <Input
                                type="number"
                                value={config.delay}
                                onChange={e => handleApiConfigChange(config.key, 'delay', parseInt(e.target.value) || 500)}
                                style={{ width: 120 }}
                                placeholder="请求间隔时间"
                              />
                            </Space>
                          )}
                        </Space>

                        <div style={{ borderTop: '1px dashed #d9d9d9', margin: '8px 0' }} />

                        <Space direction="vertical" style={{ width: '100%' }}>
                          <Space>
                            <span style={{ width: '100px', display: 'inline-block' }}>请求头配置</span>
                            <Button 
                              type="link" 
                              onClick={() => handleImportJson(config.key, 'headers')}
                              style={{ padding: 0 }}
                            >
                              导入 JSON
                            </Button>
                          </Space>
                          <Table
                            columns={getColumns(config.key)}
                            dataSource={config.headers}
                            rowKey="key"
                            pagination={false}
                            size="small"
                          />
                          <Button 
                            style={{ paddingLeft: 0 }} 
                            type="link" 
                            onClick={() => handleAddHeader(config.key)}
                          >
                            <PlusCircleOutlined /> 添加
                          </Button>
                        </Space>

                        <div style={{ borderTop: '1px dashed #d9d9d9', margin: '8px 0' }} />

                        <Space direction="vertical" style={{ width: '100%' }}>
                          <Space>
                            <span style={{ width: '100px', display: 'inline-block' }}>请求体配置</span>
                            <Button 
                              type="link" 
                              onClick={() => handleImportJson(config.key, 'body')}
                              style={{ padding: 0 }}
                            >
                              导入 JSON
                            </Button>
                          </Space>
                          <Table
                            columns={getBodyColumns(config.key)}
                            dataSource={config.body}
                            rowKey="key"
                            pagination={false}
                            size="small"
                          />
                          <Button 
                            style={{ paddingLeft: 0 }} 
                            type="link" 
                            onClick={() => handleAddBody(config.key)}
                          >
                            <PlusCircleOutlined /> 添加
                          </Button>
                        </Space>

                        <div style={{ borderTop: '1px dashed #d9d9d9', margin: '8px 0' }} />

                        <Space direction="vertical" style={{ width: '100%' }}>
                          <Space>
                            <span style={{ width: '100px', display: 'inline-block' }}>字段映射</span>
                          </Space>
                          <div style={{ marginBottom: '16px' }}>
                            <Table
                              dataSource={config.responseMappings}
                              columns={[
                                {
                                  title: '响应字段',
                                  dataIndex: 'responseField',
                                  key: 'responseField',
                                  width: '30%',
                                  render: (text: string, record: ResponseMapping) => (
                                    <Input
                                      value={text}
                                      onChange={e => handleResponseMappingChange(config.key, record.key, 'responseField', e.target.value)}
                                      placeholder="响应数据字段路径"
                                    />
                                  ),
                                },
                                {
                                  title: '目标字段',
                                  dataIndex: 'tableField',
                                  key: 'tableField',
                                  width: '30%',
                                  render: (text: string, record: ResponseMapping) => (
                                    <Select
                                      style={{ width: '100%' }}
                                      value={text}
                                      onChange={value => handleResponseMappingChange(config.key, record.key, 'tableField', value)}
                                      placeholder="选择目标字段"
                                      options={tableFields}
                                      showSearch
                                      filterOption={(input, option) =>
                                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                      }
                                    />
                                  ),
                                },
                                {
                                  title: 'JavaScript代码',
                                  dataIndex: 'jsCode',
                                  key: 'jsCode',
                                  width: '30%',
                                  render: (text: string, record: ResponseMapping) => (
                                    <Input.TextArea
                                      value={text}
                                      onChange={e => handleResponseMappingChange(config.key, record.key, 'jsCode', e.target.value)}
                                      placeholder="输入JavaScript代码，例如：responseValue > 0 ? '是' : '否'"
                                      autoSize={{ minRows: 1, maxRows: 3 }}
                                    />
                                  ),
                                },
                                {
                                  title: '操作',
                                  key: 'action',
                                  width: '10%',
                                  render: (_: any, record: ResponseMapping) => (
                                    <Button type="link" danger onClick={() => handleRemoveResponseMapping(config.key, record.key)}>
                                      删除
                                    </Button>
                                  ),
                                },
                              ]}
                              pagination={false}
                              size="small"
                            />
                            <Button type="link" onClick={() => handleAddResponseMapping(config.key)} style={{ marginTop: '8px' }}>
                              <PlusCircleOutlined /> 添加映射
                            </Button>
                          </div>
                        </Space>

                        <div style={{ borderTop: '1px dashed #d9d9d9', margin: '8px 0' }} />

                        <Space direction="vertical" style={{ width: '100%' }}>
                          <Space>
                            <span style={{ width: '100px', display: 'inline-block' }}>响应数据</span>
                          </Space>
                          <div style={{ 
                            background: '#f5f5f5', 
                            padding: '12px', 
                            borderRadius: '4px', 
                            width: 'calc(100% - 24px)',
                            maxHeight: '200px',
                            overflow: 'auto',
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            display: 'flex',
                            flexDirection: 'column'
                          }}>
                            <div style={{ width: '100%', overflowX: 'auto' }}>
                              {config.allResponse ? (
                                Array.isArray(config.allResponse) ? (
                                  <div>
                                    <div style={{ marginBottom: '8px', color: '#666' }}>
                                      共 {config.allResponse.length} 条响应数据：
                                    </div>
                                    {config.allResponse.map((item, index) => (
                                      <div key={index} style={{ 
                                        marginBottom: '8px',
                                        padding: '8px',
                                        background: '#fff',
                                        borderRadius: '4px'
                                      }}>
                                        <div style={{ marginBottom: '4px', color: '#666' }}>第 {index + 1} 条：</div>
                                        <div>{JSON.stringify(item, null, 2)}</div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  JSON.stringify(config.allResponse, null, 2)
                                )
                              ) : '暂无响应数据'}
                            </div>
                          </div>
                        </Space>
                      </Space>
                    </div>
                  </Card>
                ))}
              </Space>

              <Button style={{ paddingLeft: 0 }} type="link" onClick={handleAddApiConfig}>
                <PlusCircleOutlined /> 添加
              </Button>
            </div>
          </Space>
        </div>
      </Space>

      <Modal
        title="失败记录详情"
        open={isFailureModalVisible}
        onCancel={() => setIsFailureModalVisible(false)}
        footer={null}
        width={800}
      >
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {apiConfigs.find(config => config.key === selectedFailureConfig)?.failures?.map((failure, index) => (
            <Collapse
              key={index}
              style={{ marginBottom: '8px', background: '#fff' }}
              items={[
                {
                  key: '1',
                  label: (
                    <span style={{ color: '#ff4d4f' }}>
                      第{failure.row}行
                    </span>
                  ),
                  children: (
                    <pre style={{ 
                      margin: 0,
                      padding: '8px',
                      background: '#f5f5f5',
                      borderRadius: '4px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all'
                    }}>
                      {failure.response ? (
                        <div>
                          <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>响应数据：</div>
                          {JSON.stringify(failure.response, null, 2)}
                        </div>
                      ) : failure.error}
                    </pre>
                  )
                }
              ]}
            />
          ))}
        </div>
      </Modal>
    </div>
  );
}

export default Page;