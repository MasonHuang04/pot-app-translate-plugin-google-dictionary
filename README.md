# Google Translate 词典增强 · Pot 插件

为 Pot 的查词窗口提供 Google Translate 的多词性、多义项和原文释义。Google 有返回时，还会显示音标或转写、反向对应词、近义词和例句。没有词典数据时直接显示普通译文。

这是独立的第三方插件，不需要修改或重新编译 Pot。插件无 npm 运行依赖，不需要配置 Google API Key。它使用与 Pot 内置 Google 服务同一类的网页接口，并非 Google Cloud Translation API。

**当前状态：实验版本。25 项离线测试通过；Google 接口验证遇到 HTTP 429，真实联网查询和 Pot 界面中的端到端效果尚未验收。**

## 为什么是独立仓库

Pot 已提供正式的翻译插件接口，可以加载独立的 `.potext` 文件，并直接显示结构化词典结果。因此，这个项目不需要 fork 或修改 Pot 主程序。

Pot 内置 Google 服务已经有基础词典模式；本项目补充更完整的词典字段处理、原文释义、反向对应词、近义词、字段缺失处理和完整文本输出。具体参考文件见文末，项目不代表 Pot 或 Google 官方。

只有将来需要改变 Pot 自身的词典卡片布局、窗口行为或插件 API 时，才需要修改 Pot 主仓库。

## 安装

先[下载 `.potext` 安装包](https://github.com/MasonHuang04/pot-app-translate-plugin-google-dictionary/raw/refs/heads/main/downloads/plugin.local.google-dictionary.potext)，或用下文命令从源码打包。

1. 打开 Pot 的「偏好设置 → 服务设置 → 翻译 → 添加外部插件」。
2. 点击「安装外部插件」，选择 `plugin.local.google-dictionary.potext`。
3. 在插件列表点击「Google Translate 词典增强」，保存配置并加入翻译服务列表。**安装文件后还需要这一步，才会在查询窗口显示结果。**
4. 查询 `run`、`bank`、`take off`，目标语言选择简体中文，展开这个服务的结果卡片查看释义。

具体按钮名称可能随界面语言略有不同。插件入口、配置字段和词典返回结构依据 Pot 3.0.7 / 当前 master 源码实现；尚未在 Pot 界面中完成安装验收。

## 配置

| 设置 | 默认值 | 用途 |
| --- | --- | --- |
| 请求地址 | `https://translate.google.com` | 通常留空。也可使用 `https://translate.googleapis.com`，或你自己的兼容接口基础地址。不要填写网页查询链接。 |
| 结果显示 | 词典卡片 | 使用 Pot 原有的音标、词性、释义、例句布局。 |
| 结果显示 → 完整文本 | 手动选择 | 保留同样的详细内容，改为文本显示，支持 Pot 的复制按钮。 |

默认按 Google 返回的词典字段决定显示形式，不用空格数判断单词，因此短语和非英语词语也可以进入词典模式。不会为每个例句额外发起翻译请求。

原文释义沿用 Google 返回的语言，例如英语单词的英文解释；不会自动把它们再翻译为中文。例句没有返回译文时只显示原文，不补造例句翻译。Google 未返回某个字段时跳过该字段。

Pot 原有词典卡片的复制/朗读按钮可能不可用；需要复制全部内容时，选择「完整文本」。插件没有新增发音音频下载；音标或转写仅在响应包含相应数据时显示。

## 使用条件与当前验证结果

- Pot 需要能访问 Google Translate。无法访问时检查网络以及 Pot 的代理设置。
- 网页接口没有稳定性保证，可能出现 HTTP 429 限流；插件会明确提示，不自动重试限流请求。
- Google 的词典覆盖取决于词语、源语言和目标语言，不能保证每次查询都返回与网页完全相同的词典内容。
- 查询文字直接发往配置的服务地址。使用自定义地址时，查询文字将发送到该地址。
- 2026-10-29：25 项离线测试通过，覆盖词性/多义项、原文释义、例句、缺字段、JSON/数组响应、短语、句子回退、错误响应、例句 HTML 转义和打包所需信息。
- 离线测试使用按公开结构编写的模拟数据，**不是 Google 联网查询成功的证明**。当前环境对 Google 主域名和 googleapis 域名的验证请求均返回 HTTP 429，因此尚未完成真实查询和 Pot 内界面的端到端验收。

## 源码与复现

```sh
# Node.js 18+，无需 npm install
npm test

# Python 3 标准库打包，产物位于 dist/
python3 scripts/package.py

# 可选：真实查询 run、bank 和一句英文；需要可访问 Google
npm run test:live

# 可选：使用自己的兼容接口运行联网检查
GOOGLE_TRANSLATE_BASE_URL=https://your-service.example npm run test:live
```

`.potext` 是 ZIP 文件，根目录包含 `main.js`、`info.json`、`dictionary.svg` 和 `LICENSE`。源码中的 `translate` 入口没有模块导入导出，按 Pot 的 `eval` 加载方式验证。使用 Tauri HTTP 接口，兼容 `utils.http.fetch` 和 `utils.tauriFetch`。

每次查询只发送一次请求，使用 `dj=1` 和 `dt=t/bd/rm/md/ex/ss` 请求普通译文、词典、转写、原文释义、例句、近义词。同时兼容旧数组格式的响应。配置中的目标语言与界面语言码使用 Pot 的映射规则。

## 参考实现

- [Pot 主仓库](https://github.com/pot-app/pot-desktop)，检查基线：`594d32ede96acd106b0256deaa8bb440ffcdff40`。
- [Pot 内置 Google 服务](https://github.com/pot-app/pot-desktop/blob/594d32ede96acd106b0256deaa8bb440ffcdff40/src/services/translate/google/index.jsx)：已有基础词典模式；此插件作为独立服务提供详细释义和缺字段处理。
- [Pot 翻译插件规范](https://github.com/pot-app/pot-app-translate-plugin-template/blob/fced3e1c921c1bfbadafa2ecda361c8c05ec1de2/README.md)：入口函数、词典 JSON 结构、安装包格式。
- [Pot 插件加载器](https://github.com/pot-app/pot-desktop/blob/594d32ede96acd106b0256deaa8bb440ffcdff40/src/utils/invoke_plugin.js)。
- [Raycast Dictionary Google 引擎](https://github.com/raycast/extensions/blob/main/extensions/dictionary/src/engines/googl.ts)、[VS Code Translation Google 接口](https://github.com/caiqichang/vsc-translation/blob/master/src/api/google-api.ts)：用于交叉核对 Google 的 JSON 响应字段。

仓库的 `downloads/` 目录提供当前安装包，其他文件为完整源码、测试和打包脚本。更新代码后，应重新打包并更新该安装包。

许可证：GPL-3.0-only，见 `LICENSE`。
