import {Layout, Flex, Row, Col, Avatar} from 'antd'
import {Conversations} from "@ant-design/x";
import {useEffect, useState} from "react";
import requests from '../utils/requests'

function ConversationMenu({ selectedWechatBot }) {
    const [conversations, setConversations] = useState([])

    const getConversations = async () => {
        const response = await requests('api/conversations/list', { port: selectedWechatBot.port })
        setConversations(response.data?.data || [])
    }

    useEffect(() => {
        if (selectedWechatBot?.port) {
            getConversations()
        }
    }, [selectedWechatBot]);

    return (
        <Flex style={{ height: '100%', width: '100%' }}>
            <Conversations
                style={{ height: 'auto', width: '100%', margin: 0 }}
            />
        </Flex>
    )
}

export default function LayoutPage() {
    const [ selectedWechatBot, setSelectedWechatBot ] = useState({})
    const [ wechatBotList, setWechatBotList ] = useState([])

    const { Sider, Content } = Layout;
    const getBotList = async () => {
        const response = await requests('api/bot/list', {}, 'GET')
        setWechatBotList(response.data?.data || [])
    }

    useEffect(() => {
        getBotList()
            .then(() => {
                if (Object.keys(selectedWechatBot).length === 0 && wechatBotList.length > 0) {
                    setSelectedWechatBot(wechatBotList[0])
                }
            })
    }, [])


    return (
        <Layout style={{ height: '100vh', width: '100vw' }}>
            <Sider
                style={{ height: '100%', margin: 0 }}
                theme="light"
                collapsible={true}
            >
                <Flex vertical={true}>
                    <Row style={{ width: '100%', height: 65 }}>
                        <Col flex="65px" style={{ padding: 5 }}>
                            <Avatar size={60} />
                        </Col>
                        <Col flex="auto" style={{ padding: 5 }}>
                            
                        </Col>
                    </Row>
                    <ConversationMenu selectedWechatBot={selectedWechatBot} />
                </Flex>
            </Sider>
            <Content></Content>
        </Layout>
    )
}