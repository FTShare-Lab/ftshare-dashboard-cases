# FtShare 看板库

在同一处打开独立打磨的市场研究看板。左侧选案例，右侧直接使用看板。

[在线打开](https://ftshare-visualization.zippymarshmallow.chatgpt.site/) · [贡献看板](CONTRIBUTING.md) · [案例模板](templates/case)

## 本地预览

需要 Node.js 24 或更新版本，无需安装外部依赖。

```sh
npm start
```

打开 http://127.0.0.1:8770/ 。使用 `npm run validate` 检查案例清单与可发布资源，使用 `npm test` 验证目录和路由。JSON 目录位于 `GET /api/cases`。

## 贡献与发布

新增一个案例目录即可进入预览。GitHub PR 自动跑验证和测试，维护者预览数据口径和交互，通过后合并，GitHub Actions 发布更新后的目录。ETF 和 VIX 使用原站数据，VIX 在看板库里采用 ETF 的界面样式。贡献者的本地案例使用通过审核的公开资源。代码使用 MIT 许可证，案例数据的公开权限由各案例说明注明。
