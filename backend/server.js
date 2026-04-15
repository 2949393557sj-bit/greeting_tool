const express = require('express');
const cors = require('cors');
const { createWorker } = require('tesseract.js');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const VOLCENGINE_BASE_URL = process.env.VOLCENGINE_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
const API_KEY = process.env.API_KEY;
const MODEL = process.env.MODEL;

let dbPool = null;

async function initDB() {
  try {
    dbPool = mysql.createPool(process.env.DATABASE_URL);
    const connection = await dbPool.getConnection();
    console.log('✅ MySQL 数据库连接成功');
    connection.release();
  } catch (error) {
    console.error('❌ MySQL 数据库连接失败:', error.message);
  }
}

function getToday() {
  return new Date().toISOString().split('T')[0];
}

async function trackEvent(eventName, userId = null) {
  try {
    if (!dbPool) return;
    
    const today = getToday();
    await dbPool.execute(
      'INSERT INTO stats (event_name, user_id, event_date) VALUES (?, ?, ?)',
      [eventName, userId, today]
    );
  } catch (error) {
    console.error('记录统计事件失败:', error.message);
  }
}
//
async function getStats() {
  if (!dbPool) {
    return { error: '数据库未连接' };
  }

  try {
    const [totalRows] = await dbPool.execute(
      'SELECT event_name, COUNT(*) as count FROM stats GROUP BY event_name'
    );
    const [dailyRows] = await dbPool.execute(
      'SELECT event_date, event_name, COUNT(*) as count FROM stats GROUP BY event_date, event_name ORDER BY event_date DESC'
    );
    const [totalUsersRow] = await dbPool.execute(
      'SELECT COUNT(DISTINCT user_id) as count FROM stats WHERE user_id IS NOT NULL'
    );
    const [dailyUsersRows] = await dbPool.execute(
      'SELECT event_date, COUNT(DISTINCT user_id) as count FROM stats WHERE user_id IS NOT NULL GROUP BY event_date ORDER BY event_date DESC'
    );

    const result = {
      total: {},
      dailyStats: {},
      totalUsers: totalUsersRow[0]?.count || 0,
      dailyUsers: {}
    };

    totalRows.forEach(row => {
      result.total[row.event_name] = row.count;
    });

    dailyRows.forEach(row => {
      if (!result.dailyStats[row.event_date]) {
        result.dailyStats[row.event_date] = {};
      }
      result.dailyStats[row.event_date][row.event_name] = row.count;
    });

    dailyUsersRows.forEach(row => {
      result.dailyUsers[row.event_date] = row.count;
    });

    return result;
  } catch (error) {
    console.error('获取统计数据失败:', error.message);
    return { error: '获取统计数据失败' };
  }
}

function buildAgentTwoSystem() {
  return `你是专业JD结构化提取专家，只执行规则，不解释、不提问、不补充。
处理规则：
1. **无视岗位职责、工作内容**，只关心岗位要求和加分项。
2. 从JD中提取所有岗位要求和加分项，严格分类，不得遗漏。
3. 思维、协作等社会软技能及情感态度单独归为一类：学习能力、逻辑思维、做事认真细致、热爱、积极、主动、抗压、责任心、沟通、协调团队合作、主动性等。
4. 硬性门槛直接丢弃，不输出：学历、届别、年级、是否在校、Base地点、到岗时间、实习时长、每周天数。
5. 硬性要求(required)：必须具备的专业技能、工具、项目经验、业务能力。
6. 加分项(plus)：非必需但优先的技能、经验、证书等。

输出格式（仅JSON，无其他）：
{
  "required_skills": ["技能1","技能2"],
  "plus_skills": ["技能1","技能2"],
  "emotional_traits": ["软技能1","软技能2"]
}`;
}

function buildAgentOneSystem(requiredSkills, plusSkills, greeting, advantageLines) {
  const adv = (advantageLines && advantageLines.length) ? advantageLines.join('、') : '（无）';
  return `你是严格规则执行的求职匹配器，禁止提问、禁止发散。
执行步骤：
1. 读取两种岗位要求：硬性要求：${JSON.stringify(requiredSkills)}、加分项：${JSON.stringify(plusSkills)}
2.读取候选人打招呼消息、候选人优势库：${greeting}；优势库：${adv}
3.将两种岗位要求和打招呼消息、候选人优势库进行比对，基本能推测、判断用户满足的要求就不输出，仅输出无法判断用户是否满足的要求。
5. 每条≤18字，总数≤8条。
6. 若无任何存疑，返回空traits。

输出格式（仅JSON，无其他）：
{
  "unknown_required_skills": ["技能1","技能2"],
  "unknown_plus_skills": ["技能1","技能2"],
}`;
}

function buildAgentThreeSystem() {
  return `你是打招呼消息微调专家，只需要把求职者贴合JD的特质插入到原打招呼消息中，新打招呼消息要高度模仿抄袭原打招呼消息，能少改一个符号和字绝不多改，但要确保把贴合JD的要求插入
要求：
- 严格保留原打招呼消息的内容、符号、格式，不要删减、改动原打招呼消息的内容、数据、符号、格式，最好一字不改，只将贴合JD的内容添加进去
- 突出候选人与 JD 匹配的特质，把勾选的特质自然插入到合适位置，没有合适位置则加到文末
- 软技能类特质（沟通、逻辑思维、责任心等）不要生硬陈述，如需体现应通过具体事例自然带出，若无法自然融入则跳过
- 自然插入指的是谓语宾语都要有，例如不要写"xx能力/经验"，而要写"具备xx能力/经验"，不要有明显生硬堆砌的感觉
- 不要改动候选人姓名、学校等基本信息
-不是邮件，严禁加上原来没有的署名之类
-段落之间只需要换行，严禁空一行
- 控制在 400 字以内
- 只输出新打招呼消息的内容**禁止加任何说明**，也不要加"新打招呼消息："，确保可以直接发给HR。`;
}

const upload = multer({ dest: 'uploads/' });

app.use(cors({
  origin: 'https://greeting-tool.vercel.app'
}));
app.use(express.json({ limit: '50mb' }));

let ocrWorker = null;

async function getOCRWorker() {
  if (!ocrWorker) {
    ocrWorker = await createWorker(['chi_sim', 'eng'], 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`OCR 进度: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
  }
  return ocrWorker;
}

async function ocrImage(imageUrl) {
  try {
    const worker = await getOCRWorker();
    
    let imageBuffer;
    if (imageUrl.startsWith('data:')) {
      const base64Data = imageUrl.split(',')[1];
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else {
      const response = await fetch(imageUrl);
      imageBuffer = Buffer.from(await response.arrayBuffer());
    }
    
    const { data: { text } } = await worker.recognize(imageBuffer);
    return text.trim();
  } catch (error) {
    console.error('OCR 处理失败:', error);
    return '[OCR识别失败]';
  }
}

function extractImagesFromMessages(messages) {
  const images = [];
  function extractFromContent(content) {
    if (typeof content === 'string') return;
    if (Array.isArray(content)) {
      content.forEach(item => {
        if (item.type === 'image_url' && item.image_url?.url) {
          images.push(item.image_url.url);
        }
      });
    }
  }
  
  messages.forEach(msg => {
    extractFromContent(msg.content);
  });
  
  return images;
}

function replaceImagesWithText(messages, ocrResults) {
  let imageIndex = 0;
  
  return messages.map(msg => {
    if (typeof msg.content === 'string') return msg;
    
    if (Array.isArray(msg.content)) {
      const newContent = msg.content.map(item => {
        if (item.type === 'image_url' && item.image_url?.url) {
          const ocrText = ocrResults[imageIndex] || '[图片内容]';
          imageIndex++;
          return { type: 'text', text: `[图片内容识别结果]\n${ocrText}` };
        }
        return item;
      });
      return { ...msg, content: newContent };
    }
    
    return msg;
  });
}

async function extractTextFromResume(filePath, mimetype) {
  let text = '';
  
  if (mimetype === 'application/pdf') {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    text = data.text;
  } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
             mimetype === 'application/msword') {
    const result = await mammoth.extractRawText({ path: filePath });
    text = result.value;
  } else if (mimetype.startsWith('image/')) {
    const worker = await getOCRWorker();
    const { data: { text: ocrText } } = await worker.recognize(filePath);
    text = ocrText;
  } else {
    throw new Error('不支持的文件格式');
  }

  return text;
}

app.post('/api/chat/completions', async (req, res) => {
  const { messages, max_tokens, agentType, agentParams, userId } = req.body;

  console.log('\n====================================');
  console.log('代理请求，模型:', MODEL);
  console.log('Agent类型:', agentType || 'default');
  console.log('用户ID:', userId || '未提供');
  const startTime = Date.now();

  try {
    let processedMessages = [...messages];
    let ocrTime = 0;
    
    const images = extractImagesFromMessages(messages);
    
    if (agentType === 'agentTwo') {
      trackEvent('jdExtract', userId);
      if (images.length > 0) {
        trackEvent('jdExtractImage', userId);
      } else {
        trackEvent('jdExtractText', userId);
      }
      const systemPrompt = buildAgentTwoSystem();
      processedMessages = [
        { role: 'system', content: systemPrompt },
        ...processedMessages
      ];
    } else if (agentType === 'agentOne' && agentParams) {
      trackEvent('skillMatch', userId);
      const systemPrompt = buildAgentOneSystem(
        agentParams.requiredSkills,
        agentParams.plusSkills,
        agentParams.greeting,
        agentParams.advantageLines
      );
      processedMessages = [
        { role: 'system', content: systemPrompt },
        ...processedMessages
      ];
    } else if (agentType === 'agentThree') {
      trackEvent('greetingGenerate', userId);
      const systemPrompt = buildAgentThreeSystem();
      processedMessages = [
        { role: 'system', content: systemPrompt },
        ...processedMessages
      ];
    }
    
    if (images.length > 0) {
      console.log(`检测到 ${images.length} 张图片，开始 OCR 处理...`);
      const ocrStartTime = Date.now();
      
      const ocrResults = [];
      for (let i = 0; i < images.length; i++) {
        console.log(`OCR 处理第 ${i + 1} 张图片...`);
        const imgUrl = images[i];
        const text = await ocrImage(imgUrl);
        ocrResults.push(text);
        console.log(`第 ${i + 1} 张图片 OCR 完成，识别文字长度: ${text.length}`);
      }
      
      ocrTime = Date.now() - ocrStartTime;
      console.log(`OCR 处理完成，用时: ${ocrTime}ms`);
      
      processedMessages = replaceImagesWithText(processedMessages, ocrResults);
      console.log('所有图片 OCR 处理完成，发送给大模型...');
    }

    console.log('开始调用大模型...');
    const modelStartTime = Date.now();
    
    const response = await fetch(`${VOLCENGINE_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: max_tokens || 4096,
        messages: processedMessages
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('火山API错误:', errData);
      return res.status(response.status).json(errData);
    }

    const data = await response.json();
    const modelTime = Date.now() - modelStartTime;
    console.log(`大模型调用完成，用时: ${modelTime}ms`);
    
    const totalTime = Date.now() - startTime;
    console.log(`总用时: ${totalTime}ms`);
    console.log('====================================\n');
    
    res.json(data);
  } catch (error) {
    console.error('代理请求失败:', error);
    res.status(500).json({ error: error.message || '代理请求失败' });
  }
});

app.post('/api/resume/generate', upload.single('resume'), async (req, res) => {
  const { style, styleType, isRegenerate, userId } = req.body;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: '缺少简历文件' });
  }

  console.log('\n====================================');
  console.log('简历生成打招呼请求');
  console.log('文件:', file.originalname, file.mimetype);
  console.log('风格类型:', styleType);
  console.log('是否重新生成:', isRegenerate);
  console.log('用户ID:', userId || '未提供');
  const startTime = Date.now();

  try {
    trackEvent('resumeUpload', userId);
    if (isRegenerate) {
      trackEvent('resumeRegenerate', userId);
    } else {
      trackEvent('resumeGenerate', userId);
    }

    console.log('开始解析简历...');
    const text = await extractTextFromResume(file.path, file.mimetype);
    console.log('简历解析完成，文字长度:', text.length);

    const exampleConcise = `HR 您好，我是哈工深计算机专业在读生苏娟。认真看了贵司岗位 JD，我的核心能力与需求高度匹配： 
【AI 产品落地】：主导AI 课堂点评从 0 到 1 落地，集成多模态大模型，实现课程智能分析，点评效率提升 90%+；独立完成 8 + 份 AI 功能文档，涵盖 Prompt 工程、交互布局、收费标准全流程。 
【vibe coding 产品迭代】：具备 vibe coding 能力，独立完成艺好师 / 艺好课小程序 20 + 页面 UI 交互优化与20＋个bug 修复，无需依赖开发即可快速迭代产品体验，保障线上稳定性。 
【全流程产品能力】：输出 30 + 份产品文档，包含 PRD、问题汇总、业务方案等，覆盖从用户调研、需求设计到落地运营的完整闭环。 
我的简历已备好，期待能和您进一步沟通，为公司创造价值～`;

    const exampleWarm = `HR 您好～我是哈尔滨工业大学（深圳）计算机专业在读的苏娟。认真看完贵司的岗位 JD 后，我非常认同团队的产品方向，也很确信自己的能力和岗位需求高度契合，所以冒昧来和您沟通机会。 
我在 AI 产品落地方面有完整的从 0 到 1 经验：曾主导 AI 课堂点评产品的全流程搭建，集成多模态大模型实现课程智能分析，直接让点评效率提升了 90% 以上；同时独立完成了 8 + 份 AI 功能全流程文档，覆盖 Prompt 工程、交互设计、商业化方案等环节，能独立推进产品从想法到落地。 
我也具备 vibe coding 全链路产品能力：独立负责艺好师 / 艺好课小程序的产品迭代，完成了 20 + 页面的 UI 交互优化、20 + 个线上 bug 修复，不用依赖开发就能快速迭代产品体验，保障线上服务的稳定运行。 
此外，我有完整的产品全流程闭环能力：累计输出 30 + 份产品文档，包含 PRD、需求分析、业务方案等，从用户调研、需求设计到落地运营的每个环节都有实操经验，能快速融入团队推进业务。 
我的简历已经准备好，非常期待能有机会和您进一步沟通，也希望能凭借自己的能力为贵司创造价值～`;

    const selectedExample = styleType === 'warm' ? exampleWarm : exampleConcise;

    const systemPrompt = `你是超好用的求职助手，善于从用户的简历中提取出用户的优势，boss打招呼消息给用户，用来在boss直聘上给HR打招呼争取面试机会。生成时注意条理清晰、亮点突出、突出量化成果。

参考下例：
${selectedExample}

用户风格要求：
${style || ''}
输出限制：
1.一定要根据简历内容生成，不要虚构。
2。注意简洁，总共不超过400字。
3.中间不要有空行！
`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `以下是我的简历内容，请帮我生成一段合适的求职打招呼消息：\n\n${text}` }
    ];

    console.log('开始调用大模型生成打招呼...');
    const modelStartTime = Date.now();

    const response = await fetch(`${VOLCENGINE_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        messages: messages
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('火山API错误:', errData);
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(response.status).json(errData);
    }

    const data = await response.json();
    const modelTime = Date.now() - modelStartTime;
    console.log(`大模型调用完成，用时: ${modelTime}ms`);

    const totalTime = Date.now() - startTime;
    console.log(`总用时: ${totalTime}ms`);
    console.log('====================================\n');

    const greeting = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '';

    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    res.json({ greeting: greeting });
  } catch (error) {
    console.error('简历处理失败:', error);
    if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    res.status(500).json({ error: error.message || '简历处理失败' });
  }
});

app.post('/api/track/copy', (req, res) => {
  const { userId } = req.body;
  trackEvent('copyResult', userId);
  res.json({ success: true });
});

app.get('/api/stats', async (req, res) => {
  const statsData = await getStats();
  res.json(statsData);
});

// 新增：Railway健康检查接口，必须放在/api/stats后面
app.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    service: 'greeting-tool',
    dbConnected: !!dbPool 
  });
});

if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

async function startServer() {
  // 数据库异步初始化，不阻塞服务启动，避免Railway健康检查超时
  initDB().catch(err => console.error('数据库初始化失败:', err));
  app.listen(PORT, () => {
    console.log(`火山 API 代理服务器已启动: http://localhost:${PORT}`);
    console.log(`前端请调用: http://localhost:${PORT}/api/chat/completions`);
    console.log(`简历生成接口: http://localhost:${PORT}/api/resume/generate`);
    console.log(`统计接口: http://localhost:${PORT}/api/stats`);
    console.log(`OCR 功能已启用，支持中英文识别（懒加载）`);
    console.log(`支持文件格式: PDF / Word / 图片`);
    console.log(`✅ 环境变量已加载: ${API_KEY ? 'API_KEY已设置' : '⚠️ API_KEY未设置'}`);
  });
}

startServer();
