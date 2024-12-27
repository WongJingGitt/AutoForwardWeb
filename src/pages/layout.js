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
    RadioGroup, Radio
} from '@douyinfe/semi-ui';
import { IconUserCircle, IconUserAdd } from '@douyinfe/semi-icons';
import { v4 as uuidv4 } from 'uuid';
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
    const [ chatMessages, setChatMessages ] = useState([]);

    const { Content } = Layout;
    const { Text } = Typography;

    const generateMultipleContactsReple = contacts => {
        let result = `找到了${contacts.length}个联系人：\n\n`;
        for (let i = 0; i < contacts.length; i++) {
            const contact = contacts[i];
            result += `${i+1}. **微信名**: \`${contact?.name}\`  \n   **备注**: ${contact?.remark}  \n   **wxid**: \`${contact?.wxid}\`  \n   **微信号**: \`${contact?.['custom_id']}\`\n`;
            if (i !== contacts.length - 1) result += "----\n";

        }
        return contacts.length > 1 ? result+"\n\n请问您要查找的是哪个联系人？" : result;
    }

    useEffect(() => {
        fetch('http://127.0.0.1:16001/api/bot/list', { method: 'GET' })
            .then(res => res.json())
            .then(data => {
                if (data?.code === 200) {
                    setBots(data?.data);
                    if (data?.data.length > 0) {
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

    return (
        <Layout style={{ height: '100%', width: '100%' }}>
            <Content style={{ height: '100%', width: '100%', padding: 10 }}>
                <Row style={{ width: '100%', height: 'calc(100% - 20px)' }}>
                    <Col span={6} style={{ height: '100%' }}>
                        <RadioGroup
                            style={{width: '100%'}}
                            value={roleConfig.user.port}
                            onChange={value => {
                                const selectedBot = bots.filter(item => item.port === value.target.value)[0]
                                setRoleConfig({...roleConfig, user: { name: selectedBot?.name, avatar: selectedBot?.info?.headImage, port: selectedBot?.port }})
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
                                                fetch('http://127.0.0.1:16001/api/bot/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({  }) })
                                                    .then(res => res.json())
                                                    .then(data => {
                                                        if (data?.code === 200) {
                                                            const interval = setInterval(() => {
                                                                fetch('http://127.0.0.1:16001/api/bot/login_heartbeat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ port: data?.data?.port }) })
                                                                    .then(res => res.json())
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
                    <Col span={12} style={{ height: '100%' }}>
                        <Chat
                            chats={chatMessages}
                            uploadProps={{disabled: true, style: { display: 'none' }}}
                            style={{ width: '100%', maxWidth: '100%' }}
                            onMessageDelete={value => {
                                setChatMessages(chatMessages.filter(item => item.id !== value.id));
                            }}
                            onMessageReset={message => {
                                console.log(message)
                            }}
                            roleConfig={roleConfig}
                            onMessageSend={
                                message => {
                                    const newChatMessages = [...chatMessages, { role: 'user', content: message, createAt: (new Date()).getTime(), id: uuidv4() }];
                                    newChatMessages.push({role: 'assistant', content: '正在查询...', createAt: (new Date()).getTime(), status: 'loading', id: uuidv4()});
                                    setChatMessages([...newChatMessages]);

                                    fetch('http://127.0.0.1:16001/api/ai/chat', {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json'
                                        },
                                        body: JSON.stringify({
                                            port: roleConfig.user.port,
                                            messages: newChatMessages.slice(0,-1)
                                        })
                                    })
                                        .then(res => res.json())
                                        .then(data => {
                                            if (data?.code === 200) {
                                                const reply = data?.data
                                                if (typeof reply === 'string') {
                                                    newChatMessages[newChatMessages.length - 1] = {...newChatMessages.at(-1), status: 'success', content: reply};
                                                    setChatMessages([...newChatMessages]);
                                                    return;
                                                }else if (Array.isArray(reply)) {
                                                    newChatMessages[newChatMessages.length - 1] = {...newChatMessages.at(-1), status: 'success', content: generateMultipleContactsReple(reply)};
                                                    setChatMessages([...newChatMessages]);
                                                    return;
                                                }
                                                return
                                            }
                                            newChatMessages[newChatMessages.length - 1] = {...newChatMessages.at(-1), status: 'error', content: data?.message || '请求失败'};
                                            setChatMessages([...newChatMessages]);
                                        })
                                }
                            }
                        />
                    </Col>
                    <Col span={6} style={{ height: '100%' }}>

                    </Col>
                </Row>
            </Content>
        </Layout>
    );
}
