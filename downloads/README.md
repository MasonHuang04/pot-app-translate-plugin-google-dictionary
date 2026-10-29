# 安装包

此目录用于存放 `plugin.local.google-dictionary.potext` 安装包。源码、测试和打包脚本已提交；现成安装包的自动上传遇到工具权限错误，文件尚未放入此目录。

目前可先在项目根目录运行 `python3 scripts/package.py`，在 `dist/` 中取得安装包，然后在 Pot 的服务设置中安装并加入翻译服务列表。

这是实验版本：离线测试通过，真实联网查询和 Pot 界面效果尚未完成验收。安装步骤和功能说明见[项目 README](../README.md)。

安装包由仓库中的 `python3 scripts/package.py` 生成，包含源码、插件配置、图标和 GPL-3.0 许可证。
