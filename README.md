# 竹宝·熊猫桌宠

竹宝是一只透明置顶的 Windows 熊猫桌宠。它会在桌面散步、坐下、挥手、跳跃、吃竹子和观察叶子，并且拥有完整的养成循环。

## 本地运行

```powershell
pnpm install
pnpm start
```

运行后：

- 点击熊猫：摸摸它；拖动熊猫：移动它。
- 点击右上角的小房子，或按 `Ctrl + Alt + P`：打开“竹宝的小屋”。
- 右键熊猫：打开快捷菜单。
- 托盘图标：恢复桌宠、打开面板或退出。

## 宠物系统

- 饱食、心情、精力、好感、等级和经验。
- 摸摸、投喂、散步、玩耍、打羽毛球、休息等互动会联动桌宠动画。
- 背包、青竹小铺、竹币、每日任务、成长奖励和竹宝日记。
- 离线时间结算、每日重置、自动投喂、自由活动和单实例存档保护。
- 便携版会在 EXE 旁自动创建 `data/`，并把存档、缓存、日志和崩溃信息都保存在其中；安装版仍使用 Electron 用户数据目录。
- 可在设置中导出或导入 JSON 备份。
- 足球、篮球、举哑铃、唱歌与羽毛球一样，支持首页按钮、右键菜单和自由活动；主动互动计入玩耍任务。
- 乒乓球同样支持首页、右键和自由活动，主动互动计入玩耍任务。加班支持手动和随机触发；自由活动中出现概率平时约 8.3%，本机时间每天 18:00–24:00 提高为 31.25%。午夜恢复普通概率，关闭自由活动则不自动触发；备忘录提醒优先。
- 面板新增“备忘录”：填写内容及事项时间，提醒时间自动提前 5 分钟，也可手动修改。按本机时间检查，到时持续播放闹钟动作和内容气泡，点击桌宠或“结束提醒”后停止，长内容可滚动。提醒不受普通对话气泡开关影响。
- 多条到期备忘按顺序等待，确认当前提醒后再显示下一条；未确认的提醒重启后继续。列表分为正在提醒、待提醒和已结束，已结束记录以灰色划线卡片展示。关闭面板、隐藏桌宠不影响提醒；退出程序期间无法提醒，下次启动会补上尚未提醒的记录。备忘随存档及备份保存。

## 检查

```powershell
pnpm test
pnpm smoke
```

`pnpm test` 验证养成规则，`pnpm smoke` 隐藏启动两个窗口并验证渲染。

## 打包（本轮未重新打包）

```powershell
pnpm dist
```

命令会在 `release/` 中生成 NSIS 安装包和便携版程序。当前 `release/` 里的旧构建不包含本次宠物系统，请使用 `pnpm start` 预览最新效果，确认满意后再重新打包。

要使用随身数据模式，请复制并运行不带 `Setup` 的便携版 `Zhubao Panda Pet 1.0.0.exe`。首次运行后目录结构如下：

```text
任意可写目录/
├─ Zhubao Panda Pet 1.0.0.exe
└─ data/
   ├─ zhubao-save-v1.json
   ├─ session/
   ├─ logs/
   ├─ crashes/
   └─ temp/
```

换电脑时复制 EXE 和 `data/` 可保留进度；只复制 EXE 则从全新存档开始。不要把便携版放在 `C:\Program Files` 等普通用户不可写的目录。

项目固定使用 `electron-builder` 26.10.0，`patches/` 中保留了兼容 pnpm 缓存模式的可复现补丁。`electron-builder.env` 会使用已配置的镜像，`electronDist` 复用 `node_modules` 中已安装的 Electron 运行时。

由于尚未提供代码签名证书，Windows 构建默认不签名。为兼容当前主机的符号链接策略，可执行文件元数据重写保持关闭；应用托盘仍使用已生成的熊猫图标。

之前的预构建产物（旧功能版）：

- `release/Zhubao Panda Pet Setup 1.0.0.exe` — interactive NSIS installer
- `release/Zhubao Panda Pet 1.0.0.exe` — portable executable
- `release/win-unpacked/` — unpacked smoke-tested application

## 精灵图约定

应用使用 `app-assets/spritesheet.webp`：8 列×11 行、单格 192×208 像素的图集。标准动画行之后是 16 个顺时针注视方向，`app-assets/pet.json` 记录 `spriteVersionNumber: 2`。

生成的原始美术、确定性校验、联系表和 QA 产物位于 `assets/zhubao/hatch-run/`。

