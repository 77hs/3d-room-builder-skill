# 3D Room Builder Skill

[English](README.md) · [演示](docs/DEMO.md) · [验证记录](docs/VALIDATION.md) · [v0.1.1 下载](https://github.com/77hs/3d-room-builder-skill/releases/tag/v0.1.1)

在 Codex 中用自然语言创建和持续修改可漫游的 3D 房间。
Skill 将需求转为场景数据，由确定性 JavaScript 生成器校验并构建浏览器预览。
无需独立 AI 服务、API Key 或私人住宅工程。

![程序化房间总览](docs/demo/overview.png)

## 安装

需要 **Node.js 22+、npm、支持 Skills 的 Codex、桌面 WebGL2 浏览器**。
从 [Release v0.1.1](https://github.com/77hs/3d-room-builder-skill/releases/tag/v0.1.1) 下载 ZIP 或 tar.gz，
对照随附 SHA256SUMS 校验后解压，把完整 `3d-room-builder-skill` 文件夹放到以下一个位置：

- 项目级：`<你的工作区>/.agents/skills/3d-room-builder-skill`
- 用户级：`$HOME/.agents/skills/3d-room-builder-skill`

在安装后的 Skill 文件夹内运行：

```sh
npm ci --omit=dev --ignore-scripts
```

也可以从工作区根目录直接安装已标记版本：

```sh
mkdir -p .agents/skills
git clone --branch v0.1.1 --depth 1 https://github.com/77hs/3d-room-builder-skill.git .agents/skills/3d-room-builder-skill
cd .agents/skills/3d-room-builder-skill
npm ci --omit=dev --ignore-scripts
```

macOS 校验命令为 `shasum -a 256 -c SHA256SUMS`，Linux 使用 `sha256sum -c SHA256SUMS`；
完整校验需将两个安装包与清单放在同一目录。

随后在工作区开启新的 Codex 对话。避免同名重复安装，房间工作区放在 Skill 目录外。
Windows 用户级目录使用用户主目录；含空格的命令路径需要引号。
首次安装需要联网下载 npm 依赖，生成后的预览不请求 CDN 或远程素材。

## 自然语言使用

```text
$3d-room-builder-skill 在 my-bedroom 创建一个 4m × 5m 现代卧室，
包含门窗、床、书桌、椅子和衣柜，并启动浏览器预览。
```

继续修改同一房间：

```text
将宽度改为 4.5m，书桌旋转 90 度。
如果需要，只允许移动这张书桌，其他对象保持不变。
```

```text
墙壁颜色改为 #dde5d9，环境光强度改为 1.4。
```

创建或修改可漫游房间也可自然触发 Skill；实际选择取决于宿主和模型，未触发时使用显式名称。
纯概念解释、仅生成图片、无关代码修改不应调用本 Skill。
冲突修改返回对象 ID 和原因，保留原场景，不自动重排。

## 能力及数据

单层矩形房间，长宽各 2–20m；墙、地板、天花板、静态开放门框及固定窗；
床、书桌、椅子、衣柜、书架、沙发和桌子共七类程序化家具；尺寸、位置、直角旋转；
基础颜色及灯光；总览、第一人称、碰撞和重置。不使用外部模型或贴图。

`scene.json` 是唯一当前状态。几何与碰撞使用同一份规范化数据；
稳定 ID、revision 检查、完整构建后原子提交、历史恢复支持连续修改。
详见[场景规范](references/scene-spec.md)和[命令、恢复流程](references/workflow.md)。

## 命令行快速复现

在 Skill 文件夹内使用新的输出目录：

```sh
node scripts/room.mjs create --scene examples/a-bedroom.json --dir ./output/bedroom
node scripts/room.mjs serve --dir ./output/bedroom --port 5173
```

另开终端创建不同书房、修改并导出：

```sh
node scripts/room.mjs create --scene examples/b-study.json --dir ./output/study
node scripts/room.mjs apply --dir ./output/study --change examples/c-study.change.json
node scripts/room.mjs validate --dir ./output/study
node scripts/room.mjs build --dir ./output/study --out ./output/study-export
node scripts/room.mjs serve --static ./output/study-export --port 5174
```

访问打印的本机地址。导出目录已带必要模块及许可证，迁移后用任意静态 HTTP 服务启动；
不要直接双击 `file://`。从其他目录调用 CLI 时使用实际安装路径。
总览：拖动、滚轮；第一人称：WASD/方向键、Q/E 转向、拖动或点击查看、R 重置、Esc 释放鼠标。
浏览器拒绝鼠标锁定时仍可拖动查看。有效修改会重新加载预览。

## 开发、限制与许可

开发使用 `npm ci --ignore-scripts`、`npm test`。
浏览器测试先运行 `npx playwright install chromium`，再运行 `npm run test:browser`；
已有 Chrome 可设置 `ROOM_BUILDER_BROWSER_CHANNEL=chrome`。
真实 Codex 测试需要登录及模型额度，参见[宿主测试](tests/codex-cases.md)。

不支持第三人称、坐躺、楼梯、多房间、任意模型或物理模拟，不承诺手机及建筑级准确度。
碰撞覆盖完整家具占地，不能钻桌下；窄通路可能被保守拒绝，门外没有可行走地面。
未实测平台及实体 GPU 性能详见[验证记录](docs/VALIDATION.md)。

自有代码、虚拟示例和演示截图按 [MIT](LICENSE) 提供；
依赖保留[第三方许可](THIRD_PARTY_NOTICES.md)及完整文本。
不包含私人住宅布局、照片、模型、音乐或凭证；后续用户素材需要单独确认分发权利。
v0.1.1 的 MIT 公开发布已经所有者授权，见[项目状态](PROJECT_STATUS.md)和[Release](https://github.com/77hs/3d-room-builder-skill/releases/tag/v0.1.1)。
日常创建房间不会触发发布或其他账户操作。
