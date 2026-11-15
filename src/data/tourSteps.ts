export interface TourSpec {
  label: string;
  value: string;
}

export type CycleId = 'grass' | 'feed' | 'water' | 'manure' | 'energy' | 'digital';

export interface TourStep {
  id: string;
  indexLabel: string;
  shortTitle: string;
  title: string;
  description: string;
  loopChain: string;
  equipment: string[];
  specs: TourSpec[];
  cameraPos: [number, number, number];
  target: [number, number, number];
  focusCycle?: CycleId;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'overview',
    indexLabel: '00 / 全园总览',
    shortTitle: '全园总览',
    title: '中乌布哈拉州智慧生态草牧业示范园区',
    description:
      '打破传统僵化方格排布，采用“主体绿洲生态牧区 + 东南跨荒漠完全独立屠宰冷链副园”空间体系：西北滨湖科教公服区、中北低应激轮牧繁育群落与东翼环保能源区共同构成主体绿洲，再跨越约百米荒漠自然隔离带外设完全独立的 I区 屠宰冷链园区。',
    loopChain: '“一体两翼三中心五基地” → 主体牧区与独立屠宰副园彻底物理分离 → 六大绿色循环协同闭合',
    equipment: ['主体绿洲牧业群落', '百米荒漠隔离屏障', '双圆指针喷灌草场', '完全独立屠宰冷链副园'],
    specs: [
      { label: '概念规模', value: '10万只羊同时在栏' },
      { label: '架构载体', value: '一体两翼三中心五基地' },
      { label: '空间法则', value: '净污分流+屠宰出园独立' },
      { label: '运维模式', value: '智能装备+人机协同' },
    ],
    cameraPos: [72, 225, 535],
    target: [64, 4, 10],
  },
  {
    id: 'ecology',
    indexLabel: '01 / P·Q区 · 生态起点',
    shortTitle: 'P区治碱',
    title: 'P区 盐碱地三段治理与 Q区 种质育种圃',
    description:
      '位于园区南部生态大道以南前沿绿洲，由东翼通道清晰分隔：P区呈现“重度原土对照→暗管排盐与微咸水滴灌首部改良→林草复合熟化带”三级治理梯度；东侧 Q区 西半部建有耐盐碱牧草玻璃育种温棚与 12 格品种试验田，东半部设三期生态预留展示坪。拖动左侧演化滑块即可直观对比修复过程。',
    loopChain: '上游：接收 J区合规有机肥与 K区再生水 → P区暗管排盐改良 + Q区耐盐育种 → 稳固绿洲屏障',
    equipment: ['三段梯级治碱试验带', '暗管排盐剖面展示沟', '微咸水滴灌首部与EC桩', 'Q区育种温棚与12格试验田'],
    specs: [
      { label: '对应基地', value: '生态修复与种质育种' },
      { label: '治理策略', value: '暗管排盐+滴灌+林草网格' },
      { label: '生态衔接', value: '有机肥与中水回用' },
      { label: '分期拓展', value: 'Q区东半部三期预留基座' },
    ],
    cameraPos: [128, 66, 228],
    target: [120, 2, 114],
    focusCycle: 'grass',
  },
  {
    id: 'forage',
    indexLabel: '02 / M·O区 · 农机饲草',
    shortTitle: 'O区饲草',
    title: 'M区 西南农机枢纽与 O区 双圆中心支轴草场',
    description:
      '将 M区 农机具维保调度库南移至生态大道南侧紧邻草场，机库大门与洗消坪正对 O区 作业路直出田间；O区 配备两座桁架行走式中心支轴（Center-Pivot）喷灌机分别栽培青贮玉米与紫花苜蓿轮刈草带，东端配套草捆堆垛棚、地磅与增压泵站直供 G区中央厨房。',
    loopChain: 'M区农机出库直下农田 → O区双圆支轴喷灌与收割 → 东站打包过磅 → 西环大道进 G区',
    equipment: ['M区西南农机维保枢纽', '双圆桁架式中心支轴喷灌机', '牧草打包棚与地磅泵站', '无人青贮收割与草捆运输车'],
    specs: [
      { label: '对应基地', value: '现代饲草与智能农机' },
      { label: '主栽作物', value: '青贮玉米 / 轮刈紫花苜蓿' },
      { label: '节水技术', value: '桁架喷灌+增压砂滤微灌' },
      { label: '空间联动', value: 'M区与O区同侧无阻直联' },
    ],
    cameraPos: [-122, 82, 232],
    target: [-138, 2, 108],
    focusCycle: 'grass',
  },
  {
    id: 'processing',
    indexLabel: '03 / G区 · 中央厨房',
    shortTitle: 'G区厨房',
    title: 'G区 植物工厂与双线 TMR 厨房',
    description:
      '西移布局于中北核心区西翼：最西为“一体式立体LED牧草植物工厂”，中部为双联青贮窖与干草库，东侧为四座精料立筒仓与双线 TMR 精密混拌车间，由北向双出料口直连“净道”动脉精准喂养 B–F 羊群。',
    loopChain: 'O区大田草 + LED植物工厂鲜草 → G区双线混拌 → 北侧净道 AGV 分群精准投喂',
    equipment: ['一体式LED牧草植物工厂', '青贮窖与标准干草库', '4座精料配料立筒仓', '双线TMR北向出料口'],
    specs: [
      { label: '工艺控制', value: '分群配方+干物质追溯' },
      { label: '植物工厂', value: '立体补光鲜草补饲' },
      { label: '加工模式', value: '青贮+精料TMR混拌' },
      { label: '净污隔离', value: '北连净道·南留缓冲' },
    ],
    cameraPos: [-4, 58, 68],
    target: [-18, 4, -22],
    focusCycle: 'feed',
  },
  {
    id: 'quarantine',
    indexLabel: '04 / H区 · 检疫防疫',
    shortTitle: 'H区检疫',
    title: 'H区 远端兽医防疫与引入羊隔离前哨',
    description:
      '遵循严格动物卫生防疫半径，H区单独孤立设置在主养殖组团外围的西侧防护林带内：外购引种羊须经全车雾化洗消拱门与静态隔离观察，由驻场兽医复核佩戴电子耳标建档确认无疫后，方允许分批次进入核心繁育舍。',
    loopChain: '外购引种羊 → H区独栋隔离洗消 → 兽医核验一羊一码 → 合规并群转入 B–F',
    equipment: ['远端独立隔离观察舍', '兽医诊疗化验室', '整车雾化洗消拱门', 'RFID耳标建档门架'],
    specs: [
      { label: '空间关系', value: '林带隔断·独立前哨' },
      { label: '核心职责', value: '引种隔离+疫病筛查' },
      { label: '档案管理', value: '系谱与耳标全程追溯' },
      { label: '管控机制', value: '人工兽医复核把关' },
    ],
    cameraPos: [-102, 40, 32],
    target: [-120, 3, -22],
    focusCycle: 'digital',
  },
  {
    id: 'breeding',
    indexLabel: '05 / B-F区 · 生态良繁',
    shortTitle: 'B-F羊舍',
    title: 'B–F区 绿洲轮牧草场与错落光伏羊舍矩阵',
    description:
      '摒弃冰冷水泥大平板，将 B–F 羊舍按梯队错落嵌于绿色轮牧牧场草地中（B育种展示、C繁殖母羊、D羔羊保育、E标准育肥、F扩繁轮牧），展示杜泊、萨福克、卡拉库尔三大良种；本视角自动透视羊舍屋顶展示内部精准饲喂通道，并与屠宰区隔林隔水远离 150m 以上。',
    loopChain: '净道精准喂羊 → 绿洲草地轮牧繁育（B–F） → 东侧风林外转运 / 污道封闭清粪',
    equipment: ['错落光伏羊舍组团', '户外绿色轮牧运动场', '自动撒料饮水与屋顶透视', '三大代表羊种展示'],
    specs: [
      { label: '福利理念', value: '舒缓牧区·远离屠宰噪声' },
      { label: '重点羊种', value: '杜泊 / 萨福克 / 卡拉库尔' },
      { label: '空间布局', value: '组团错落+绿草轮牧' },
      { label: '在栏口径', value: '10万只概念分群设计' },
    ],
    cameraPos: [16, 102, 82],
    target: [8, 4, -82],
    focusCycle: 'grass',
  },
  {
    id: 'manure',
    indexLabel: '06 / J区 · 东翼粪污堆肥',
    shortTitle: 'J区堆肥',
    title: 'J区 东侧下风向粪污发酵与有机肥还田',
    description:
      '遵循臭气与病原控制原则，将 J区整体东移至三重防风隔离林带后方的下风向独立区域：F区刮板干清粪车沿专用封闭“污道”向东穿林直入发酵预处理与四座发酵塔/沼气穹顶，腐熟有机肥自东门绕外环返还 O/P 区还田，净污路线互不交叉。',
    loopChain: '羊舍干清粪 → 封闭污道穿林入J区 → 双线厌氧/条垛腐熟 → 东门闭环还田 O/P',
    equipment: ['4座好氧/厌氧发酵塔', '双机条垛好氧翻抛厅', '沼气稳压膜储气穹顶', '净污分流有机肥装车门'],
    specs: [
      { label: '选址原则', value: '下风向+林带隔臭' },
      { label: '固态路径', value: '条垛好氧堆肥制肥' },
      { label: '液态路径', value: '厌氧产沼与肥液分离' },
      { label: '安全前提', value: '无害化检测合格还田' },
    ],
    cameraPos: [198, 52, 48],
    target: [186, 4, -17],
    focusCycle: 'manure',
  },
  {
    id: 'water',
    indexLabel: '07 / K区 · 中水回用中心',
    shortTitle: 'K区中水',
    title: 'K区 污水处理与生态水渠梯级回用',
    description:
      '紧邻南部生态灌溉水渠北岸与 J区联动：牧场及生产废水进入四座圆形生化沉淀池与 MBR 膜车间深度净化，检疫水质达标后经跨渠高架再生水管桥向南跨越生态水渠，精确补给 Q/P/O 滴灌带及人工湿地循环系统。',
    loopChain: '分质排水收集 → 四池生化沉淀与MBR → 跨渠再生水泵桥 → O/P精准滴灌',
    equipment: ['4座圆形生化沉淀池', '双向旋转刮泥曝气桥', '跨生态水渠再生水管桥', 'MBR膜深度处理车间'],
    specs: [
      { label: '供水原则', value: '分质供水·分类排水' },
      { label: '核心设施', value: '4座生化处理圆池' },
      { label: '生态衔接', value: '跨渠管桥直达O/P农田' },
      { label: '回用边界', value: '达标再生水受控灌溉' },
    ],
    cameraPos: [196, 48, 96],
    target: [186, 3, 36],
    focusCycle: 'water',
  },
  {
    id: 'energy',
    indexLabel: '08 / L区 · 东翼绿电微网',
    shortTitle: 'L区能源',
    title: 'L区 绿电微电网与风储光互补枢纽',
    description:
      '移设于东北翼风电山脊前缘、防风林带外侧：汇聚园区屋顶光伏、L区 12 组地面光伏阵列、北岭风力发电及 J区沼气热电，经四座磷酸铁锂储能集装箱与 EMS 智能调度室就地消纳并保障屠宰冷链与中央厨房不断电运行。',
    loopChain: '北脊风电+全园光伏+J区沼气 → L区储能集装箱与EMS → 供电养殖、冷链与加工',
    equipment: ['12组集中地面光伏阵列', '储能电池集装箱×4', 'EMS微电网调度变电站', '远景低风速风机阵列'],
    specs: [
      { label: '能源定位', value: '绿色循环与低碳供能' },
      { label: '多能耦合', value: '风/光/储/沼气互补' },
      { label: '负荷调度', value: '峰谷调节与保供分级' },
      { label: '区位优势', value: '紧邻北岭风电与冷链' },
    ],
    cameraPos: [192, 48, -22],
    target: [180, 3, -90],
    focusCycle: 'energy',
  },
  {
    id: 'slaughter',
    indexLabel: '09 / I区 · 独立屠宰冷链园',
    shortTitle: 'I区冷链',
    title: 'I区 完全独立外设清真屠宰与冷链物流园',
    description:
      '践行最严苛的动物福利与防疫隔断标准，将 I区 彻底移出主体绿洲牧场构建生态园林式独立副园：厂区内部错落分区并嵌入林荫绿地、净水微站、生物滞留生态塘与架空洁净连廊；育肥羊经南部洗消环线入静养栏，冷链车绕绿化环岛进出次入口并在双线货运干道上实现顺畅往返与远途外运。',
    loopChain: '封闭外环入栏卸羊并洗消折返 → 架空洁净冷链连廊 → 绿化环岛发车出次入口远途外运',
    equipment: ['园内林荫绿地与生态景观点塘', '架空洁净连廊与绿化环岛', '双车流洗消往返活畜通道', '双车道冷链干道持续发运'],
    specs: [
      { label: '空间独立', value: '移出主园·园林式独立副区' },
      { label: '动物福利', value: '林木缓压·消除视觉应激' },
      { label: '交通组织', value: '环岛分流·进出货车不停流' },
      { label: '外运通道', value: '双向双车道高速直联市场' },
    ],
    cameraPos: [364, 86, 240],
    target: [342, 4, 104],
    focusCycle: 'feed',
  },
  {
    id: 'science',
    indexLabel: '10 / A·N区 · 滨湖科教公园',
    shortTitle: 'A·N科研',
    title: 'A区滨湖公服中枢、N区联合实验室与西侧湿地湖景',
    description:
      '农机调度区（M）南迁后，园区西南侧整片空地升级为生态滨湖湿地公园：原木亲水栈道与光伏翼亭临水展开，拱桥连通湖心生态岛，双喷泉曝气增氧并与南侧生态水渠自然贯通；北侧承接主入口门楼、A区数字指挥大厅及 N区中乌联合实验室，形成宜人清净的科研迎宾前庭。',
    loopChain: '数字中枢 A/N → 滨湖生态微气候调节 → 科技成果赋能农机（M）、耐盐育种（Q/P）与全链循环',
    equipment: ['西北主入口智慧门楼', 'A区数字指挥大厅与公寓', 'N区圆形科普馆与4实验室', '滨湖栈道翼亭·湖心岛·双喷泉'],
    specs: [
      { label: '总体架构', value: '两翼四实验室 + 滨湖公园' },
      { label: '入口分工', value: '主入口迎宾与科研办公' },
      { label: '水系生态', value: '曝气湖景直连南侧生态水渠' },
      { label: '分期拓展', value: '联动东南侧Q区种质基地' },
    ],
    cameraPos: [-118, 68, 22],
    target: [-180, 4, -64],
    focusCycle: 'digital',
  },
  {
    id: 'science_interior',
    indexLabel: '11 / N区 · 科创内部解剖视角',
    shortTitle: 'N区内部',
    title: 'N区中乌科创培训圆厅与四大联合实验室内部视角',
    description:
      '自动开启屋面半透明剖切（或拉近镜头进入）：中央玻璃穹顶内设 360° 全息数字沙盘、弧形指挥大屏与双层阶梯实训坐席；外围由十字玻璃连廊贯通北侧盐碱土柱淋洗实验室、南侧牧草组培光照育种室、西侧羊胚胎超低温液氮与生物安全室、东侧碳汇发酵罐与物联网机房。',
    loopChain: '中枢圆厅全息推演 ↔ 四翼透明玻璃连廊 ↔ 土壤/牧草/胚胎/碳汇四实验室数据闭环',
    equipment: [
      '中央360°旋转全息园区沙盘与阶梯实训厅',
      '北翼：盐碱地水盐运移土柱淋洗实验台',
      '南翼：红蓝光谱LED组培架与耐盐牧草育种室',
      '西翼：羊胚胎超低温液氮罐群与PCR洁净台',
      '东翼：厌氧碳汇生物反应器与边缘计算服务器',
    ],
    specs: [
      { label: '空间构型', value: '中枢圆厅+十字连廊+四翼' },
      { label: '交互模式', value: '支持穹顶/屋面透明剖切' },
      { label: '核心平台', value: '中乌四大联合实验室' },
      { label: '实训能力', value: '全息沙盘推演与专家培训' },
    ],
    cameraPos: [-130, 18.5, -70],
    target: [-154, 2.4, -98],
    focusCycle: 'digital',
  },
  {
    id: 'tmr_interior',
    indexLabel: '12 / G区 · TMR厨房内景',
    shortTitle: 'TMR内景',
    title: 'G区 双线全自动 TMR 中央厨房与植物工厂内部视角',
    description:
      '自动开启屋面半透明剖切（或拉近镜头至56米内）：大厅内呈南北双线并行布局，两台配备对旋双螺旋不锈钢绞龙的卧式TMR混合机正在实时搅料，南侧四座镀锌波纹精料立罐经顶部检修天桥与高架螺旋绞龙精准计量下料，北侧悬挑玻璃中控室大屏实时联动调度，东西两翼分别为全光谱垂直水培牧草工坊与双青贮窖/干草棚。',
    loopChain: '青贮/干草/水培牧草双通道皮带上料 ↔ 揉丝粉碎 ↔ 精料立罐高精度配比混匀 ↔ 北端AGV自动装车',
    equipment: [
      '双线对旋双螺旋不锈钢TMR混合主机×2',
      '四座镀锌波纹精料立罐与高架检修天桥',
      '悬挑式全景玻璃SCADA数字化中控室',
      '西翼斜升皮带进料机与双联滚筒揉丝机',
    ],
    specs: [
      { label: '核心工艺', value: '粗精分储·高精度全混合日粮' },
      { label: '产能构型', value: 'N/S双线并行连续混料' },
      { label: '交互模式', value: '屋面自动剖切透视内部装备' },
      { label: '洁净流线', value: '西侧原料进场·北侧洁净发车' },
    ],
    cameraPos: [10, 21.5, 4.5],
    target: [-8, 3.0, -23.5],
    focusCycle: 'feed',
  },
  {
    id: 'sheep_interior',
    indexLabel: '13 / B-F区 · 羊舍内景',
    shortTitle: '羊舍内景',
    title: 'B–F区 标准化智慧羊舍与多品种良种羊群内部视角',
    description:
      '自动开启屋面半透明剖切（或贴近羊舍巡检视角）：舍内中央设洁净TMR送料通道与不锈钢自锁颈枷食槽，两侧铺设架空漏缝清粪地板与金黄垫草躺卧区；屋架下大型HVLS节能吊扇与AI巡检轨道机器人协同运行，舍外绿色轮牧运动场配置恒温自动饮水槽与圆形干草架，展示杜泊、萨福克及螺旋角卡拉库尔羊群。',
    loopChain: '净道精准送料 → 自锁颈枷采食TMR ↔ HVLS通风除湿 ↔ 漏缝清粪与草场轮牧',
    equipment: [
      '中央TMR送料通道与自锁颈枷食槽',
      '漏缝清粪地板与金黄垫草躺卧区',
      '5叶HVLS大吊扇与轨检机器人',
      '杜泊/萨福克/卡拉库尔三大良种羊群',
    ],
    specs: [
      { label: '养殖工艺', value: '干湿分区·架空漏缝床' },
      { label: '精准环控', value: 'HVLS吊扇+AI轨检' },
      { label: '代表品种', value: '杜泊·萨福克·卡拉库尔' },
      { label: '交互模式', value: '支持屋面自动透视剖切' },
    ],
    cameraPos: [-16, 13.5, -75],
    target: [-26, 2.2, -104],
    focusCycle: 'grass',
  },
];
