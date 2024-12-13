import React, {useEffect, useMemo, useState} from 'react';
import {Layout, Row, Col, Space, Input, Typography, Button, Form, Toast} from '@douyinfe/semi-ui';

export default function LayoutPage() {
    const [userConfig, setUserConfig] = useState({
        whitelist: [],
        blacklist: [],
        globalForward: false,
        globalTextPreprocessing: "",
        globalRule: "",
        globalRecipientQQ: "",
        globalRecipientGroup: "",
        globalRecipientMember: {
            group: "",
            member: ""
        },
        matchMode: "keyword",
        apikey: ""
    });

    const informations = {
        matchMode: {
            char: "只有收到的消息完全与设置的内容匹配时才会转发。例如，设置内容为“你好”，只有收到的消息为“你好”时才会触发转发",
            keyword: "当收到的消息中包含设置的关键字时，就会触发转发。例如，设置内容为“你好”，收到的消息“你好帅”就会触发转发。",
            uin: "当收到的消息来自指定的QQ/群号时，就会触发转发。例如，设置内容为“123456”，收到的消息来自QQ号为123456的好友时就会触发转发。",
            ai: "由AI判定当前收到的消息是否应该被转发。"
        }
    }

    const { Content } = Layout;
    const { Text } = Typography;

    return (
        <Layout style={{ height: '100%', width: '100%' }}>
            <Content style={{ height: '100%', width: '100%', padding: 10 }}>
                <Form>
                    <Form.Section text="转发规则" >
                        <Row>
                            <Col span={12}>
                                <Form.Switch
                                    field={'globalForward'}
                                    label={'全局转发开关'}
                                    initValue={userConfig.globalForward}
                                    extraText={
                                        <Text>
                                            当前状态:
                                            <Text strong style={{ paddingLeft: 10 }} type={ userConfig.globalForward ? "success" : "danger" } >
                                                {
                                                    userConfig.globalForward ? "开启" : "关闭"
                                                }
                                            </Text>
                                        </Text>
                                    }
                                    onChange={value => {
                                        setUserConfig({...userConfig, globalForward: value})
                                    }}
                                />
                            </Col>
                        </Row>
                        <Row>
                            <Col span={12}>
                                <Form.Select
                                    field={"matchMode"}
                                    label={"转发模式"}
                                    style={{ width: '30%' }}
                                    initValue={userConfig.matchMode}
                                    onChange={value => {
                                        setUserConfig({...userConfig, matchMode: value})
                                    }}
                                    extraText={
                                        <Text ellipsis={{ showTooltip: true }}>
                                            {
                                                informations.matchMode?.[userConfig.matchMode] ?? ""
                                            }
                                        </Text>
                                    }
                                >
                                    <Form.Select.Option value={'char'}>消息完全匹配</Form.Select.Option>
                                    <Form.Select.Option value={'keyword'}>包含关键字</Form.Select.Option>
                                    <Form.Select.Option value={'uin'}>转发指定QQ/群号</Form.Select.Option>
                                    <Form.Select.Option value={'ai'}>使用AI判定</Form.Select.Option>
                                </Form.Select>
                            </Col>
                        </Row>
                    </Form.Section>
                </Form>
            </Content>
        </Layout>
    );
}
