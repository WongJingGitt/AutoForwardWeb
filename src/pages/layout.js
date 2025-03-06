import React, {useEffect, useMemo, useState} from 'react';
import {
    Layout,
    Row,
    Col,
    Space,
    Typography,
    Button,
    Toast,
    Chat,
    List,
    Avatar,
    RadioGroup, Radio, Input, Select, Tooltip
} from '@douyinfe/semi-ui';
import {IconUserCircle, IconUserAdd, IconComment, IconSearch, IconInfoCircle} from '@douyinfe/semi-icons';
import { v4 as uuidv4 } from 'uuid';
import requests from "../utils/requests";
import { io as socketIO } from "socket.io-client";
import './layout.css'


export default function LayoutPage() {
    const [bots, setBots] = useState([]);
    const [loginLoading, setLoginLoading] = useState(false);
    const [roleConfig, setRoleConfig] = useState({
        user: {
            name: '用户',
            avatar: <IconUserCircle />,
            port: null
        },
        assistant: {
            name: '微信小助手',
            avatar: 'https://wxa.wxs.qq.com/wxad-design/yijie/phone-chat-icon-1.png',
        },
        system: {
            name: '系统',
            avatar: 'https://wxa.wxs.qq.com/hing/20220531/phone-chat-icon_0.png',
        }
    });
    const [chatMessages, setChatMessages] = useState([]);
    const [conversation, setConversation] = useState([]);
    const [searchConversationValue, setSearchConversationValue] = useState('')
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [summaryValue, setSummaryValue] = useState('');
    const [chatSocket, setChatSocket] = useState(null);
    const [sendStatus, setSendStatus] = useState(true)
    const [selectedModel, setSelectedModel] = useState('glm-4-flash')

    const { Content } = Layout;
    const { Text } = Typography;

    const initStatus = () => {
        setSummaryValue('');
        setChatMessages([]);
        setSelectedConversation(null);
    }

    const getConversationMsg = id => {
        return requests('api/conversations/messages', { conversation_id: id })
            .then(data => {
                if (data?.code === 200) {
                    return data?.data;
                } else {
                    Toast.error(data?.message || '请求失败');
                    return [];
                }
            })
    }

    const conversationList = conversation.filter(item => item?.summary?.toLowerCase().includes(searchConversationValue.toLowerCase()))

    useEffect(() => {
        requests("api/bot/list", {}, "GET")
            .then(data => {
                if (data?.code === 200) {
                    const botList = data?.data?.filter(item => item?.info)
                    setBots(botList);
                    if (botList.length > 0) {
                        setRoleConfig({...roleConfig, user: { name: data?.data[0]?.name, avatar: data?.data[0]?.info?.headImage, port: data?.data[0]?.port }})
                    }
                } else {
                    Toast.error(data?.message || '请求失败');
                }
            })
            .catch(err => {
                Toast.error(err.message || '请求失败');
            })
        chatSocket?.disconnect();
    }, []);

    useEffect(() => {
        if (!roleConfig.user.port) return;
        requests("api/conversations/list", { port: roleConfig.user.port })
            .then(data => {
                if (data?.code === 200) {
                    setConversation(data?.data);
                } else {
                    Toast.error(data?.message || '请求失败');
                }
            })
            .catch(err => {
                Toast.error(err.message || '请求失败');
            })
    }, [roleConfig]);

    const modelInfo = useMemo(() => {
        return {
            "glm-4-flash": <Text>GLM-4-Flash: 免费的模型，可以前往<Text link={{href: "https://open.bigmodel.cn/", target: '_blank'}}>智谱开放平台</Text>申请APIKEY使用</Text>,
            "gemini-2.0-flash-exp": <Text>Gemini 2.0-Flash-Exp: 免费的模型，需要翻墙，可以前往<Text link={{href: "https://aistudio.google.com/app/apikey", target: '_blank'}}>谷歌AI Studio</Text>申请APIKEY使用</Text>,
            "deepseek-v3-aliyun": <Text>DeepSeek V3(阿里云): 新用户赠送额度，不过不支持函数调用，暂时不可用。</Text>,
            "deepseek-r1-aliyun": <Text>DeepSeek R1(阿里云): 新用户赠送额度，不过不支持函数调用，暂时不可用。</Text>,
            "qwen2.5": <Text>通义千问2.5: 新用户赠送额度，可以前往<Text link={{href: 'https://bailian.console.aliyun.com/', target: '_blank'}}>阿里云百炼</Text>申请APIKEY使用</Text>,
            "deepseek_v3": <Text>DeepSeek V3(官方): 新用户赠送额度，可以前往<Text link={{href: "https://platform.deepseek.com/", target: '_blank'}}>DeepSeek官方开放平台</Text>申请APIKEY使用</Text>
        }
    }, [])

    return (
        <Layout style={{ height: '100%', width: '100%' }}>
            <Content style={{ height: '100%', width: '100%', padding: 10 }}>
                <Row style={{ width: '100%', height: 'calc(100% - 20px)' }}>
                    <Col span={4} style={{ height: '100%' }}>
                        <RadioGroup
                            style={{width: '100%'}}
                            value={roleConfig.user.port}
                            onChange={value => {
                                const selectedBot = bots.filter(item => item.port === value.target.value)[0]
                                setRoleConfig({...roleConfig, user: { name: selectedBot?.name, avatar: selectedBot?.info?.headImage, port: selectedBot?.port }})
                                initStatus();
                                chatSocket?.disconnect();
                            }}
                        >
                            <List
                                style={{width: '100%'}}
                                loadMore={
                                    <div style={{width: '100%', display: 'flex', justifyContent: 'center'}}>
                                        <Button
                                            icon={<IconUserAdd/>}
                                            loading={loginLoading}
                                            onClick={() => {
                                                setLoginLoading(true);
                                                requests('api/bot/start', {}, 'POST')
                                                    .then(data => {
                                                        if (data?.code === 200) {
                                                            const interval = setInterval(() => {
                                                                requests("api/bot/login_heartbeat", { port: data?.data?.port })
                                                                    .then(loginStatus => {
                                                                        if (loginStatus?.data?.status) {
                                                                            clearInterval(interval);
                                                                            setLoginLoading(false);
                                                                            setBots([...bots, {...data?.data, ...loginStatus?.data?.info}]);
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
                                                        setLoginLoading(false);
                                                    })

                                            }}
                                        >
                                            登录微信
                                        </Button>
                                    </div>
                                }
                            >
                                {
                                    bots.length > 0 && bots.map(item => {
                                        return (
                                            <List.Item
                                                header={
                                                    <Space>
                                                        <Radio value={item?.port} />
                                                        <Avatar src={item?.info?.headImage} />
                                                    </Space>
                                                }
                                                main={
                                                    <Space vertical >
                                                        <Text strong>{ item?.info?.name }</Text>
                                                        <Text>微信号：{ item?.info?.account }</Text>
                                                    </Space>
                                                }
                                            />
                                        )
                                    })
                                }
                            </List>
                        </RadioGroup>
                    </Col>
                    <Col span={4} style={{ height: '100%', paddingLeft: 10, paddingRight: 10 }}>
                        <RadioGroup
                            type="pureCard"
                            style={{ width: '100%' }}
                            onChange={event => {
                                const id = event.target.value
                                chatSocket?.disconnect();
                                getConversationMsg(id)
                                    .then(res => {
                                        setChatMessages(res)
                                        setSelectedConversation(id)
                                    })
                            }}
                            value={selectedConversation}
                        >
                            <List
                                style={{ width: '100%' }}
                                header={
                                    <Space style={{ width: '100%', marginBottom: 10 }} vertical>
                                        <Button
                                            theme='outline' type='primary'
                                            icon={<IconComment />} block
                                            onClick={() => {
                                                setChatMessages([]);
                                                setSelectedConversation(null);
                                            }}
                                        >
                                            新建对话
                                        </Button>
                                        <Input
                                            prefix={<IconSearch />}
                                            placeholder='搜索历史会话'
                                            onChange={value => {
                                                setSearchConversationValue(value)
                                            }}
                                        />
                                    </Space>
                                }
                                split
                                dataSource={conversationList}
                                renderItem={item => (
                                    <List.Item style={{ width: '100%', padding: 0 }} className='list-item'>
                                        <Radio style={{width: '100%'}} value={item?.conversation_id}>
                                            {item?.summary}
                                        </Radio>
                                    </List.Item>
                                )}
                            />
                        </RadioGroup>
                    </Col>
                    <Col span={12} style={{ height: '100%', paddingRight: 10 }}>
                        <Chat
                            chats={chatMessages}
                            uploadProps={{disabled: true, style: { display: 'none' }}}
                            style={{ width: '100%', maxWidth: '100%' }}
                            onMessageDelete={value => {
                                setChatMessages(chatMessages.filter(item => item.message_id !== value.message_id));
                            }}
                            onMessageReset={message => {
                                console.log(message)
                            }}
                            roleConfig={roleConfig}
                            onMessageSend={
                                message => {
                                    if (!sendStatus) {
                                        Toast.error('请等待上一次请求完成');
                                        return
                                    }
                                    setSendStatus(false);

                                    const assistantId = uuidv4()
                                    const newChatMessages = [...chatMessages, { role: 'user', content: message, createAt: (new Date()).getTime(), message_id: uuidv4()}];
                                    newChatMessages.push({role: 'assistant', content: '正在查询...', createAt: (new Date()).getTime(), status: 'loading', message_id: assistantId});
                                    setChatMessages([...newChatMessages]);

                                    const socket = socketIO('ws://127.0.0.1:16001/api/ai/stream');
                                    setChatSocket(socket);

                                    socket.on("chat_message", (data) => {
                                        if (data?.code === 200) {
                                            const reply = data?.data?.message
                                            const summary = data?.data?.summary
                                            const conversationId = data?.data?.conversation_id
                                            const newConversation = data?.data?.new_conversation
                                            const responseMessageId = data?.data?.message_id
                                            const responseMessageTime = data?.data?.message_time

                                            newChatMessages[newChatMessages.length - 1] = {...newChatMessages.at(-1), status: 'success', content: reply, message_id: responseMessageId, createAt: responseMessageTime};
                                            newChatMessages.push({role: 'assistant', content: '正在查询...', createAt: (new Date()).getTime(), status: 'loading', message_id: assistantId});
                                            setChatMessages([...newChatMessages]);

                                            if (newConversation) {
                                                setConversation([{conversation_id: conversationId, summary: summary}, ...conversation])
                                                setSelectedConversation(conversationId)
                                            }
                                            return
                                        }
                                        newChatMessages[newChatMessages.length - 1] = {...newChatMessages.at(-1), status: 'error', content: data?.message || '请求失败'};
                                        setChatMessages([...newChatMessages]);
                                    });

                                    socket.on("connect", () => {
                                        socket.emit('chat_message', {
                                            port: roleConfig.user.port,
                                            messages: newChatMessages.slice(0, -1),
                                            assistant_id: assistantId,
                                            conversation_id: selectedConversation,
                                            model: selectedModel
                                        });
                                    });

                                    socket.on("disconnect", () => {
                                        newChatMessages[newChatMessages.length - 1] = {...newChatMessages.at(-1), status: 'success', content: '生成完毕'};
                                        setChatMessages([...newChatMessages])
                                        setSendStatus(true);
                                        socket.disconnect();
                                    })
                                }
                            }
                            showClearContext={selectedConversation}
                            onClear={() => {
                                if (!selectedConversation) return;
                                requests('/api/conversations/delete', { port: roleConfig.user.port, conversation_id: selectedConversation })
                                    .then(data => {
                                        if (data?.code === 200) {
                                            setConversation(conversation.filter(item => item.conversation_id !== selectedConversation))
                                            setChatMessages([])
                                            setSelectedConversation(null)
                                        }
                                    })
                            }}
                        />
                    </Col>
                    <Col span={4} style={{height: '100%', paddingTop: 10}}>
                        <Row style={{height: 40, width: '100%'}}>
                            <Col span={5} style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }} >
                                <Text>选择模型</Text>
                            </Col>
                            <Col span={19} style={{height: 40, display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                                <Select
                                    style={{width: '95%'}}
                                    value={selectedModel}
                                    onChange={(value) => {
                                        setSelectedModel(value)
                                    }}
                                >
                                    <Select.Option value={'glm-4-flash'}>GLM-4-Flash</Select.Option>
                                    <Select.Option value={'gemini-2.0-flash-exp'}>Gemini 2.0-Flash-Exp</Select.Option>
                                    <Select.Option value={'deepseek-v3-aliyun'} disabled>DeepSeek V3(阿里云)</Select.Option>
                                    <Select.Option value={'deepseek-r1-aliyun'} disabled>DeepSeek R1(阿里云)</Select.Option>
                                    <Select.Option value={'qwen2.5'}>通义千问2.5</Select.Option>
                                    <Select.Option value={'deepseek_v3'}>DeepSeek V3(官方)</Select.Option>
                                </Select>
                            </Col>
                        </Row>
                        <Row style={{height: 40, width: '100%', paddingTop: 5}}>
                            <Col span={24}>{modelInfo?.[selectedModel] ?? '暂无介绍'}</Col>
                        </Row>
                        {
                            selectedConversation && (
                                <Row style={{ height: 40, paddingTop: 10 }}>
                                    <Col span={5} style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }} >
                                        <Text>修改名称</Text>
                                    </Col>
                                    <Col span={15} style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                                        <Input
                                            style={{ width: '95%' }}
                                            placeholder={conversation.find(item => item.conversation_id === selectedConversation)?.summary}
                                            onChange={value => {
                                                setSummaryValue(value)
                                            }}
                                        />
                                    </Col>
                                    <Col span={4} style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                                        <Button
                                            onClick={() => {
                                                requests("/api/conversations/summary/update", {port: roleConfig.user.port, conversation_id: selectedConversation, summary: summaryValue})
                                                    .then(data => {
                                                        if (data?.code === 200) {
                                                            setConversation(conversation.map(item => {
                                                                if (item.conversation_id === selectedConversation) {
                                                                    return {...item, summary: summaryValue}
                                                                }
                                                                return item
                                                            }))
                                                        }
                                                    })
                                            }}
                                        >提交</Button>
                                    </Col>
                                </Row>
                            )
                        }
                    </Col>
                </Row>
            </Content>
        </Layout>
    );
}
