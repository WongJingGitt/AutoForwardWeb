import {Layout, Flex, Row, Col, Avatar, Typography, Button, Popover, List, Input, Space, theme } from 'antd';
import {Toast, MarkdownRender} from '@douyinfe/semi-ui';
import { CopyOutlined, DeleteOutlined } from '@ant-design/icons';
import {Bubble, Conversations, Sender} from "@ant-design/x";
import {useEffect, useState, createContext, useContext} from "react";
import requests from '../utils/requests'

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
                <Button block >新对话</Button>
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
        assistant: { placement: 'start', avatar: {icon: <Avatar src='https://wxa.wxs.qq.com/wxad-design/yijie/phone-chat-icon-1.png' />}} ,
        user: { placement: 'end', avatar: {icon: <Avatar src={selectedWechatBot?.info?.headImage} />}}
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
        setRoleConfig({...roleConfig, user: { ...roleConfig.user, avatar: {icon: <Avatar src={selectedWechatBot?.info?.headImage} />} }})
    }, [selectedWechatBot])

    return (
        <Flex vertical gap="middle" style={{height: '100%', overflow: 'auto'}} justify="space-between">
            <Bubble.List 
                roles={roleConfig}
                items={messages.map(item => {
                    return {
                        ...item,
                        footer: <MessageTools messageItem={item} />,
                        messageRender: () => <MarkdownRender raw={item?.content} />
                    }
                })}
            />
            <Sender

            />
        </Flex>
    )
}

export default function LayoutPage() {
    const [ selectedWechatBot, setSelectedWechatBot ] = useState({});
    const [ wechatBotList, setWechatBotList ] = useState([]);
    const [ isLogin, setIsLogin ] = useState(false);
    const [ conversationId, setConversationId ] = useState('');

    const { Sider, Content } = Layout;
    const { Text } = Typography;


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

    const LoginButton = () => <Button loading={isLogin} onClick={login} > 登录新账号 </Button>

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
            <MainContext.Provider value={{ selectedWechatBot, setSelectedWechatBot, conversationId, setConversationId }}>
                <Sider
                    style={{ height: '100%', margin: 0 }}
                    theme="light"
                    width={260}
                >
                    <Flex vertical={true}>
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
                                        <Avatar style={{cursor: 'pointer'}} size={60} src={selectedWechatBot?.info?.headImage} />
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

                        </Col>
                    </Row>
                </Content>
            </MainContext.Provider>
        </Layout>
    )
}