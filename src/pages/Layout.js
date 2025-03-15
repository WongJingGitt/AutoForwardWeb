import {Layout, Flex, Row, Col, Avatar, Typography, Button, Popover, List, Input, Space, theme, Collapse, Select, Modal, Form, Radio, Tooltip, Popconfirm } from 'antd';
import {Toast, MarkdownRender} from '@douyinfe/semi-ui';
import { CopyOutlined, DeleteFilled, DeleteOutlined, UserOutlined, ExportOutlined } from '@ant-design/icons';
import {Bubble, Conversations, Sender, Suggestion} from "@ant-design/x";
import {useEffect, useState, createContext, useContext, useCallback, useMemo, useRef} from "react";
import requests from '../utils/requests'
import html2canvas from 'html2canvas';

const MainContext = createContext({});

function ConversationMenu() {
    
    const [searchValue, setSearchValue] = useState('');

    const {conversationId, setConversationId, selectedWechatBot, conversations, getConversations, setMessages} = useContext(MainContext);

    useEffect(() => {
        if (selectedWechatBot?.port) {
            getConversations();
            setConversationId('');
        }
    }, [selectedWechatBot]);

    return (
        <Flex style={{ height: 'calc(100% - 65px)', width: '100%' }} vertical>
            <div style={{paddingLeft: 10, paddingTop: 12, paddingRight: 10}}>
                <Button 
                    block color="primary" 
                    variant="outlined"  
                    onClick={() => {
                        getConversations();
                        setConversationId('');
                        setMessages([]);
                    }}
                >新对话</Button>
            </div>
            <div style={{paddingLeft: 10, paddingTop: 12, paddingRight: 10}}>
                <Input placeholder='搜索对话' onChange={event => setSearchValue(event.target.value)} />
            </div>
            <Conversations
                activeKey={conversationId}
                style={{ height: 'calc(100% - 100px)', width: '100%', margin: 0, overflowY: 'auto'}}
                items={conversations.filter(item => item.summary.includes(searchValue))}
                onActiveChange={key => {
                    setConversationId(key);
                }}
            />
        </Flex>
    )
}


function ChatBox () {    
    const {conversationId, selectedWechatBot, isSending, setIsSending, selectModel, getConversations, setConversationId, messages, setMessages, changedField, setSelectModel, modelList} = useContext(MainContext);
    const [inputValue, setInputValue] = useState('');
    const [abortController, setAbortController] = useState(null);
    const MessageTools = ({messageItem, index}) => {
        const copyMessage = () => {
            window.navigator.clipboard.writeText(messageItem.content);
            Toast.success('已复制!')
        }
        const deleteMessage = () => {
            requests('api/conversations/messages/delete', {message_id: messageItem.message_id}, 'POST')
                .then(res => {
                    if (res.code === 200) {
                        Toast.success('删除成功!');
                        getConversationMsg(conversationId)
                    }
                })
        }
        return (
            <Space size={token.paddingXXS}>
                <Tooltip title="导出为图片">
                    <Button color="default" variant="text" size="small" icon={<ExportOutlined />} onClick={() => handleCapture(index)}  />
                </Tooltip>
                <Tooltip title="复制">
                    <Button color="default" variant="text" size="small" icon={<CopyOutlined />} onClick={copyMessage}  />
                </Tooltip>
                <Popconfirm title="确定删除该消息吗？" onConfirm={deleteMessage}>
                    <Button color="danger" variant="text" size="small" icon={<DeleteOutlined />}/>
                </Popconfirm>
            </Space>
        )
    }

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
    const parseMessage = (message) => {
        if (!message?.startsWith('data:')) return [{role: 'assistant', content: message, wechat_message_config: '{"type": "error", "message": "未知事件类型"}'}];
        message = message.slice(5);
        if (message?.replace(/\s/g, '')?.startsWith('[START]')) {
            console.log('开始处理对话')
        } else if (message?.replace(/\s/g, '')?.startsWith('[DONE]')) {
            console.log('对话处理完毕')
        }  else {
            try {
                return JSON.parse(message);
            } catch (error) {
                return [{role: 'assistant', content: message, wechat_message_config: '{"type": "error", "message": "JSON解析出错"}'}];
            }
        }
    }
    const chatWithEventStream = ({port, message, conversation_id, model_id}) => {
        setIsSending(true);
        setAbortController(new AbortController());
        fetch('http://127.0.0.1:16001/api/ai/stream', {
            method: 'POST', body: JSON.stringify({port, message, conversation_id, model_id}), headers: {'Content-Type': 'application/json'},
            signal: abortController?.signal
        })
            .then(async response => {
                const reader = response.body.getReader();
                const textDecoder = new TextDecoder();
                let text = '';
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        setIsSending(false);
                        if (!conversationId) {
                            getConversations()
                                .then(newConversations => {
                                    setConversationId(newConversations?.at(0)?.conversation_id)
                                })
                        }
                        break;
                    };
                    text += textDecoder.decode(value, {stream: true});
                    const events = text.split('\n\n');
                    text = events.pop();
                    events.forEach(event => {
                        if (!event) return;
                        const messagesChunk = parseMessage(event);
                        if (!messagesChunk) return;
                        setMessages(prevMessages => [...prevMessages, ...messagesChunk])
                    });
                }
            })
            .finally(() => {
                setIsSending(false);
            });
    }
    
    const getLastUserMessage = messageList => {
        if (!messageList || !messageList.length) return;
        for (let i = messageList.length - 1; i >= 0; i--) {
            if (messageList[i]?.role === 'user') {
                return messageList[i];
            }
        }
    }

    const suggestionItem = useMemo(() => {
        return [
            {
                label: '🕹️娱乐向群聊总结模板',
                children: [
                    {
                        label: '极简暴走版群聊总结', 
                        value: '用吐槽大会风格整理群聊：替换成实际群聊名称，今天的所有聊天记录，  需包含：    1. 数据三连：总消息数/最话痨用户/最热门话题    2. 今日梗王：评选1个最高光的沙雕发言    3. 迷惑行为：评选出出3条最令人费解的言论，并且附上夸张式的毒舌点评。    4. 金句收藏夹：摘录3条可直接当签名的神回复      5. 最佳CP点评：评选出今日最佳CP，并且附上若干条聊天记录。      要求：    - 每部分带阴阳怪气吐槽，如：这位同学凭一己之力贡献了群聊50%的废话    - 关键数据用【爆炸符号】强调，如🔥99+🔥  提示：  - 你需要调用工具函数获取当前时间    - 你需要根据群聊名称使用工具函数获取群聊wxid    - 根据获取到wxid和时间，获取今天的聊天记录进行总结   - 所有总结内容必须基于聊天记录，不得编纂任何不存在的内容       - 总结时请务必忽略[动画表情]/[视频]/[图片]等非文字占位内容   '
                    },
                    {
                        label: '剧情版群聊总结',
                        value: '将群聊: 群聊实际名称，今天的聊天记录改编成微型剧本，包含：    1. 故事标题：《XXXX》（用豆瓣9.0分电影命名风格）    2. 主要角色：根据发言特征给3位活跃用户起外号（如「午夜哲学家」「表情包刺客」）    3. 剧情分幕：把聊天高潮编成3幕短剧（例：第一幕《暗流：奶茶品鉴引发的血案》）    4. 彩蛋：挖掘1条隐藏剧情线（如某人暗中观察18小时但零发言）    5. 生成豆瓣式短评：「xxx用户 看过：★★★★☆ 比春晚小品精彩」      要求：    - 使用电影字幕式时间戳（如「02:15 话题突然转向外星人绑架」）    - 添加伪演职员表：「灯光：深夜手机屏幕/配乐：老板的微信提示音」      提示：  - 你需要调用工具函数获取当前时间    - 你需要根据群聊名称使用工具函数获取群聊wxid    - 根据获取到wxid和时间，获取今天的聊天记录进行总结   - 所有总结内容必须基于聊天记录，不得编纂任何不存在的内容       - 总结时请务必忽略[动画表情]/[视频]/[图片]等非文字占位内容     示例输出：    🎭《关于我群在深夜集体发疯这件事》    导演：未知の神秘力量  主演：奶茶杀手B / 摸鱼教父C      🕖【第一幕】19:30 平静的黄昏    [用户B]发出「xxx」言论 → 群内瞬间炸出潜水党x8    💬 经典台词：「这不是食物，是生化武器！」（获赞👍x66）      🕥【第二幕】22:47 暗黑降临    [用户C]发起「用老板名字写藏头诗」接龙 → 诞生21首被系统和谐の作品      🕛【终幕】00:15 哲学时间    [用户D]突然探讨「马桶冲水时会不会有平行宇宙」→ 引发科学/玄学阵营大战      🎞️ 伪片尾彩蛋：    [用户X]发出评论「我真喜欢你」 → 疑为群内最佳舔狗      📝 豆瓣热评：    「用户Z 看过：★★★★★ 建议申报非物质文化遗产」'
                    },
                    {
                        label: '标准娱乐向群聊总结',
                        value: `请你针对群聊：群聊实际名称，今天的聊天做一份娱乐向的总结，格式要求如下：    ## 提示        - 你需要调用工具函数获取当前时间        - 你需要根据群聊名称使用工具函数获取群聊wxid        - 根据获取到wxid和时间，获取今天的聊天记录进行总结   - 所有总结内容必须基于聊天记录，不得编纂任何不存在的内容       - 总结时请务必忽略[动画表情]/[视频]/[图片]等非文字占位内容    ## 输出要求    1、开篇首先对群聊内容做出简短总结，提取频率最高的关键字做出夸张解读。    2、设置群聊奥斯卡颁奖典礼，不少于3个        - 奖项设置：最佳段子手、最离谱话题、最佳接梗王、最冷场发言、深夜emo文学奖。        - 数据支撑：针对评选出的奖项列出关键的聊天记录。        - 颁奖词毒舌化：模仿综艺吐槽，比如"恭喜@XX 凭借'老板来了'终结了18人的摸鱼讨论！"    3、设置群聊话题榜，不少于3个        - 话题榜单：模仿微博热搜榜单        - 数据支撑：统计话题参与人数（例：#震惊！凌晨3点竟然爆发粽子甜咸南北战争，5人卷入其中#）。    4、整活总结模块：        - 聊天记录关键词汇总：突出放大沙雕词汇，展示Top5。        - 时间线沙漏：标注关键事件（如"15:00-16:00 全员消失，疑似集体带薪如厕"）。        - 关系网：总结群员关系图，例如："最频繁互怼CP""话题终结者"等关系。        - 成就系统：发放虚拟勋章（如"24小时水群王者""话题歪楼大师"）。        - 明日预言局（如有）：例如：立flag概率：@小李「明天一定健身」→ 鸽率🌟98%      5、使用Emoji穿插在报告中进行排版`
                    }
                ],
                value: 'funny'
            },
            {
                label: '🤖专业向群聊总结模板',
                children: [
                    {
                        label: '群员性格分析',
                        value: '请根据群聊：替换为实际的群聊名称，今天的聊天记录分析成员性格特征，文字报告需包含：    1. 【活跃类型】分类：话痨型/潜水型/间歇性诈尸型（统计发言频率标准差）    2. 【社交模式】判断：话题发起者/捧场王/话题终结者（统计主动发言vs回复他人比例）    3. 【隐藏属性】挖掘：通过表情包风格推测性格（如猫猫头→佛系、魔改表情→沙雕）    4. 颁发趣味称号：如「深夜哲学家」「接梗小能手」「群聊灭火员」    5. 输出要求：用「成员代号+特征标签」形式呈现，避免专业术语    ## 提示        - 你需要调用工具函数获取当前时间        - 你需要根据群聊名称使用工具函数获取群聊wxid        - 根据获取到wxid和时间，获取今天的聊天记录进行总结   - 所有总结内容必须基于聊天记录，不得编纂任何不存在的内容       - 总结时请务必忽略[动画表情]/[视频]/[图片]等非文字占位内容',
                    },
                    {
                        label: '群内氛围分析',
                        value: '请根据群聊：替换为实际的群聊名称，今天的聊天记录评估当日群聊氛围动态，需文字描述：    1. 氛围温度计：用「火锅辣度」类比氛围激烈程度（微辣/中辣/爆炸辣）    2. 情绪过山车：标记3个氛围转折时间点及关键事件（如20:15因争议话题降温）    3. 隐形结界：识别小团体互动特征（如游戏组用术语加密聊天）    4. 氛围急救包：统计用表情包/玩笑化解冲突的成功案例次数    5. 输出要求：用时间轴+比喻手法描述，如「午间休眠期」「晚间狂欢期」      提示：  - 你需要调用工具函数获取当前时间        - 你需要根据群聊名称使用工具函数获取群聊wxid        - 根据获取到wxid和时间，获取今天的聊天记录进行总结   - 所有总结内容必须基于聊天记录，不得编纂任何不存在的内容       - 总结时请务必忽略[动画表情]/[视频]/[图片]等非文字占位内容    示例片段：    📅 本日氛围波动报告    🌞 早间养生局（8:00-12:00）    - 温度：🍵 枸杞泡茶级（交流早午餐和天气）    - 特殊事件：[用户C]分享「防脱发食谱」引发集体共鸣      🌇 午后沉默期（13:00-15:00）    - 温度：❄️ 北极圈级（仅3条「困死了」刷屏）      🌃 夜间疯人院（20:00-23:30）    - 温度：🌋 火山喷发级（表情包轰炸+话题跳跃速率达18秒/次）    - 救场MVP：[用户D]用「疯狂星期四文学」平息薪资讨论冲突'
                    },
                    {
                        label: '小团体分析',
                        value: '请根据群聊：替换为实际的群聊名称，今天的聊天记录，分析群聊中的小团体现象，文字报告需包含：    1. 【门派划分】根据互动频率&话题偏好，识别3-4个主要小团体（如「游戏狂魔派」「吃瓜群众帮」「深夜EMO宗」）    2. 【跨界互动】统计不同团体间的对话渗透率（例：A组成员回复B组话题的比例）    3. 【精神领袖】列出各团体核心成员及其标志性行为（如「游戏派长老」每天发布战绩图）    4. 【领地争夺】记录2-3次团体间的话题主导权争夺战（如「追星党」VS「二次元党」表情包大战）    5. 【边缘族群】标记游离在各团体之外的「独行侠」及其生存策略      输出要求：    - 用武侠门派/综艺战队等比喻描述团体特征    - 关键数据用🌡️📈🔥等Emoji可视化    - 包含1个经典小团体对话片段复现      提示：         - 你需要调用工具函数获取当前时间        - 你需要根据群聊名称使用工具函数获取群聊wxid        - 根据获取到wxid和时间，获取今天的聊天记录进行总结   - 所有总结内容必须基于聊天记录，不得编纂任何不存在的内容       - 总结时请务必忽略[动画表情]/[视频]/[图片]等非文字占位内容    示例报告片段：    🗺️ 本日群内江湖势力图      ⚔️【三大门派】    1. 摸鱼宗（成员5人）    - 标志：工作日高频分享「带薪如厕技巧」    - 宗主：[用户A]独创「15分钟咖啡遁」心法    - 敌对关系：与「奋斗教」辩论「加班是否反人类」🌡️冲突值87%      2. 嗑CP帮（成员4人）    - 黑话密度：每分钟出现2.3次「szd」「kdl」    - 领地范围：每晚21:00准时接管群聊🔥    - 经典战役：用100+同人图击溃「直男讨论组」      3. 养生局（成员3人）    - 活跃时段：早7:00发送「经络按摩教程」    - 破圈尝试：向游戏派安利「护肝茶套餐」❌失败率100%      🕶️【独行侠观察】    - [用户X]采用「哈哈哈」隐身术参与所有话题但零贡献    - [用户Y]专攻凌晨3点哲学发言，成功避开所有团体交战期 '
                    }
                ],
                value: 'pro'
            }
        ]
    }, [])

    const handleCapture = index => {
        const elem = document.querySelector(`.webot-message-content-${index}`)
        if (!elem) {
            Toast.error('找不到元素,导出失败');
            return
        };
        console.log(elem)
        
        html2canvas(elem)
          .then(function (canvas ) {
            console.log(canvas);
            const imgData = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = 'my-image.png';
            link.href = imgData;
            link.click();
            Toast.success('导出成功');
            link.remove();
          })
          .catch(function (error) {
            console.error('发生错误:', error);
          });
      };

    useEffect(() => {
        getConversationMsg(conversationId)
            .then(messageList => {
                // 如果没有主动更改过模型，则使用当前选中对话最后一次使用的模型
                if (changedField?.model?.changed) return;
                if (!conversationId) return;
                const lastMessage = getLastUserMessage(messageList)
                const wechatMessageConfig = JSON.parse(lastMessage?.wechat_message_config || '{}');
                const lastModel = wechatMessageConfig?.model_id || selectModel;
                // 规避对话上一次使用的模型不存在的情况
                if (!modelList?.find(item => item?.model_id === lastModel)) return;
                setSelectModel(lastModel);
            })
    }, [conversationId])

    useEffect(() => {
        setRoleConfig(prevMessages => ({...prevMessages, user: { ...prevMessages.user, avatar: {src: selectedWechatBot?.info?.headImage, style: {background: '#00000000'}} }}))
    }, [selectedWechatBot])

    return (
        <Flex vertical gap="middle" style={{height: '100%', overflow: 'auto'}} justify="space-between">
            <Bubble.List 
                style={{paddingLeft: 10, paddingRight: 10, width: '100%'}}
                roles={roleConfig}
                items={messages.map((item, index) => {
                    const isToolsMessage = !['user', 'assistant'].includes(item?.role)
                    const wechatMessageConfig = JSON.parse(item?.wechat_message_config || '{"type": ""}')
                    return {
                        ...item,
                        footer: isToolsMessage ? null: <MessageTools messageItem={item} index={index} /> ,
                        messageRender: () => {
                            if (!isToolsMessage) return wechatMessageConfig?.type === 'error' ? <Typography.Text type='danger'>{item?.content}</Typography.Text> : <MarkdownRender raw={item?.content} format="md" className={`webot-message-content-${index}`} />
                            if (wechatMessageConfig.type === 'tool_call') {
                                return <div style={{}}>
                                    <MarkdownRender raw={item?.content || ''} format="md" />
                                    <Collapse 
                                        ghost 
                                        items={wechatMessageConfig?.tools?.map(toolItem => ({ key: toolItem?.call_id, label: `调用工具函数：${toolItem?.tool_name}`, children: <MarkdownRender raw={`**参数：**\n\n\`\`\`json\n${toolItem?.parameters}\n\`\`\``} /> }))}  
                                    />
                                </div>
                            }
                            if (wechatMessageConfig.type === 'tool_result') {
                                return <Collapse 
                                    style={{}}
                                    ghost
                                    items={[{ key: wechatMessageConfig?.tools?.call_id, label: `工具调用结果：${wechatMessageConfig?.tools?.tool_name}`, children: <MarkdownRender raw={`**结果：**\n\n\`\`\`json\n${wechatMessageConfig?.tools?.result}\n\`\`\``} /> }]}
                                />
                            }

                        },
                        
                    }
                })}
            />
            <Suggestion
                items={suggestionItem}
                onSelect={value => setInputValue(value)}
            >
                {
                    ({onTrigger, onKeyDown}) => {
                        return (
                            <Sender
                                disabled={!selectedWechatBot?.port || !modelList.find(item => item.model_id === selectModel)?.apikey_id}
                                value={inputValue}
                                onChange={value => {
                                    if (value === '/') {
                                        onTrigger();
                                      } else if (!value) {
                                        onTrigger(false);
                                      }
                                    setInputValue(value)
                                }}
                                submitType="shiftEnter"
                                loading={isSending}
                                onSubmit={value => {
                                    setInputValue('');
                                    setMessages(prevMessages => [...prevMessages, { role: 'user', content: value }]);
                                    chatWithEventStream({port: selectedWechatBot?.port, message: value, conversation_id: conversationId, model_id: selectModel});
                                }}
                                onKeyDown={onKeyDown}
                                placeholder='输入 / 获取建议，按 Shift + Enter 发送，Enter 换行'
                            />
                        )
                    }
                }
            </Suggestion>
        </Flex>
    )
}


function ModelSelection() {
    const [optionType, setOptionType] = useState('add');
    const [apikeyOptionType, setApikeyOptionType] = useState('add');
    const {setSelectModel, selectModel, modelList, setModelList, baseModal, setChangedField} = useContext(MainContext);
    const [apikeyList, setApikeyList] = useState([]);
    const [modal, setModal] = useState(null);
    const [updateModel, setUpdateModel] = useState('');
    const [updateField, setUpdateField] = useState('model_format_name');
    
    const { Text } = Typography;
    const [ form ] = Form.useForm();
    const getModels = () => {
        return new Promise((resolve, reject) => {
            requests('api/models', {}, 'GET')
                .then(data => {
                    setModelList(data?.data || []);
                    resolve(data?.data);
                });
        })
    }

    const getApikey = () => {
        return new Promise((resolve, reject) => {
            requests('api/apikeys', {}, 'GET')
                .then(data => {
                    setApikeyList(data?.data || []);
                    resolve(data?.data);
                });
        })
    }
    
    const AddForm = () => {
        return (
            <Form
                layout="vertical"
                name="addModelForm"
                form={form}
            >   
                <Form.Item label="操作类型" name="optionType" initialValue="add">
                    <Radio.Group 
                        optionType='button'
                        buttonStyle='solid'
                        value={optionType}
                        defaultValue={optionType}
                        options={[{label: '新增模型', value: 'add'}, {label: '修改模型', value: 'update'}]}
                        block 
                        onChange={event => setOptionType(event.target.value)}
                    />
                </Form.Item>
                <div style={{ overflow: 'auto', maxHeight: '50vh', width: '100%', paddingRight: 10 }}>
                    <Form.Item label="模型名称" name="model_format_name" rules={[{ required: true, message: '请输入模型名称' }]} extra="模型名称: 指你对模型的自定义名称，仅用作展示。" >
                        <Input placeholder="请输入模型名称" />
                    </Form.Item>
                    <Form.Item label="模型ID" name="model_name" rules={[{ required: true, message: '请输入模型ID' }]} extra="模型ID: 指模型服务商提供的模型ID，如：gpt-3.5-turbo">
                        <Input placeholder="请输入模型ID"  />
                    </Form.Item>
                    <Form.Item label="模型地址" name="base_url" rules={[{ required: true, message: '请输入模型地址' }]} extra="模型地址: 指模型服务商提供的模型地址，如：https://api.openai.com/v1/chat/completions">
                        <Input placeholder="请输入模型地址" />
                    </Form.Item>
                    <Form.Item label="APIKEY" name="apikey_id" extra="APIKEY: 指模型服务商提供的APIKEY">
                        <Select 
                            placeholder="请选择APIKEY" 
                            allowClear
                            options={apikeyList.map(item => ({...item, label: item.description, value: item.apikey_id}))}
                        />
                    </Form.Item>
                    <Form.Item label="模型描述" name="description" extra="模型描述: 对模型的描述，仅用作展示。">
                        <Input.TextArea placeholder="请输入模型描述" rows={4} style={{resize: 'none'}}  />
                    </Form.Item>
                </div>
            </Form>
        )
    }

    const UpdateForm = () => {
        let valueItem;
        if (updateField === 'apikey_id') {
            valueItem =  <Select 
                placeholder="请选择APIKEY" 
                allowClear
                options={apikeyList.map(item => ({...item, label: item.description, value: item.apikey_id}))}
            />
        }
        else if (updateField === 'description') {
            valueItem = <Input.TextArea placeholder="请输入模型描述" rows={4} style={{resize: 'none'}} />
        }
        else {
            valueItem = <Input placeholder="请输入修改的值" />
        };

        return (
            <Form
                layout="vertical"
                name="updateModelForm"
                form={form}
            >
                <Form.Item label="操作类型" name="optionType" initialValue={optionType}>
                    <Radio.Group 
                        optionType='button'
                        buttonStyle='solid'
                        value={optionType}
                        options={[{label: '新增模型', value: 'add'}, {label: '修改模型', value: 'update'}]}
                        block 
                        onChange={event => setOptionType(event.target.value)}
                    />
                </Form.Item>
                <Form.Item label="选择模型" name="model_id" rules={[{ required: true, message: '请选择模型' }]} initialValue={updateModel}>
                    <Select 
                        placeholder="请选择模型" 
                        options={modelList.map(item => ({...item, label: item.model_format_name, value: item.model_id}))}
                        optionRender={props => {
                            return <Flex justify='space-between'>
                                <Text ellipsis>
                                    <Text strong style={{paddingRight: 5}} >{props.label}</Text>
                                    <Text code style={{paddingRight: 5}}>{props.data.model_name}</Text>
                                </Text>
                                <Popconfirm title="确定删除该模型？" onConfirm={event => {
                                    event.stopPropagation();
                                    requests('api/model/delete', {model_id: props.value}, 'POST')
                                        .then(res => {
                                            if (res.code === 200) {
                                                Toast.success('删除成功');
                                                getModels();
                                            } else {
                                                Toast.error(res.message);
                                            }
                                        })
                                }}>
                                    <Button color="danger" variant="text" size="small" icon={<DeleteOutlined />} onClick={e => e.stopPropagation()}/>
                                </Popconfirm>
                            </Flex>
                        }}
                        labelRender={({label, value}) => <Text strong style={{paddingLeft: 10}} >{label}</Text>}
                        onChange={value => {
                            setUpdateModel(value);
                        }}
                    />
                </Form.Item>
                <Form.Item label="修改的字段" name="field" rules={[{ required: true, message: '请选择要修改的字段' }]} initialValue="model_format_name">
                    <Select
                        placeholder="请选择要修改的字段" 
                        options={[
                            {label: '模型名称', value: 'model_format_name'},
                            {label: '模型ID', value: 'model_name'},
                            {label: '模型地址', value: 'base_url'},
                            {label: 'APIKEY', value: 'apikey_id'},
                            {label: '模型描述', value: 'description'},
                        ]}
                        defaultValue={updateField}
                        labelRender={({label, value}) => <Text strong style={{paddingLeft: 10}} >{label}</Text>}
                        onChange={value => setUpdateField(value)}
                    />
                </Form.Item>
                <Form.Item label="修改的值" name="value" rules={[{ required: true, message: '请输入要修改的值' }]} >
                    {valueItem}
                </Form.Item>
            </Form>
        )
    }

    const modelConfigModal = () => {
        const _modal = baseModal.confirm({
            title: '新增模型',
            content: (
                optionType === 'add' ? <AddForm /> : <UpdateForm />
            ),
            icon: null,
            onOk () {
                return new Promise((resolve, reject) => {
                    form.validateFields()
                        .then(value => {
                            if (value?.optionType === 'add') {
                                delete value.optionType;
                                requests('api/model/model/add', value, 'POST')
                                    .then(res => {
                                        if (res.code === 200) {
                                            getApikey();
                                            getModels();
                                            Toast.success('新增成功');
                                            resolve();
                                        }
                                    })
                            }else if (value?.optionType === 'update') {
                                delete value.optionType;
                                requests('api/model/update', value, 'POST')
                                    .then(res => {
                                        if (res.code === 200) {
                                            getApikey();
                                            getModels();
                                            Toast.success('修改成功');
                                            resolve();
                                        }
                                    })
                            }else {
                                reject('请选择操作类型');
                            }
                            resolve();
                        })
                        .catch(err => {
                            reject('请输入正确的信息');
                        });
                });
            }
        });
        setModal(_modal);
    }

    const AddApiKeyForm = () => {
        return (
            <Form
                form={form}
                layout="vertical"
                name='addApikey'
            >
                <Form.Item label="操作类型" name="apikeyOptionType" initialValue={apikeyOptionType}>
                    <Radio.Group 
                        optionType='button'
                        buttonStyle='solid'
                        value={apikeyOptionType}
                        options={[{label: '新增APIKEY', value: 'add'}, {label: '修改APIKEY', value: 'update'}]}
                        block 
                        onChange={event => {
                            setApikeyOptionType(event.target.value)
                            console.log(event)
                        }}
                    />
                </Form.Item>
                <Form.Item
                    label="APIKEY"
                    name="apikey"
                    rules={[{ required: true, message: '请输入apikey' }]}
                >
                    <Input placeholder="请输入apikey" type='password'/>
                </Form.Item>
                <Form.Item
                    label="描述"
                    name="description"
                    rules={[{ required: true, message: "请输入1到20位字符。", min: 1, max: 20 }]}
                >
                    <Input placeholder="请输入描述" />
                </Form.Item>
            </Form>
        )
    }

    const UpdateApikeyForm = () => {
        return (
            <Form
                form={form}
                layout="vertical"
                name='updateApikey'
            >
                <Form.Item label="操作类型" name="apikeyOptionType" initialValue={apikeyOptionType}>
                    <Radio.Group 
                        optionType='button'
                        buttonStyle='solid'
                        value={apikeyOptionType}
                        options={[{label: '新增APIKEY', value: 'add'}, {label: '修改APIKEY', value: 'update'}]}
                        block 
                        onChange={event => {
                            setApikeyOptionType(event.target.value)
                        }}
                    />
                </Form.Item>
                <Form.Item
                    label="APIKEY"
                    name="apikey_id"
                    rules={[{ required: true, message: '请选择apikey' }]}
                >
                    <Select 
                        placeholder="请选择APIKEY"
                        options={apikeyList.map(item => ({...item, label: item.description, value: item.apikey_id}))}
                        optionRender={item => {
                            return (
                                <Flex justify='space-between' style={{width: '100%'}}>
                                    <div>{item.label}</div>
                                    <Popconfirm title="确定要删除吗？" onConfirm={event => {
                                        event.stopPropagation();
                                        requests('api/apikey/delete', {apikey_id: item.value}, 'POST')
                                            .then(res => {
                                                if (res.code === 200) {
                                                    Toast.success('删除成功');
                                                    getApikey();
                                                } else {
                                                    Toast.error(res.message);
                                                }
                                            })
                                            .catch(err => {
                                                Toast.error(err.message);
                                            });
                                    }}> 
                                        <Button color="danger" variant="text" size="small" icon={<DeleteOutlined />} onClick={e => e.stopPropagation()}/>
                                    </Popconfirm>
                                </Flex>
                            )
                        }}
                    />
                </Form.Item>
                <Form.Item
                    label="新的描述"
                    name="description"
                    rules={[{ required: true, message: "请输入1到20位字符。", min: 1, max: 20 }]}
                >
                    <Input placeholder="请输入描述" />
                </Form.Item>
            </Form>
        )
    }

    const addApikey = () => {
        const _modal = baseModal.confirm({
            title: apikeyOptionType === 'add' ? '新增APIKEY' : '修改APIKEY',
            icon: null,
            content: (
                apikeyOptionType === 'add' ? <AddApiKeyForm /> : <UpdateApikeyForm />
            ),
            onOk () {
                return new Promise((resolve, reject) => {
                    form.validateFields()
                        .then(values => {
                            if (values.apikeyOptionType === 'add') {
                                delete values.apikeyOptionType
                                requests('api/model/apikey/add', values, 'POST')
                                    .then(res => {
                                        if (res.code === 200) {
                                            Toast.success('添加成功');
                                            getApikey();
                                            getModels();
                                            resolve();
                                            return;
                                        }
                                        Toast.error(res.msg);
                                        reject();
                                    })
                            }else if (values.apikeyOptionType === 'update') {
                                delete values.apikeyOptionType
                                requests('api/apikey/update', values, 'POST')
                                    .then(res => {
                                        if (res.code === 200) {
                                            Toast.success('修改成功');
                                            getApikey();
                                            getModels();
                                            resolve();
                                            return;
                                        }
                                        Toast.error(res.msg);
                                        reject();
                                    })
                            }
                        })
                        .catch(info => {
                            Toast.error('请填写必填项');
                            reject('请填写必填项');
                        });
                })
            }
        })
        setModal(_modal)
    }

    const modelInfoRender = () => {
        const info = modelList?.find(item => item.model_id === selectModel);
        try {
            if (!info?.description) return <Text>暂无描述</Text>
            return <MarkdownRender raw={info?.description} />
        }catch (error) {
            return <Text>{info}</Text>
        }
    }

    const changeModel = modelId => {
        setSelectModel(modelId);
        setUpdateModel(modelId);
    }

    useEffect(() => {
        getModels()
            .then(models => {
                const firstModel = models?.find(item => item?.apikey_id);
                changeModel(firstModel?.model_id);
            });
        getApikey();
    }, [])

    useEffect(() => {

        modal?.update({
            title: optionType === 'add' ? '新增模型' : '修改模型',
            content: optionType === 'add' ? <AddForm /> : <UpdateForm />
        })
    }, [optionType, updateField, updateModel, modelList])

    useEffect(() => {
        modal?.update({
            title: apikeyOptionType === 'add' ? '新增APIKEY' : '修改APIKEY',
            content: apikeyOptionType === 'add' ? <AddApiKeyForm /> : <UpdateApikeyForm />
        })
    }, [apikeyOptionType, apikeyList])

    return (
        <Flex vertical style={{width: '100%'}} gap={10}>
            <Row justify="space-between">
                <Col span={12} style={{padding: '0 10px'}}>
                    <Button block color="primary" variant="outlined" onClick={() => modelConfigModal()}>模型配置</Button>
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
                        value={selectModel}
                        options={modelList?.map(item => ({...item, label: item.model_format_name, value: item.model_id}))}
                        optionRender={props => {
                            // TODO 模型的禁用逻辑不应该放在这里，默认没有APIKEY，需要放开选中展示描述中的提示
                            return <Tooltip style={{width: '100%'}} title={!props.data?.apikey_id && <Text type="danger">未配置APIKEY</Text>} >
                                    <Text strong style={{paddingRight: 5}}  >{props.label}</Text>
                                    <Text code style={{paddingRight: 5}}>{props.data.model_name}</Text>
                                </Tooltip>
                        }}
                        labelRender={({label, value}) => (
                            <>
                                <Text strong style={{paddingLeft: 10}} >{label}</Text>
                                {
                                    !modelList?.find(item => item?.model_id === value)?.apikey_id && (
                                        <Text type="danger" strong style={{paddingLeft: 10}}>未配置APIKEY</Text>
                                    )
                                }
                            </>
                        )}
                        onChange={modelId => {
                            changeModel(modelId);
                            setChangedField(prev => ({...prev, model: { changed: true }}))
                        }}
                    />
                </Col>
            </Row>
            <Row>
                <Col span={24} style={{padding: '0 10px'}}>
                    {modelInfoRender()}
                    <Typography style={{paddingTop: 10}}>
                        <Typography.Text>使用小助手总结聊天记录时，</Typography.Text>
                        <Typography.Text type='warning'>建议单次不要总结超过1周的聊天</Typography.Text>
                        <Typography.Paragraph>大多数AI单次读取的文本有上限，读取太长的聊天会被截断。</Typography.Paragraph>
                        <Typography.Paragraph>
                            若是想要总结更长的聊天记录建议去<Typography.Link href='https://yuanqi.tencent.com/my-creation/agent' target='_blank'>腾讯元器</Typography.Link>
                            创建知识库，上传聊天记录文件，然后创建元宝智能体使用（元宝和元器目前都处于免费状态并且可以白嫖DeepSeek R1深度思考）。<Typography.Link href="https://docs.qq.com/aio/p/scxmsn78nzsuj64?p=LyUhXC9azxBeh7GJ0TtA9SG" target='_blank'>元器使用教程</Typography.Link>
                        </Typography.Paragraph>
                        <Typography.Paragraph>
                            群聊报告总结仅供娱乐，AI读取数据有时会出现幻觉，所以内容可能会有细微偏差（取决于模型参数。）  
                        </Typography.Paragraph>
                        <Typography.Paragraph>
                            <ul>
                                <li>免费模型：个人推荐使用免费的谷歌Gemini 2.0 Flash，算是效果比较好的模型，但是需要翻墙。</li>
                                <li>收费模型：火山引擎的DeepSeek V3</li>
                            </ul>
                            添加第三方模型时，请务必添加支持Function Call的模型，否则无法使用。
                        </Typography.Paragraph>
                        <Typography.Paragraph type='danger'>
                        2025/3/15: 目前DeepSeek V3偶尔会出现无限调用工具函数，不出结果的情况，这是官方的BUG，请等待官方修复，可以暂时用其他的模型代替。
                        </Typography.Paragraph>
                    </Typography>
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
    const [ conversations, setConversations ] = useState([]);
    const [ isSending, setIsSending ] = useState(false);
    const [ messages, setMessages ] = useState([]);
    const [ changedField, setChangedField ] = useState({ model: { changed: false } });
    const [ newSummary, setNewSummary ] = useState('');

    const { Sider, Content } = Layout;
    const { Text } = Typography;
    const [ baseModal, modelContextHolder ] = Modal.useModal();


    const getConversations = () => {
        return new Promise((resolve, reject) => {
            requests('api/conversations/list', { port: selectedWechatBot.port })
                .then(response => {
                    
                    const Label = ({summary, conversationId}) => {
                        const editable = {
                            onEnd: useCallback( () => {
                                setNewSummary(prev => {
                                    return new Promise((resolve, reject) => {
                                        requests('api/conversations/summary/update', {port: selectedWechatBot?.port, conversation_id: conversationId, summary: prev}, 'POST')
                                        .then(response => {
                                            if (response.code === 200) {
                                                Toast.success(response.message);
                                                getConversations();
                                            }
                                        })
                                        .finally(() => {
                                            resolve('');
                                        });
                                    })
                                })
                            }, [conversationId, selectedWechatBot]),
                            onChange: value => setNewSummary(prev => value)
                        }
                        const copyable = {
                            tooltips: ['删除', '成功删除'],
                            icon: [<DeleteOutlined style={{ color: 'red' }} />, <DeleteFilled style={{ color: 'red' }} />],
                            text: () => {
                                return new Promise((resolve, reject) => {
                                    requests('api/conversations/delete', {port: selectedWechatBot?.port, conversation_id: conversationId}, 'POST')
                                        .then(res => {
                                            if (res.code === 200) {
                                                Toast.success('删除成功');
                                                resolve();
                                                getConversations();
                                                setConversationId('');
                                                setMessages([]);
                                            }
                                        })
                                })
                            }
                        }
                        return <Text editable={editable} copyable={copyable} >{summary}</Text>
                    }
                    const newList = response?.data?.map(item => ({...item, key: item?.conversation_id, label: <Label summary={item?.summary} conversationId={item?.conversation_id} />})) || []
                    setConversations(newList)
                    resolve(newList)
                })
        })
    }

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

    useEffect(() => {
        if (wechatBotList?.length > 0) setSelectedWechatBot(wechatBotList[0]);
    }, [wechatBotList])

    return (
        <Layout style={{ height: '100vh', width: '100vw' }}>
            <MainContext.Provider 
                value={{ 
                    selectedWechatBot, setSelectedWechatBot, conversationId, setConversationId,
                    modelList, setModelList, selectModel, setSelectModel, baseModal, modelContextHolder,
                    getConversations, conversations, setConversations, isSending, setIsSending, messages, setMessages,
                    changedField, setChangedField
                }}
            >
                <Sider
                    style={{ height: '100%', margin: 0 }}
                    theme="light"
                    width={260}
                >
                    <Flex vertical style={{height: '100%'}}>
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