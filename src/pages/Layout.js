import {Layout, Flex, Row, Col, Avatar, Typography, Button, Popover, List, Input, Space, theme, Collapse, Select, Modal, Form, Radio } from 'antd';
import {Toast, MarkdownRender} from '@douyinfe/semi-ui';
import { CopyOutlined, DeleteOutlined, WechatFilled, UserOutlined } from '@ant-design/icons';
import {Bubble, Conversations, Sender} from "@ant-design/x";
import {useEffect, useState, createContext, useContext} from "react";
import requests from '../utils/requests'
import { icons } from 'antd/es/image/PreviewGroup';

const MainContext = createContext({});

function ConversationMenu() {
    const [conversations, setConversations] = useState([]);
    const [searchValue, setSearchValue] = useState('');

    const {conversationId, setConversationId, selectedWechatBot} = useContext(MainContext);

    const getConversations = async () => {
        const response = await requests('api/conversations/list', { port: selectedWechatBot.port })
        setConversations(response?.data?.map(item => ({...item, key: item?.conversation_id, label: item?.summary})) || [])
        return response?.data || [];
    }

    useEffect(() => {
        if (selectedWechatBot?.port) {
            getConversations();
            setConversationId('');
        }
    }, [selectedWechatBot]);

    return (
        <Flex style={{ height: '100%', width: '100%' }} vertical>
            <div style={{paddingLeft: 10, paddingTop: 12, paddingRight: 10}}>
                <Button block color="primary" variant="outlined" >新对话</Button>
            </div>
            <div style={{paddingLeft: 10, paddingTop: 12, paddingRight: 10}}>
                <Input placeholder='搜索对话' onChange={event => setSearchValue(event.target.value)} />
            </div>
            <Conversations
                activeKey={conversationId}
                style={{ height: 'auto', width: '100%', margin: 0 }}
                items={conversations.filter(item => item.summary.includes(searchValue))}
                onActiveChange={key => {
                    setConversationId(key);
                }}
            />
        </Flex>
    )
}


function ChatBox ({  }) {    
    const {conversationId, selectedWechatBot} = useContext(MainContext);
    const MessageTools = ({messageItem}) => {
        const copyMessage = () => {
            window.navigator.clipboard.writeText(messageItem.content);
            Toast.success('已复制!')
        }
        return (
            <Space size={token.paddingXXS}>
                <Button color="default" variant="text" size="small" icon={<CopyOutlined />} onClick={copyMessage}  />
                <Button color="danger" variant="text" size="small" icon={<DeleteOutlined />} />
            </Space>
        )
    }

    const [messages, setMessages] = useState([]);
    const [roleConfig, setRoleConfig] = useState({
        assistant: { placement: 'start', avatar: {src: 'https://wxa.wxs.qq.com/wxad-design/yijie/phone-chat-icon-1.png', style: {background: '#00000000'}}} ,
        user: { placement: 'end', avatar: {src: selectedWechatBot?.info?.headImage, style: {background: '#00000000'}}},
        tools: {variant: 'borderless', placement: 'start'}
    })

    const {token} = theme.useToken();
    const getConversationMsg = id => {
        return new Promise((resolve, reject) => {
            if (!id) {
                resolve([]);
                return;
            }
            requests('api/conversations/messages', { conversation_id: id })
                .then(data => {
                    if (data?.code === 200) {
                        setMessages(data?.data);
                        resolve(data?.data);
                    } else {
                        resolve([]);
                    }
                })
        })
    }

    
    useEffect(() => {
        getConversationMsg(conversationId);
    }, [conversationId])

    useEffect(() => {
        setRoleConfig({...roleConfig, user: { ...roleConfig.user, avatar: {src: selectedWechatBot?.info?.headImage, style: {background: '#00000000'}} }})
    }, [selectedWechatBot])

    return (
        <Flex vertical gap="middle" style={{height: '100%', overflow: 'auto'}} justify="space-between">
            <Bubble.List 
                style={{paddingLeft: 10, paddingRight: 10}}
                roles={roleConfig}
                items={messages.map(item => {
                    const isToolsMessage = !['user', 'assistant'].includes(item?.role)
                    return {
                        ...item,
                        footer: isToolsMessage ? null: <MessageTools messageItem={item} /> ,
                        messageRender: () => {
                            if (!isToolsMessage) return <MarkdownRender raw={item?.content} />
                            const wechatMessageConfig = JSON.parse(item?.wechat_message_config)
                            if (wechatMessageConfig.type === 'tool_call') {
                                return <>
                                    <MarkdownRender raw={item?.content || ''}/>
                                    <Collapse 
                                        ghost 
                                        items={wechatMessageConfig?.tools?.map(toolItem => ({ key: toolItem?.call_id, label: `调用工具函数：${toolItem?.tool_name}`, children: <MarkdownRender raw={`**参数：**\n\n\`\`\`json\n${toolItem?.parameters}\n\`\`\``} /> }))}  
                                    />
                                </>
                            }
                            if (wechatMessageConfig.type === 'tool_result') {
                                return <Collapse 
                                    ghost
                                    items={[{ key: wechatMessageConfig?.tools?.call_id, label: `工具调用结果：${wechatMessageConfig?.tools?.tool_name}`, children: <MarkdownRender raw={`**结果：**\n\n\`\`\`json\n${wechatMessageConfig?.tools?.result}\n\`\`\``} /> }]}
                                />
                            }

                        }
                    }
                })}
            />
            <Sender

            />
        </Flex>
    )
}

function ModelSelection() {
    const [modelInfo, setModelInfo] = useState({ model_name: '', model_format_name: '', base_url: '', apikey: null,  description: ''});
    const [optionType, setOptionType] = useState('add');
    const {setSelectModel, selectModel, modelList, setModelList, baseModal} = useContext(MainContext);
    const [apikeyList, setApikeyList] = useState([]);
    
    const { Text } = Typography;
    const [ form ] = Form.useForm();
    const getModels = () => {
        return new Promise((resolve, reject) => {
            requests('api/models', {}, 'GET')
                .then(data => {
                    setModelList(data?.data || []);
                    resolve();
                });
        })
    }

    const getApikey = () => {
        return new Promise((resolve, reject) => {
            requests('api/apikeys', {}, 'GET')
                .then(data => {
                    setApikeyList(data?.data || []);
                    resolve();
                });
        })
    }

    const addModel = () => {
        // TODO: 需要根据选择操作动态更改弹窗中的表单组件，应该要把optionType写到Context里面才会生效。
        baseModal.confirm({
            title: `添加模型`,
            content: (
                <Form
                    layout="vertical"
                    name="addModelForm"
                    form={form}
                >   
                    <Form.Item label="操作类型">
                        <Radio.Group 
                            optionType='button'
                            buttonStyle='solid'
                            // value={optionType}
                            defaultValue={optionType}
                            options={[{label: '新增', value: 'add'}, {label: '修改', value: 'update'}]}
                            block 
                            onChange={event => setOptionType(event.target.value)}
                        />
                    </Form.Item>
                    <Form.Item label="模型名称" name="model_format_name" rules={[{ required: true, message: '请输入模型名称' }]}>
                        <Input placeholder="请输入模型名称" defaultValue={modelInfo.model_format_name}/>
                    </Form.Item>
                    <Form.Item label="模型ID" name="model_name" rules={[{ required: true, message: '请输入模型ID' }]}>
                        <Input placeholder="请输入模型I" defaultValue={modelInfo.model_name} />
                    </Form.Item>
                    <Form.Item label="模型地址" name="base_url" rules={[{ required: true, message: '请输入模型地址' }]}>
                        <Input placeholder="请输入模型地址" defaultValue={modelInfo.base_url}  />
                    </Form.Item>
                    <Form.Item label="APIKEY" name="apikey">
                        <Select 
                            placeholder="请选择APIKEY" 
                            defaultValue={modelInfo.apikey}
                            allowClear
                            options={apikeyList.map(item => ({...item, label: item.description, value: item.apikey_id}))}
                        />
                    </Form.Item>
                    <Form.Item label="模型描述" name="description">
                        <Input.TextArea placeholder="请输入模型描述" rows={4} style={{resize: 'none'}} defaultValue={modelInfo.description} />
                    </Form.Item>
                </Form>
            ),
            icon: null,
            onOk () {
                return new Promise((resolve, reject) => {
                    form.validateFields()
                        .then(value => {
                            // requests('', value, 'POST')
                        })
                        .catch(err => {
                            reject('请输入正确的信息');
                        });
                });
            }
        });
    }

    const addApikey = () => {
        baseModal.confirm({
            title: '添加apikey',
            icon: null,
            content: (
                <Form
                    form={form}
                    layout="vertical"
                    name='addApikey'
                >
                    <Form.Item
                        label="APIKEY"
                        name="apikey"
                        rules={[{ required: true, message: '请输入apikey' }]}
                    >
                        <Input placeholder="请输入apikey" />
                    </Form.Item>
                    <Form.Item
                        label="描述"
                        name="description"
                        rules={[{ required: true, message: "请输入1到20位字符。", min: 1, max: 20 }]}
                    >
                        <Input placeholder="请输入描述" />
                    </Form.Item>
                </Form>
            ),
            onOk () {
                return new Promise((resolve, reject) => {
                    form.validateFields()
                        .then(values => {
                            requests('api/model/apikey/add', values, 'POST')
                                .then(res => {
                                    if (res.code === 200) {
                                        Toast.success('添加成功');
                                        resolve();
                                        return;
                                    }
                                    Toast.error(res.msg);
                                    reject();
                                })
                        })
                        .catch(info => {
                            Toast.error('请填写必填项');
                            reject('请填写必填项');
                        });
                })
            }
        })
    }

    useEffect(() => {
        getModels()
            .then(() => {
                const firstModel = modelList?.find(item => item?.apikey);
                setSelectModel(firstModel?.model_id || '')
            });
        getApikey();
    }, [])

    return (
        <Flex vertical style={{width: '100%'}} gap={10}>
            <Row justify="space-between">
                <Col span={12} style={{padding: '0 10px'}}>
                    <Button block color="primary" variant="outlined" onClick={() => addModel()}>模型配置</Button>
                </Col>
                <Col span={12} style={{padding: '0 10px'}}>
                    <Button block color="primary" variant="outlined" onClick={() => addApikey()}>APIKEY配置</Button>
                </Col>
            </Row>
            <Row style={{width: '100%'}}>
                <Col span={24} style={{padding: '0 10px'}}>
                    <Select 
                        style={{width: '100%'}}
                        prefix="使用模型"
                        options={modelList?.map(item => ({...item, label: item.model_format_name, value: item.model_id, disabled: !item?.apikey}))}
                        optionRender={props => {
                            return <>
                                <Text strong style={{paddingRight: 5}} disabled={!props.data?.apikey} >{props.label}</Text>
                                <Text code disabled={!props.data?.apikey} style={{paddingRight: 5}}>{props.data.model_name}</Text>
                                {!props.data?.apikey && <Text type="danger">未配置APIKEY</Text>}
                            </>
                        }}
                    />
                </Col>
            </Row>
            <Row>
                <Col span={24} style={{padding: '0 10px'}}>
                        123
                </Col>
            </Row>
        </Flex>
    )
}

export default function LayoutPage() {
    const [ selectedWechatBot, setSelectedWechatBot ] = useState({});
    const [ wechatBotList, setWechatBotList ] = useState([]);
    const [ isLogin, setIsLogin ] = useState(false);
    const [ conversationId, setConversationId ] = useState('');
    const [ modelList, setModelList ] = useState([]);
    const [ selectModel, setSelectModel ] = useState('');

    const { Sider, Content } = Layout;
    const { Text } = Typography;
    const [baseModal, modelContextHolder] = Modal.useModal();


    const getBotList = () => {
        return new Promise((resolve, reject) => {
            requests('api/bot/list', {}, 'GET')
                .then(response => {
                    setWechatBotList(response?.data || [])
                    resolve(response?.data || [])
                })
        })
    }

    const login = async () => {
        setIsLogin(true);
        requests('api/bot/start', {}, 'POST', {}, () => setIsLogin(false))
            .then(data => {
                if (data?.code === 200) {
                    const interval = setInterval(() => {
                        requests("api/bot/login_heartbeat", { port: data?.data?.port })
                            .then(loginStatus => {
                                if (loginStatus?.data?.status) {
                                    clearInterval(interval);
                                    setIsLogin(false);
                                    setWechatBotList([...wechatBotList, data?.data])
                                    setTimeout(() => {
                                        window.location.reload();
                                    }, 1000)
                                }
                            })
                    }, 1000)
                } else {
                    Toast.error(data?.message || '请求失败');
                }
            })
            .catch(err => {
                Toast.error(err.message || '请求失败');
                setIsLogin(false);
            })
    }

    const LoginButton = () => <Button loading={isLogin} onClick={login} type='primary' > 登录新账号 </Button>

    useEffect(() => {
        getBotList()
            .then(response => {
                if (response.length > 0) {
                    setSelectedWechatBot(response[0]);
                }
            });
    }, [])


    return (
        <Layout style={{ height: '100vh', width: '100vw' }}>
            <MainContext.Provider 
                value={{ 
                    selectedWechatBot, setSelectedWechatBot, conversationId, setConversationId,
                    modelList, setModelList, selectModel, setSelectModel, baseModal, modelContextHolder
                }}
            >
                <Sider
                    style={{ height: '100%', margin: 0 }}
                    theme="light"
                    width={260}
                >
                    <Flex vertical>
                        <Row style={{ width: '100%', height: 65 }}>
                            <Col flex="auto" style={{ padding: '10px 0px 0px 0px', width: 'calc(100% - 85px)', height: '100%', display: 'flex', textAlign: 'center', alignItems: 'center', justifyContent: 'center' }}>
                                {
                                    selectedWechatBot?.info?.name ? (
                                        <div style={{ height: '100%', width: '100%' }}>
                                            <div style={{height: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%'}}>
                                                <Text strong={true} style={{ width: '100%' }} ellipsis={{rows: 1, tooltip: true}}>{selectedWechatBot?.info?.name ?? '未登录'}</Text>
                                            </div>
                                            <div style={{height: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%'}}>
                                                <Text type='secondary' style={{ width: '100%' }} ellipsis={{rows: 1, tooltip: true}}>{selectedWechatBot?.info?.account ?? "未登录"}</Text>
                                            </div>
                                        </div>
                                    ) : (
                                        <LoginButton />
                                    )
                                }
                            </Col>
                            <Col flex="65px" style={{ padding: '5px 10px 5px 5px' }}>
                                {
                                    wechatBotList.length > 0 ? (
                                        <Popover
                                            title="切换微信"
                                            placement="rightTop"
                                            fresh={true}
                                            content={
                                                <List
                                                    style={{width: 200, maxHeight: 600, overflow: 'auto'}}
                                                    itemLayout="horizontal"
                                                    dataSource={wechatBotList}
                                                    renderItem={(item, index) => {
                                                        console.log(item)
                                                        return (
                                                            <List.Item>
                                                                <List.Item.Meta
                                                                    avatar={<Avatar src={item.info?.headImage} />}
                                                                    title={<a onClick={() => setSelectedWechatBot(item)} >{item.info?.name || ''}</a>}
                                                                    description={item.info?.account || '获取账号信息失败'}
                                                                />
                                                            </List.Item>
                                                        )
                                                    }}
                                                    footer={
                                                        <div style={{width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                                                            <LoginButton/>
                                                        </div>
                                                    }
                                                />
                                            }
                                        >
                                            <Avatar style={{cursor: 'pointer'}} size={60} src={selectedWechatBot?.info?.headImage} />
                                        </Popover>
                                    ) :(
                                        <Avatar style={{cursor: 'pointer'}} size={60} icon={<UserOutlined />} />
                                    )
                                }
                            </Col>
                        </Row>
                        <ConversationMenu />
                    </Flex>
                </Sider>
                <Content style={{paddingTop: '25px', paddingBottom: '25px'}}>
                    <Row style={{height: '100%', width: '100%'}}>
                        <Col span={6} style={{height: '100%'}}>

                        </Col>
                        <Col span={12} style={{height: '100%'}}>
                            <ChatBox />
                        </Col>
                        <Col span={6} style={{height: '100%'}}>
                            <Flex vertical>
                                <ModelSelection />
                            </Flex>
                        </Col>
                    </Row>
                </Content>
                {modelContextHolder}
            </MainContext.Provider>
        </Layout>
    )
}