import React, {useEffect, useMemo, useState} from 'react';
import {Layout, Row, Col, Space, Input, Typography, Button, Form, Toast, Chat} from '@douyinfe/semi-ui';


export default function LayoutPage() {
    const [userConfig, setUserConfig] = useState([]);
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
        return result+"\n\n请问您要查找的是哪个联系人？";
    }

    return (
        <Layout style={{ height: '100%', width: '100%' }}>
            <Content style={{ height: '100%', width: '100%', padding: 10 }}>
                <Row style={{ width: '100%', height: 'calc(100% - 20px)' }}>
                    <Col span={6} style={{ height: '100%' }}></Col>
                    <Col span={6} style={{ height: '100%' }}>

                    </Col>
                    <Col span={12} style={{ height: '100%' }}>
                        <Chat
                            chats={chatMessages}
                            style={{ width: '100%' }}
                            showClearContext
                            onClear={() => {
                                setChatMessages([]);
                            }}
                            onMessageSend={
                                message => {
                                    const newChatMessages = [...chatMessages, { role: 'user', content: message }]
                                    setChatMessages([...newChatMessages]);

                                    fetch('http://127.0.0.1:16001/api/ai/chat', {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json'
                                        },
                                        body: JSON.stringify({
                                            port: 19001,
                                            messages: newChatMessages
                                        })
                                    })
                                        .then(res => res.json())
                                        .then(data => {
                                            if (data?.code === 200) {
                                                const reply = data?.data
                                                if (typeof reply === 'string') {
                                                    newChatMessages.push({ role: 'assistant', content: reply })
                                                    setChatMessages([...newChatMessages]);
                                                    return;
                                                }else if (Array.isArray(reply)) {
                                                    newChatMessages.push({ role: 'assistant', content: generateMultipleContactsReple(reply) })
                                                    setChatMessages([...newChatMessages]);
                                                    return;
                                                }
                                                return
                                            }
                                            Toast.error(data?.message || '请求失败');
                                        })
                                }
                            }
                        />
                    </Col>

                </Row>
            </Content>
        </Layout>
    );
}
