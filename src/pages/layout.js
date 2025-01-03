import React, {useEffect, useState} from 'react';
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
    RadioGroup, Radio, Input
} from '@douyinfe/semi-ui';
import { IconUserCircle, IconUserAdd, IconComment, IconSearch} from '@douyinfe/semi-icons';
import { v4 as uuidv4 } from 'uuid';
import requests from "../utils/requests";
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

    const { Content } = Layout;
    const { Text } = Typography;

    const initStatus = () => {
        setSummaryValue('');
        setChatMessages([]);
        setSelectedConversation(null);
    }
    const generateMultipleContactsReple = contacts => {
        let result = `找到了${contacts.length}个联系人：\n\n`;
        for (let i = 0; i < contacts.length; i++) {
            const contact = contacts[i];
            result += `${i+1}. **微信名**: \`${contact?.name}\`  \n   **备注**: ${contact?.remark}  \n   **wxid**: \`${contact?.wxid}\`  \n   **微信号**: \`${contact?.['custom_id']}\`\n`;
            if (i !== contacts.length - 1) result += "----\n";

        }
        return contacts.length > 1 ? result+"\n\n请问您要查找的是哪个联系人？" : result;
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
                                                                            window.location.reload();
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
                                    const assistantId = uuidv4()
                                    const newChatMessages = [...chatMessages, { role: 'user', content: message, createAt: (new Date()).getTime(), message_id: uuidv4()}];
                                    newChatMessages.push({role: 'assistant', content: '正在查询...', createAt: (new Date()).getTime(), status: 'loading', message_id: assistantId});
                                    setChatMessages([...newChatMessages]);

                                    requests('/api/ai/chat', {
                                        port: roleConfig.user.port,
                                        messages: newChatMessages.slice(0,-1),
                                        assistant_id: assistantId,
                                        conversation_id: selectedConversation
                                    })
                                        .then(data => {
                                            if (data?.code === 200) {
                                                const reply = data?.data?.message
                                                const summary = data?.data?.summary
                                                const conversationId = data?.data?.conversation_id
                                                const newConversation = data?.data?.new_conversation
                                                if (typeof reply === 'string') {
                                                    newChatMessages[newChatMessages.length - 1] = {...newChatMessages.at(-1), status: 'success', content: reply};
                                                    setChatMessages([...newChatMessages]);
                                                }else if (Array.isArray(reply)) {
                                                    newChatMessages[newChatMessages.length - 1] = {...newChatMessages.at(-1), status: 'success', content: generateMultipleContactsReple(reply)};
                                                    setChatMessages([...newChatMessages]);
                                                }
                                                if (newConversation) {
                                                    setConversation([{conversation_id: conversationId, summary: summary}, ...conversation])
                                                    setSelectedConversation(conversationId)
                                                }
                                                return
                                            }
                                            newChatMessages[newChatMessages.length - 1] = {...newChatMessages.at(-1), status: 'error', content: data?.message || '请求失败'};
                                            setChatMessages([...newChatMessages]);
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
                        {
                            selectedConversation && (
                                <Row style={{ height: 40 }}>
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
